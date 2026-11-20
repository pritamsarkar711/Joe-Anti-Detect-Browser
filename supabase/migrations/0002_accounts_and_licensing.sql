-- Joe Browser · accounts, owner provisioning and licensing (0002)
--
-- Captures the production state that 0001 did not include. Applied live on
-- 2026-11-19 against project rajxyaatbvlrxxzjntmo; idempotent and safe to
-- re-run. Companion notes:
--   * The device relay (`commands`) stays locked away from the anon role —
--     EXE⇄APK traffic goes through the `joe-command-validate` edge function
--     with the service-role key, so no client-side table policy is added here.
--   * Licensing objects (`joe_private`, `msap_*`) were created directly in
--     production by earlier maintenance; they are captured verbatim so the
--     repository reproduces the live database.

-- ---------------------------------------------------------------- 1. allowlist
create table if not exists public.account_allowlist (
  email text primary key,
  plan text not null default 'free' check (plan in ('free', 'starter', 'premium', 'owner')),
  note text,
  created_at timestamptz not null default now()
);

-- The allowlist decides who is premium/owner, so nobody but the database
-- owner (the SECURITY DEFINER signup trigger) may touch it. RLS with zero
-- policies is deny-all for anon and authenticated even when Supabase's
-- default privileges have already granted table-level CRUD; the explicit
-- revoke covers fresh projects where those defaults are absent.
alter table public.account_allowlist enable row level security;
revoke all on public.account_allowlist from anon, authenticated;

