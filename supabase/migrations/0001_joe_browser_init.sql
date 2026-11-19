-- Joe Browser · control-plane schema
-- Applied to Supabase project rajxyaatbvlrxxzjntmo ("Joe Browser").
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member','viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.proxies (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  protocol text not null check (protocol in ('http','https','socks4','socks5','direct')),
  host text, port int, country text default 'XX',
  status text not null default 'unchecked',
  latency_ms int,
  last_checked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  group_name text not null default 'Default',
  tags text[] not null default '{}',
  status text not null default 'ready' check (status in ('ready','running','stopped','error')),
  template_id text not null,
  proxy_id text references public.proxies(id) on delete set null,
  fingerprint jsonb not null,
  revision int not null default 1,
  device text,
  notes text not null default '',
  last_launched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_workspace_idx on public.profiles(workspace_id, created_at desc);
create index if not exists profiles_group_idx on public.profiles(workspace_id, group_name);

create table if not exists public.devices (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('desktop-exe','android-apk','web-dashboard')),
  name text not null,
  platform text, app_version text,
  online boolean not null default false,
  last_seen timestamptz not null default now()
);

create table if not exists public.commands (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  topic text not null,
  from_device text not null,
  to_device text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','delivered','failed')),
  created_at timestamptz not null default now()
);
create index if not exists commands_target_idx on public.commands(workspace_id, to_device, status, created_at);

create table if not exists public.events (
  id bigserial primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null,
  device text,
  message text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists events_recent_idx on public.events(workspace_id, created_at desc);

insert into public.workspaces (id, slug, name)
values ('00000000-0000-0000-0000-000000000001', 'default', 'Default workspace')
on conflict (id) do nothing;

-- Row-level security: only authenticated members of a workspace can access its data.
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.profiles enable row level security;
alter table public.proxies enable row level security;
alter table public.devices enable row level security;
alter table public.commands enable row level security;
alter table public.events enable row level security;

drop policy if exists ws_select on public.workspaces;
create policy ws_select on public.workspaces for select to authenticated using (
  exists (select 1 from public.workspace_members m where m.workspace_id = workspaces.id and m.user_id = auth.uid())
);
drop policy if exists members_select on public.workspace_members;
create policy members_select on public.workspace_members for select to authenticated using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['profiles','proxies','devices','commands','events'] loop
    execute format('drop policy if exists %I on public.%I', t || '_rw', t);
    execute format($f$
      create policy %I on public.%I for all to authenticated
      using (exists (select 1 from public.workspace_members m where m.workspace_id = %I.workspace_id and m.user_id = auth.uid()))
      with check (exists (select 1 from public.workspace_members m where m.workspace_id = %I.workspace_id and m.user_id = auth.uid()))
    $f$, t || '_rw', t, t, t);
  end loop;
end $$;

do $$ begin alter publication supabase_realtime add table public.commands; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.events; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.devices; exception when duplicate_object then null; end $$;

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
