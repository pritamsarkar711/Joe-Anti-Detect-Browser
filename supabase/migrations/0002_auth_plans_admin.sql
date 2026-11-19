-- Joe Browser · 0002 — accounts, entitlements, admin and server-side quota
--
-- Phase 10/11 of the product spec: registration provisioning, a real admin
-- role, and profile limits that are enforced in the database — not only in the
-- shared client core. A modified binary can lie to itself; it cannot lie to
-- Postgres.
--
-- Idempotent: safe to re-run. The admin address below is the owner address the
-- project owner provided and matches ADMIN_EMAIL in packages/core/src/plans.ts
-- (tests/backend.test.ts fails the build if the two ever diverge).

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ entitlements
-- One row per user. plan drives the profile quota; role grants administration.
create table if not exists public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','starter','premium')),
  role text not null default 'member' check (role in ('member','admin')),
  renews_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists entitlements_touch on public.user_entitlements;
create trigger entitlements_touch before update on public.user_entitlements
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------------ roles
-- The owner address, in exactly one place. Kept as a function so RLS policies
-- and triggers can reference it without granting table access.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
         = lower('pritamsarkar1321@gmail.com')
$$;

-- ------------------------------------------------------------------ provisioning
-- Every new account gets: an entitlement row (premium/admin for the owner
-- address, free otherwise) and a personal workspace with an owner membership,
-- so RLS in 0001 immediately isolates one user's data from every other.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ws uuid;
  owner boolean;
begin
  owner := lower(coalesce(new.email, '')) = lower('pritamsarkar1321@gmail.com');

  insert into public.user_entitlements (user_id, plan, role)
  values (new.id,
          case when owner then 'premium' else 'free' end,
          case when owner then 'admin' else 'member' end)
  on conflict (user_id) do nothing;

  insert into public.workspaces (slug, name)
  values ('personal-' || left(replace(new.id::text, '-', ''), 12), 'Personal workspace')
  returning id into ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws, new.id, 'owner')
  on conflict do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ server-side quota
-- Free: 2 profiles. Demo ('starter'): 6. Premium and admin: unlimited.
-- Counted across every workspace the caller belongs to, so splitting workspaces
-- cannot dodge the limit. The exception is the same sentence the client shows.
create or replace function public.enforce_profile_quota() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  allowed int; -- null = unlimited
  used int;
  who uuid := auth.uid();
begin
  -- Service role / internal writes carry no user id and are not subject to
  -- per-user quotas; RLS already blocks anonymous inserts entirely.
  if who is null then return new; end if;
  if public.is_admin() then return new; end if;

  select case e.plan
           when 'premium' then null
           when 'starter' then 6
           else 2
         end
    into allowed
    from public.user_entitlements e
   where e.user_id = who;
  -- No entitlement row yet = the free tier.
  if not found then allowed := 2; end if;

  if allowed is null then return new; end if;

  select count(*) into used
    from public.profiles p
    join public.workspace_members m on m.workspace_id = p.workspace_id
   where m.user_id = who;

  if used + 1 > allowed then
    raise exception 'PROFILE_LIMIT_REACHED: the plan includes % profiles. Upgrade for unlimited — existing profiles are never removed.', allowed
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists profiles_quota_insert on public.profiles;
create trigger profiles_quota_insert
  before insert on public.profiles
  for each row execute function public.enforce_profile_quota();

drop trigger if exists profiles_quota_move on public.profiles;
create trigger profiles_quota_move
  before update of workspace_id on public.profiles
  for each row execute function public.enforce_profile_quota();

-- ------------------------------------------------------------------ entitlement RLS
-- Users read their own row; admins read everything. Writes go through the
-- service role only (back-office, billing webhooks) — there is deliberately no
-- insert/update/delete policy for anon or authenticated, so a client cannot
-- promote itself to premium or admin.
alter table public.user_entitlements enable row level security;

drop policy if exists entitlements_select on public.user_entitlements;
create policy entitlements_select on public.user_entitlements
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

-- ------------------------------------------------------------------ admin surface
-- User management, subscription management and usage monitoring, enforced
-- here rather than by any frontend check.
create or replace function public.admin_list_users()
returns table (
  user_id uuid, email text, plan text, role text,
  profile_count bigint, workspace_count bigint, renews_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;
  return query
    select e.user_id,
           coalesce(u.email, '')::text,
           e.plan,
           e.role,
           (select count(*) from public.profiles p
             join public.workspace_members m on m.workspace_id = p.workspace_id
            where m.user_id = e.user_id),
           (select count(*) from public.workspace_members m2 where m2.user_id = e.user_id),
           e.renews_at
      from public.user_entitlements e
      left join auth.users u on u.id = e.user_id
     order by e.created_at;
end $$;

create or replace function public.admin_set_entitlement(
  target uuid, new_plan text, new_role text default 'member', renews timestamptz default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;
  if new_plan not in ('free','starter','premium') then
    raise exception 'UNKNOWN_PLAN: %', new_plan;
  end if;
  if new_role not in ('member','admin') then
    raise exception 'UNKNOWN_ROLE: %', new_role;
  end if;
  insert into public.user_entitlements (user_id, plan, role, renews_at)
  values (target, new_plan, new_role, renews)
  on conflict (user_id) do update
    set plan = excluded.plan, role = excluded.role, renews_at = excluded.renews_at;
end $$;

-- Client-side truth endpoint: what the server will actually allow right now.
create or replace function public.can_create_profile(additional int default 1)
returns table (allowed boolean, used bigint, remaining bigint, plan text)
language plpgsql stable security definer set search_path = public as $$
declare
  who uuid := auth.uid();
  lim int;
  used_count bigint;
  current_plan text;
begin
  if who is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select case e.plan
           when 'premium' then null
           when 'starter' then 6
           else 2
         end, e.plan
    into lim, current_plan
    from public.user_entitlements e
   where e.user_id = who;
  if not found then lim := 2; current_plan := 'free'; end if;

  select count(*) into used_count
    from public.profiles p
    join public.workspace_members m on m.workspace_id = p.workspace_id
   where m.user_id = who;

  return query select
    (lim is null or used_count + additional <= lim),
    used_count,
    case when lim is null then null else greatest(0, lim - used_count) end,
    current_plan;
end $$;
