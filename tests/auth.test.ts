/**
 * Account entitlement mapping and auth helper tests.
 *
 * `accountFromServer` is the seam between the guarded `public.accounts` row
 * (allowlist-driven plan, trigger-protected columns) and the local Account the
 * UI enforces quotas with — so its mapping is pinned here.
 */
import { describe, expect, it } from 'vitest';
import { accountFromServer, isAdmin, ADMIN_EMAIL, checkProfileQuota, FREE_PROFILE_LIMIT } from '@joe/core';
import { authClient, authErrorMessage } from '@/state/auth';

describe('accountFromServer', () => {
  it('maps the owner plan to a premium owner account', () => {
    const account = accountFromServer({ email: 'Boss@Example.com', plan: 'owner', unlimited: true, profile_limit: null }, 'fallback@example.com');
    expect(account).toEqual({ email: 'boss@example.com', plan: 'premium', role: 'owner', renewsAt: null });
    expect(isAdmin(account)).toBe(true);
  });

  it('recognises an owner even when the address is not the bundled constant', () => {
    // The database is the authority: role owner comes from the allowlist.
    expect(isAdmin(accountFromServer({ plan: 'owner' }, 'someone@else.test'))).toBe(true);
  });

  it('maps premium, starter and free plans', () => {
    expect(accountFromServer({ plan: 'premium' }, 'a@b.co').plan).toBe('premium');
    expect(accountFromServer({ plan: 'starter' }, 'a@b.co').plan).toBe('starter');
    expect(accountFromServer({ plan: 'free', profile_limit: FREE_PROFILE_LIMIT }, 'a@b.co')).toMatchObject({ plan: 'free', role: 'member' });
  });

  it('treats unlimited=true as premium regardless of the label', () => {
    expect(accountFromServer({ plan: 'weird-label', unlimited: true }, 'a@b.co').plan).toBe('premium');
  });

  it('falls back to the session email and free plan when the row is missing', () => {
    expect(accountFromServer(null, 'User@Example.com')).toEqual({
      email: 'user@example.com', plan: 'free', role: 'member', renewsAt: null,
    });
  });

  it('keeps the free quota at the documented limit for a server-free account', () => {
    const account = accountFromServer(null, 'user@example.com');
    const quota = checkProfileQuota(account, FREE_PROFILE_LIMIT, 1);
    expect(quota.allowed).toBe(false);
    expect(quota.reason).toContain('free plan');
  });
});

describe('authClient', () => {
  it('returns null until both keys exist', () => {
    expect(authClient('', 'key')).toBeNull();
    expect(authClient('https://x.supabase.co', '')).toBeNull();
    expect(authClient(undefined, undefined)).toBeNull();
  });

  it('memoizes per credential pair', () => {
    const a = authClient('https://one.supabase.co', 'k1');
    const b = authClient('https://one.supabase.co', 'k1');
    const c = authClient('https://one.supabase.co', 'k2');
    expect(a).not.toBeNull();
    expect(a).toBe(b);
    expect(c).not.toBe(a);
  });
});

describe('authErrorMessage', () => {
  it('translates the common GoTrue failures without leaking internals', () => {
    const translate = (message: string) => authErrorMessage({ message } as never);
    expect(translate('Invalid login credentials')).toBe('Wrong email or password.');
    expect(translate('Email not confirmed')).toBe('Confirm your email first — check your inbox for the link.');
    expect(translate('User already registered')).toBe('That email already has an account. Sign in instead.');
    expect(translate('Password should be at least 6 characters')).toBe('Use at least 6 characters for the password.');
    expect(translate('Rate limit exceeded')).toBe('Too many attempts. Wait a moment and try again.');
    expect(translate('something entirely new')).toBe('Authentication failed. Try again.');
    expect(authErrorMessage(null)).toBe('Authentication failed. Try again.');
  });

  it('never exposes the admin address through error text', () => {
    expect(authErrorMessage({ message: ADMIN_EMAIL } as never)).not.toContain(ADMIN_EMAIL);
  });
});
