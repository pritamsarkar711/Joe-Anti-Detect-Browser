import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  FREE_PROFILE_LIMIT, DEMO_PROFILE_LIMIT, PLANS,
} from '@joe/core';

/**
 * Core ⇄ database policy pins.
 *
 * The shared core and `supabase/migrations/0002_accounts_and_licensing.sql`
 * must agree on the plan numbers. If either side changes alone, the client will
 * describe a plan the database does not enforce (or the reverse) — the exact
 * failure mode that made the pre-3.2.0 limits advisory-only. Structural schema
 * rules are covered by tests/schema.test.ts.
 */

const root = path.resolve(__dirname, '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const sql = readFileSync(path.join(migrationsDir, '0002_accounts_and_licensing.sql'), 'utf8');

describe('core and database agree on plan policy', () => {
  it('ships exactly the expected migrations', () => {
    expect(files).toEqual(['0001_joe_browser_init.sql', '0002_accounts_and_licensing.sql']);
  });

  it('exports the plan limits from the shared core', () => {
    expect(DEMO_PROFILE_LIMIT).toBe(6);
    expect(FREE_PROFILE_LIMIT).toBe(2);
    expect(PLANS.free.profileLimit).toBe(FREE_PROFILE_LIMIT);
    expect(PLANS.premium.profileLimit).toBeNull();
  });

  it('pins the profile quotas to the same numbers the database provisions', () => {
    // handle_new_account() resolves the limit at signup:
    // free -> 2, starter -> 6, premium/owner -> null (unlimited).
    expect(sql).toMatch(/case resolved when 'free' then 2 when 'starter' then 6 else null end/);
    expect(sql).toMatch(/create or replace function public\.handle_new_account\(\)/);
    expect(sql).toMatch(/create or replace function public\.guard_account_plan\(\)/);
  });

  it('keeps plan state out of every client role', () => {
    // The allowlist decides who is premium/owner; only the SECURITY DEFINER
    // signup trigger may read it and nobody but the database owner may write.
    expect(sql).toMatch(/revoke all on public\.account_allowlist from anon, authenticated/);
    expect(sql).toMatch(/new\.profile_limit := old\.profile_limit/);
  });
});