-- ------------------------------------------------------------- 2. entitlement
-- One row per auth user. Only the signup trigger inserts; clients may read
-- their own row and update nothing that matters (see guard below).
create table if not exists public.accounts (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  plan text not null default 'free',
  unlimited boolean not null default false,
  profile_limit integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounts enable row level security;

drop policy if exists "accounts: read own" on public.accounts;
create policy "accounts: read own" on public.accounts
  for select to authenticated using (auth.uid() = id);

drop policy if exists "accounts: update own" on public.accounts;
create policy "accounts: update own" on public.accounts
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- No INSERT / DELETE policy: rows exist only because the trigger below
-- (SECURITY DEFINER) creates them at signup.

create or replace function public.handle_new_account()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  resolved text;
begin
  select a.plan into resolved from public.account_allowlist a where lower(a.email) = lower(new.email);
  resolved := coalesce(resolved, 'free');
  insert into public.accounts (id, email, plan, unlimited, profile_limit)
  values (
    new.id,
    lower(new.email),
    resolved,
    resolved in ('premium', 'owner'),
    case resolved when 'free' then 2 when 'starter' then 6 else null end
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$function$;

create or replace function public.guard_account_plan()
returns trigger
language plpgsql
as $function$
begin
  if current_user in ('anon', 'authenticated') then
    new.plan          := old.plan;
    new.unlimited     := old.unlimited;
    new.profile_limit := old.profile_limit;
    new.email         := old.email;
    new.id            := old.id;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists on_auth_user_created_account on auth.users;
create trigger on_auth_user_created_account
  after insert on auth.users
  for each row execute function public.handle_new_account();

drop trigger if exists guard_account_plan_before_update on public.accounts;
create trigger guard_account_plan_before_update
  before update on public.accounts
  for each row execute function public.guard_account_plan();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Users that signed up before the trigger existed get their row now, resolved
-- through the same allowlist logic as a fresh signup.
insert into public.accounts (id, email, plan, unlimited, profile_limit)
select
  u.id,
  lower(u.email),
  coalesce((select a.plan from public.account_allowlist a where lower(a.email) = lower(u.email)), 'free'),
  coalesce((select a.plan from public.account_allowlist a where lower(a.email) = lower(u.email)) in ('premium', 'owner'), false),
  case coalesce((select a.plan from public.account_allowlist a where lower(a.email) = lower(u.email)), 'free')
    when 'free' then 2
    when 'starter' then 6
    else null
  end
from auth.users u
where u.email is not null
on conflict (id) do nothing;

-- ------------------------------------------------- 3. licensing (joe_private)
-- Kept out of `public`: no table grants exist for anon/authenticated, and the
-- RPCs below defend themselves with require_user()/require_admin().
create schema if not exists joe_private;

create table if not exists joe_private.accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  expires_at timestamptz,
  plan text,
  trial_claimed_at timestamptz,
  is_blocked boolean not null default false
);

create table if not exists joe_private.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists joe_private.codes (
  id uuid primary key default gen_random_uuid(),
  code_hash bytea not null,
  kind text not null check (kind in ('trial', 'premium')),
  duration_seconds integer not null,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_by uuid,
  revoked_at timestamptz
);

-- Belt and braces: deny-by-default on the licensing tables as well. The
-- SECURITY DEFINER RPCs below run as the owner and are unaffected.
alter table joe_private.accounts enable row level security;
alter table joe_private.admins enable row level security;
alter table joe_private.codes enable row level security;

create or replace function joe_private.require_user()
returns uuid
language plpgsql
stable security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in required';
  end if;
  return uid;
end;
$function$;

create or replace function joe_private.require_admin()
returns void
language plpgsql
stable security definer
set search_path to ''
as $function$
begin
  if not exists (
    select 1
    from joe_private.admins a
    left join joe_private.accounts ac on ac.user_id = a.user_id
    where a.user_id = auth.uid() and not coalesce(ac.is_blocked, false)
  ) then
    raise exception 'Administrator access required';
  end if;
end;
$function$;

create or replace function public.msap_my_entitlement()
returns table (expires_at timestamptz, server_time timestamptz, is_admin boolean, is_blocked boolean, plan text)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := joe_private.require_user();
begin
  insert into joe_private.accounts (user_id, expires_at, plan, trial_claimed_at)
  values (uid, now() + interval '7 days', 'trial', now())
  on conflict (user_id) do nothing;
  return query
    select a.expires_at, now(),
           exists(select 1 from joe_private.admins ad where ad.user_id = uid),
           a.is_blocked, a.plan
    from joe_private.accounts a where a.user_id = uid;
end;
$function$;

create or replace function public.msap_start_trial()
returns table (expires_at timestamptz, server_time timestamptz, is_admin boolean, is_blocked boolean, plan text, started boolean)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := joe_private.require_user();
  inserted integer;
begin
  insert into joe_private.accounts (user_id, expires_at, plan, trial_claimed_at)
  values (uid, now() + interval '7 days', 'trial', now())
  on conflict (user_id) do nothing;
  get diagnostics inserted = row_count;
  return query
    select a.expires_at, now(),
           exists(select 1 from joe_private.admins ad where ad.user_id = uid),
           a.is_blocked, a.plan, inserted = 1
    from joe_private.accounts a where a.user_id = uid;
end;
$function$;

create or replace function public.msap_redeem_code(p_code text)
returns table (expires_at timestamptz, server_time timestamptz)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := joe_private.require_user();
  c joe_private.codes%rowtype;
  expiry timestamptz;
begin
  perform public.msap_my_entitlement();
  if exists (select 1 from joe_private.accounts a where a.user_id = uid and a.is_blocked) then
    raise exception 'Account blocked';
  end if;
  select * into c from joe_private.codes
  where code_hash = extensions.digest(upper(regexp_replace(p_code, '[[:space:]-]', '', 'g')), 'sha256')
  for update;
  if not found or c.redeemed_at is not null or c.revoked_at is not null then
    raise exception 'Invalid or unavailable code';
  end if;
  update joe_private.accounts a
    set expires_at = now() + make_interval(secs => c.duration_seconds), plan = c.kind
    where a.user_id = uid returning a.expires_at into expiry;
  update joe_private.codes set redeemed_at = now(), redeemed_by = uid where joe_private.codes.id = c.id;
  return query select expiry, now();
end;
$function$;

create or replace function public.msap_create_code(p_duration_seconds integer, p_kind text)
returns table (code text, id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  raw text;
  new_id uuid;
  created timestamptz;
begin
  perform joe_private.require_admin();
  if p_kind not in ('trial', 'premium') or p_duration_seconds not between 60 and 315360000 then
    raise exception 'Invalid license duration or kind';
  end if;
  raw := upper(encode(extensions.gen_random_bytes(20), 'hex'));
  insert into joe_private.codes (code_hash, kind, duration_seconds)
  values (extensions.digest(raw, 'sha256'), p_kind, p_duration_seconds)
  returning joe_private.codes.id, joe_private.codes.created_at into new_id, created;
  return query select raw, new_id, created;
end;
$function$;

create or replace function public.msap_admin_users()
returns table (user_id uuid, email text, created_at timestamptz, expires_at timestamptz, is_blocked boolean, plan text)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform joe_private.require_admin();
  return query
    select u.id, u.email::text, u.created_at, a.expires_at, coalesce(a.is_blocked, false), a.plan
    from auth.users u
    left join joe_private.accounts a on a.user_id = u.id
    order by u.created_at desc;
end;
$function$;

create or replace function public.msap_admin_trial_claims()
returns table (user_id uuid, email text, claimed_at timestamptz)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform joe_private.require_admin();
  return query
    select a.user_id, u.email::text, a.trial_claimed_at
    from joe_private.accounts a
    join auth.users u on u.id = a.user_id
    where a.trial_claimed_at is not null
    order by a.trial_claimed_at desc;
end;
$function$;

create or replace function public.msap_admin_set_expiry(p_user_id uuid, p_expires_at timestamptz)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform joe_private.require_admin();
  insert into joe_private.accounts (user_id, expires_at, plan)
  values (p_user_id, p_expires_at, 'premium')
  on conflict (user_id) do update set expires_at = excluded.expires_at, plan = 'premium';
end;
$function$;

create or replace function public.msap_admin_set_blocked(p_user_id uuid, p_blocked boolean)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform joe_private.require_admin();
  if p_user_id = auth.uid() and p_blocked then
    raise exception 'Cannot block your own account';
  end if;
  insert into joe_private.accounts (user_id, is_blocked)
  values (p_user_id, p_blocked)
  on conflict (user_id) do update set is_blocked = excluded.is_blocked;
end;
$function$;

create or replace function public.msap_admin_codes()
returns table (id uuid, kind text, duration_seconds integer, created_at timestamptz, redeemed_at timestamptz, redeemed_by uuid, revoked_at timestamptz)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform joe_private.require_admin();
  return query
    select c.id, c.kind, c.duration_seconds, c.created_at, c.redeemed_at, c.redeemed_by, c.revoked_at
    from joe_private.codes c
    order by c.created_at desc;
end;
$function$;

create or replace function public.msap_admin_revoke_code(p_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform joe_private.require_admin();
  update joe_private.codes c
    set revoked_at = now()
    where c.id = p_id and c.redeemed_at is null and c.revoked_at is null;
  if not found then
    raise exception 'Key not found or already used';
  end if;
end;
$function$;

-- Safety net that production already runs: new public tables get RLS on
-- creation so a future migration cannot ship an open table by accident.
do $$
begin
  create event trigger rls_auto_enable
    on ddl_command_end
    when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
    execute function public.rls_auto_enable();
exception
  when duplicate_object then null;
end $$;

-- The device relay: `commands` keeps its authenticated-only policies. Clients
-- (anon publishable key) reach it exclusively through the deployed
-- `joe-command-validate` edge function, which reads SUPABASE_URL +
-- JOE_SERVICE_ROLE_KEY from project secrets.
