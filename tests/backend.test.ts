import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  FREE_PROFILE_LIMIT, DEMO_PROFILE_LIMIT, OWNER_EMAIL, PLANS,
} from '@joe/core';

/**
 * Core ⇄ database policy pins.
 *
 * The shared core and `supabase/migrations/0002_entitlements.sql` must agree on
 * the plan numbers and the owner bootstrap value. If either side changes alone,
 * the client will describe a plan the database does not enforce (or the reverse)
 * — the exact failure mode that made the pre-3.2.0 limits advisory-only.
 * Structural schema rules are covered by tests/schema.test.ts.
 */

const root = path.resolve(__dirname, '..');
const sql = readFileSync(path.join(root, 'supabase', 'migrations', '0002_entitlements.sql'), 'utf8');

describe('core and database agree on plan policy', () => {
  it('exports the demo limit from the shared core', () => {
    expect(DEMO_PROFILE_LIMIT).toBe(6);
    expect(FREE_PROFILE_LIMIT).toBe(2);
    expect(PLANS.free.profileLimit).toBe(FREE_PROFILE_LIMIT);
    expect(PLANS.premium.profileLimit).toBeNull();
  });

  it('pins the free profile quota to the same number the database enforces', () => {
    // my_entitlement() falls back to `profile_limit, 2` for a missing row and
    // enforce_profile_quota() derives its limit from the same column.
    expect(sql).toMatch(/'plan', 'free', 'is_admin', false, 'profile_limit', 2,/);
    expect(sql).toMatch(/create or replace function public\.enforce_profile_quota\(\)/);
    expect(sql).toMatch(/create trigger profiles_quota/);
  });

  it('seeds the admin roster with the exact owner bootstrap address', () => {
    expect(OWNER_EMAIL).toBe('pritamsarkar1321@gmail.com');
    expect(sql.toLowerCase()).toContain(OWNER_EMAIL.toLowerCase());
  });

  it('keeps entitlements read-only to users in both worlds', () => {
    // No client policy may write plan state: the client cannot raise its tier.
    expect(sql).not.toMatch(/create policy[^;]*on public\.entitlements[^;]*for (insert|update|delete|all)/i);
    expect(sql).not.toMatch(/create policy[^;]*on public\.app_admins/i);
  });
});
