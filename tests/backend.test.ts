import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ADMIN_EMAIL, FREE_PROFILE_LIMIT, DEMO_PROFILE_LIMIT, PLANS } from '@joe/core';

/**
 * Backend enforcement (supabase/migrations).
 *
 * The product spec requires plan limits and admin permissions to be enforced
 * server-side. These are static assertions against the migration files — no
 * live Postgres is available in this environment — but they pin the exact
 * policy shapes a release depends on, and they fail the build the moment the
 * SQL and the shared client core disagree about the owner address or limits.
 * Runtime verification of the policies is recorded in docs/VALIDATION.md.
 */
const root = path.resolve(__dirname, '..');
const sql = readFileSync(path.join(root, 'supabase/migrations/0002_auth_plans_admin.sql'), 'utf8');
const init = readFileSync(path.join(root, 'supabase/migrations/0001_joe_browser_init.sql'), 'utf8');

describe('server-side plan enforcement', () => {
  it('creates a per-user entitlement table with constrained plan and role values', () => {
    expect(sql).toContain('create table if not exists public.user_entitlements');
    expect(sql).toMatch(/plan text not null default 'free' check \(plan in \('free','starter','premium'\)\)/);
    expect(sql).toMatch(/role text not null default 'member' check \(role in \('member','admin'\)\)/);
  });

  it('enforces the profile quota in the database, matching the client limits', () => {
    expect(sql).toContain('enforce_profile_quota');
    expect(sql).toContain('before insert on public.profiles');
    // The free limit in SQL must be the same number the UI enforces.
    expect(sql).toMatch(/else 2\s*end/);
    expect(FREE_PROFILE_LIMIT).toBe(2);
    expect(sql).toMatch(/when 'starter' then 6/);
    expect(DEMO_PROFILE_LIMIT).toBe(6);
    expect(PLANS.premium.profileLimit).toBeNull();
    expect(sql).toMatch(/when 'premium' then null/);
    // The error is the sentence the client shows, so users see one truth.
    expect(sql).toContain('PROFILE_LIMIT_REACHED');
    expect(sql).toContain('existing profiles are never removed');
  });

  it('counts quota across every workspace the user belongs to', () => {
    expect(sql).toMatch(/from public\.profiles p\s+join public\.workspace_members m on m\.workspace_id = p\.workspace_id\s+where m\.user_id = who/);
  });

  it('exposes a server-truth quota RPC for clients to consult', () => {
    expect(sql).toContain('create or replace function public.can_create_profile');
    expect(sql).toContain('AUTH_REQUIRED');
  });
});

describe('server-side admin enforcement', () => {
  it('recognises exactly the owner-provided admin address', () => {
    // The literal must match the shared core; a divergence would lock the
    // owner out of the backend while the UI (wrongly) shows owner access.
    expect(sql.toLowerCase()).toContain(ADMIN_EMAIL.toLowerCase());
    expect(sql).toContain('create or replace function public.is_admin()');
  });

  it('provisions new accounts with an entitlement and an isolated workspace', () => {
    expect(sql).toContain('handle_new_user');
    expect(sql).toContain('create trigger on_auth_user_created');
    expect(sql).toContain('insert into public.user_entitlements');
    expect(sql).toContain('insert into public.workspace_members');
  });

  it('keeps admin actions on the backend with ADMIN_ONLY guards', () => {
    expect(sql).toContain('create or replace function public.admin_list_users');
    expect(sql).toContain('create or replace function public.admin_set_entitlement');
    expect((sql.match(/ADMIN_ONLY/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(sql).toContain("using errcode = '42501'");
  });
});

describe('row-level security', () => {
  it('lets users read only their own entitlement and never write it', () => {
    expect(sql).toContain('alter table public.user_entitlements enable row level security');
    expect(sql).toMatch(/create policy entitlements_select on public\.user_entitlements\s+for select to authenticated\s+using \(user_id = \(select auth\.uid\(\)\) or public\.is_admin\(\)\)/);
    // No write policy for anon or authenticated exists anywhere in 0002.
    expect(sql).not.toMatch(/create policy \w+ on public\.user_entitlements\s+for (insert|update|delete)/);
    expect(sql).not.toMatch(/for all to (anon|authenticated)[\s\S]{0,200}user_entitlements/);
  });

  it('keeps 0001 workspace-scoped isolation in place', () => {
    for (const table of ['profiles', 'proxies', 'devices', 'commands', 'events']) {
      expect(init).toContain(`alter table public.${table} enable row level security`);
    }
    expect(init).toContain('workspace_members');
    expect(init).toMatch(/m\.user_id = auth\.uid\(\)/);
  });

  it('attaches the quota trigger to inserts and workspace moves', () => {
    expect(sql).toContain('create trigger profiles_quota_insert');
    expect(sql).toContain('create trigger profiles_quota_move');
    expect(sql).toContain('before update of workspace_id on public.profiles');
  });

  it('uses definer-scoped functions with a pinned search_path', () => {
    const definers = sql.match(/security definer set search_path = public/g) ?? [];
    expect(definers.length).toBeGreaterThanOrEqual(5);
    expect(sql).not.toMatch(/security definer(?!\s+set search_path)/);
  });
});
