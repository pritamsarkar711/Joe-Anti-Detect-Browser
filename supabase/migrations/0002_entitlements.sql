-- Joe Browser · server-side entitlement, workspace bootstrap and tenant keys
-- ---------------------------------------------------------------------------
-- Why this migration exists
--
-- 0001 created the control-plane tables and enabled RLS, but nothing ever made a
-- user a workspace member: `workspace_members` had a SELECT policy and no way to
-- insert. Every authenticated query was therefore denied, so the documented
-- EXE ⇄ APK sync could not work for any account. It also left the plan entirely
-- in the client, where it was editable.
--
-- This migration makes the server the source of truth:
--   * every auth user gets a personal workspace and an owner membership;
--   * `my_entitlement()` is the only way to read a plan or the admin flag;
--   * `entitlements` and `app_admins` are read-only to users (service-role only);
--   * a trigger refuses profile inserts above the caller's plan limit;
--   * primary keys are scoped to the workspace, because profile ids are
--     deterministic and two users creating "Profile 001" produced the same id.
--
-- Idempotent: safe to re-run. Apply with the Supabase CLI (`supabase db push`)
-- or paste into the SQL editor of the project named in README → Sync.

-- ---------------------------------------------------------------------------
-- 1. Administrator roster (bootstrap only, never a client-side check)
-- ---------------------------------------------------------------------------
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  granted_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
-- Deliberately no policies: the table is readable only through is_admin()
-- (SECURITY DEFINER) and writable only by the service role.

-- Seed the owner once the account exists. The email is a bootstrap value; it is
-- not used for authorisation anywhere in the client.
insert into public.app_admins (user_id, email)
select u.id, u.email
from auth.users u
where lower(u.email) = lower('pritamsarkar1321@gmail.com')
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Entitlements: server-assigned plan, read-only for users
-- ---------------------------------------------------------------------------
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'starter', 'premium')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled')),
  renews_at timestamptz,
  note text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;

drop policy if exists entitlements_select on public.entitlements;
create policy entitlements_select on public.entitlements
  for select to authenticated using (user_id = auth.uid());
-- No INSERT/UPDATE/DELETE policy on purpose. A user can read their own row and
-- cannot change it; upgrades happen through the service role (an administrator
-- or a payment webhook), which bypasses RLS.

