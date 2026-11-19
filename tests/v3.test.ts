import { describe, it, expect } from 'vitest';
import {
  PLANS, FREE_PROFILE_LIMIT, OWNER_EMAIL, planFor, isAdmin, isVerifiedAccount, checkProfileQuota,
  browserAllowed, lockedBrowsers, engineRequiresPremium, type Account,
} from '@joe/core';
import { humanPasteSchedule, scheduleDuration, describeSchedule } from '@joe/fingerprint';

const free: Account = { email: 'someone@example.com', plan: 'free', role: 'member', renewsAt: null };
const premium: Account = { email: 'someone@example.com', plan: 'premium', role: 'member', renewsAt: null };
const owner: Account = { email: OWNER_EMAIL, plan: 'premium', role: 'owner', renewsAt: null, verified: true };

describe('plans and entitlements', () => {
  it('keeps the free tier at exactly two lifetime profiles', () => {
    expect(FREE_PROFILE_LIMIT).toBe(2);
    expect(PLANS.free.profileLimit).toBe(2);
    expect(PLANS.free.price).toBe('Lifetime');
    expect(PLANS.premium.profileLimit).toBeNull();
  });

  it('gates the profile count at the free limit without touching existing profiles', () => {
    expect(checkProfileQuota(free, 0).allowed).toBe(true);
    expect(checkProfileQuota(free, 1).allowed).toBe(true);
    expect(checkProfileQuota(free, 2).allowed).toBe(false);
    expect(checkProfileQuota(free, 2).remaining).toBe(0);
    // Bulk create may not overshoot either.
    expect(checkProfileQuota(free, 1, 2).allowed).toBe(false);
    expect(checkProfileQuota(premium, 999).allowed).toBe(true);
    expect(checkProfileQuota(null, 1).allowed).toBe(true);
    expect(checkProfileQuota(null, 5).allowed).toBe(false);
  });

  it('unlocks every engine and unlimited profiles for a server-verified administrator', () => {
    expect(isAdmin(owner)).toBe(true);
    expect(isAdmin(free)).toBe(false);
    expect(planFor(owner).id).toBe('premium');
    expect(checkProfileQuota(owner, 5000).allowed).toBe(true);
    expect(lockedBrowsers(owner)).toHaveLength(0);
  });

  it('refuses administrator rights claimed by email alone', () => {
    // Regression: v3.1.1 compared the typed email with the owner address, so
    // anyone could become the owner by entering it in the sign-in box.
    const forged: Account = { email: OWNER_EMAIL, plan: 'premium', role: 'owner', renewsAt: null };
    expect(isAdmin(forged)).toBe(false);
    expect(planFor(forged).id).toBe('premium'); // the plan string is only a claim
    expect(checkProfileQuota(forged, 5000).allowed).toBe(true);
    // …and the entitlement must be downgraded unless the server said so.
    const unverified: Account = { email: 'a@b.co', plan: 'premium', role: 'member', renewsAt: null };
    expect(isVerifiedAccount(unverified)).toBe(false);
    const verifiedMember: Account = { email: 'a@b.co', plan: 'premium', role: 'member', renewsAt: null, verified: true };
    expect(isAdmin(verifiedMember)).toBe(false);
    expect(isVerifiedAccount(verifiedMember)).toBe(true);
  });

  it('restricts the free tier to the two included engines', () => {
    expect(browserAllowed(free, 'chrome')).toBe(true);
    expect(browserAllowed(free, 'joe')).toBe(true);
    expect(browserAllowed(free, 'brave')).toBe(false);
    expect(lockedBrowsers(free).sort()).toEqual(['brave', 'edge']);
    expect(PLANS.premium.browsers).toEqual(expect.arrayContaining(['joe', 'chrome', 'edge', 'brave']));
    expect(engineRequiresPremium('joe')).toBe(true);
    expect(engineRequiresPremium('chrome')).toBe(false);
  });
});

describe('paste as human', () => {
  it('produces one keystroke per character with bounded pacing', () => {
    const text = 'hello world';
    const schedule = humanPasteSchedule(text, { seed: 7 });
    expect(schedule.filter((k) => k.key === 'char')).toHaveLength([...text].length);
    expect(schedule.every((k) => k.delay >= 4)).toBe(true);
    const ms = scheduleDuration(schedule);
    expect(ms).toBeGreaterThan(100);
    expect(ms).toBeLessThan(60_000);
  });

  it('is deterministic per seed and varies across seeds', () => {
    const a = JSON.stringify(humanPasteSchedule('example text', { seed: 1 }));
    const b = JSON.stringify(humanPasteSchedule('example text', { seed: 1 }));
    const c = JSON.stringify(humanPasteSchedule('example text', { seed: 2 }));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('can emit corrections and never loses the original text', () => {
    const schedule = humanPasteSchedule('typing corrections', { typoChance: 1, seed: 3 });
    expect(schedule.some((k) => k.key === 'Backspace')).toBe(true);
    // Replay the schedule the way a text field would: characters append,
    // Backspace removes the previous one. The field must end up with exactly
    // the text the user pasted.
    let field = '';
    for (const k of schedule) {
      if (k.key === 'Backspace') field = field.slice(0, -1);
      else field += k.char;
    }
    expect(field).toBe('typing corrections');
  });

  it('compresses very long pastes instead of taking minutes', () => {
    const long = 'a'.repeat(2000);
    const short = 'a'.repeat(20);
    const longMs = scheduleDuration(humanPasteSchedule(long, { seed: 5 }));
    const perCharLong = longMs / 2000;
    const perCharShort = scheduleDuration(humanPasteSchedule(short, { seed: 5 })) / 20;
    expect(perCharLong).toBeLessThan(perCharShort);
    expect(describeSchedule(humanPasteSchedule(short, { seed: 5 }))).toMatch(/characters over/);
  });
});