drop trigger if exists entitlements_touch on public.entitlements;
create trigger entitlements_touch before update on public.entitlements
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Workspace bootstrap
-- ---------------------------------------------------------------------------
create or replace function public.ensure_user_workspace(uid uuid, email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  wid uuid;
begin
  select m.workspace_id into wid
    from public.workspace_members m
   where m.user_id = uid
   order by m.created_at
   limit 1;
  if wid is not null then
    return wid;
  end if;

  insert into public.workspaces (slug, name)
  values ('u-' || replace(uid::text, '-', ''), coalesce(nullif(email, ''), 'Personal workspace'))
  on conflict (slug) do update set name = public.workspaces.name
  returning id into wid;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (wid, uid, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  return wid;
end $$;

revoke all on function public.ensure_user_workspace(uuid, text) from public;

create or replace function public.bootstrap_user_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_user_workspace(new.id, new.email);
  return new;
end $$;

drop trigger if exists joe_bootstrap_workspace on auth.users;
create trigger joe_bootstrap_workspace
  after insert on auth.users
  for each row execute function public.bootstrap_user_workspace();

-- Backfill accounts that signed up before this migration.
do $$
declare
  u record;
begin
  for u in select id, email from auth.users loop
    perform public.ensure_user_workspace(u.id, u.email);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Read helpers
-- ---------------------------------------------------------------------------
create or replace function public.my_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.workspace_id
    from public.workspace_members m
   where m.user_id = auth.uid()
   order by m.created_at
   limit 1;
$$;
revoke all on function public.my_workspace_id() from public;
grant execute on function public.my_workspace_id() to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

/**
 * The only authority on plan and role.
 *
 * Returns `verified: false` for an anonymous caller, and the client treats that
 * as "local tier". `profile_limit = null` means unlimited and is emitted only for
 * premium or an administrator; a missing row is always `free` with 2.
 */
create or replace function public.my_entitlement()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  admin boolean := false;
  plan_id text := 'free';
  renews timestamptz;
  lim int;
begin
  if uid is null then
    return jsonb_build_object(
      'plan', 'free', 'is_admin', false, 'profile_limit', 2,
      'renews_at', null, 'verified', false
    );
  end if;

  admin := public.is_admin();

  select case when e.status in ('active', 'trialing') then e.plan else 'free' end,
         e.renews_at
    into plan_id, renews
    from public.entitlements e
   where e.user_id = uid;

  plan_id := coalesce(plan_id, 'free');
  if admin then
    plan_id := 'premium';
  end if;

  lim := case plan_id
           when 'premium' then null
           when 'starter' then 6
           else 2
         end;

  return jsonb_build_object(
    'plan', plan_id,
    'is_admin', admin,
    'profile_limit', lim,
    'renews_at', renews,
    'verified', true
  );
end $$;
revoke all on function public.my_entitlement() from public;
grant execute on function public.my_entitlement() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Quota enforcement (server-side, not a UI hide)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_profile_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lim int;
  used int;
  plan_id text := 'free';
begin
  -- Service role (migrations, admin tooling, payment webhooks) is never capped.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  select case when e.status in ('active', 'trialing') then e.plan else 'free' end
    into plan_id
    from public.entitlements e
   where e.user_id = auth.uid();

  lim := case coalesce(plan_id, 'free')
           when 'premium' then null
           when 'starter' then 6
           else 2
         end;

  if lim is null then
    return new;
  end if;

  select count(*) into used from public.profiles where workspace_id = new.workspace_id;
  if used >= lim then
    raise exception 'profile quota reached: this plan allows % profile(s)', lim
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists profiles_quota on public.profiles;
create trigger profiles_quota
  before insert on public.profiles
  for each row execute function public.enforce_profile_quota();

-- ---------------------------------------------------------------------------
-- 6. Tenant-scoped keys
-- ---------------------------------------------------------------------------
-- Profile ids are deterministic (`prf_…` from a seed), and 0001 made them global
-- primary keys. Two users creating "Profile 001" therefore collided, and one
-- workspace's proxy reference could point at another workspace's row. Keys are
-- now scoped to the workspace.

alter table public.profiles drop constraint if exists profiles_proxy_id_fkey;
alter table public.profiles drop constraint if exists profiles_proxy_fk;

alter table public.proxies drop constraint if exists proxies_pkey;
alter table public.proxies add constraint proxies_pkey primary key (workspace_id, id);

alter table public.profiles drop constraint if exists profiles_pkey;
alter table public.profiles add constraint profiles_pkey primary key (workspace_id, id);

alter table public.devices drop constraint if exists devices_pkey;
alter table public.devices add constraint devices_pkey primary key (workspace_id, id);

alter table public.commands drop constraint if exists commands_pkey;
alter table public.commands add constraint commands_pkey primary key (workspace_id, id);

-- A proxy is referenced inside its own workspace only. Deleting a proxy clears
-- the reference (the trigger below) instead of failing on the constraint.
alter table public.profiles
  add constraint profiles_proxy_fk foreign key (workspace_id, proxy_id)
  references public.proxies (workspace_id, id);

create or replace function public.clear_profile_proxy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set proxy_id = null, updated_at = now()
   where workspace_id = old.workspace_id
     and proxy_id = old.id;
  return old;
end $$;

drop trigger if exists proxies_clear_refs on public.proxies;
create trigger proxies_clear_refs
  before delete on public.proxies
  for each row execute function public.clear_profile_proxy();

-- Inserts may omit workspace_id; the default resolves the caller's workspace so
-- a client cannot write into a workspace it is not a member of.
alter table public.profiles alter column workspace_id set default public.my_workspace_id();
alter table public.proxies alter column workspace_id set default public.my_workspace_id();
alter table public.devices alter column workspace_id set default public.my_workspace_id();
alter table public.commands alter column workspace_id set default public.my_workspace_id();
alter table public.events alter column workspace_id set default public.my_workspace_id();

-- ---------------------------------------------------------------------------
-- 7. Report
-- ---------------------------------------------------------------------------
do $$
declare
  missing text;
begin
  select string_agg(t, ', ') into missing
    from unnest(array['workspaces', 'workspace_members', 'profiles', 'proxies',
                      'devices', 'commands', 'events', 'entitlements', 'app_admins']) t
   where not exists (
     select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = t and c.relrowsecurity
   );
  if missing is not null then
    raise exception 'RLS is not enabled on: %', missing;
  end if;
  raise notice 'Joe Browser 0002 applied: RLS on every table, entitlement + quota server-side';
end $$;
