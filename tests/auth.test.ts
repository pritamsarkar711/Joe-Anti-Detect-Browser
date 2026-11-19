import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  configureCloudAuth, cloudConfigured, signUpCloud, signInCloud, signOutCloud,
  recoverCloud, updatePasswordCloud, restoreSession, fetchEntitlement,
  accountFromEntitlement, normalizeSession, resetCloudAuthForTests,
} from '../src/state/supabaseAuth';
import { ADMIN_EMAIL } from '@joe/core';

/**
 * Cloud auth is real HTTP against Supabase — these tests drive it through a
 * stubbed fetch so every flow (sign-up, sign-in, refresh, recovery, logout,
 * entitlement lookup) is verified without a network or a live project.
 */

const store = new Map<string, string>();
const localStorageStub = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
};
(globalThis as Record<string, unknown>).localStorage = localStorageStub;

interface Call { url: string; method: string; body: unknown; auth?: string }
let calls: Call[] = [];
let respond: (url: string) => { status: number; body: unknown };

function installFetch() {
  calls = [];
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({
      url,
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : null,
      auth: headers.Authorization,
    });
    const { status, body } = respond(url);
    return {
      status,
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
}

const TOKEN_BODY = {
  access_token: 'at-123',
  refresh_token: 'rt-456',
  expires_in: 3600,
  user: { id: 'u-1', email: 'someone@example.com' },
};

beforeEach(() => {
  resetCloudAuthForTests();
  store.clear();
  configureCloudAuth('https://proj.supabase.co', 'anon-public-key');
  installFetch();
  respond = () => ({ status: 200, body: {} });
});

describe('cloud configuration', () => {
  it('only accepts an https project URL with a key', () => {
    expect(cloudConfigured()).toBe(true);
    expect(configureCloudAuth('http://proj.supabase.co', 'key')).toBe(false);
    expect(cloudConfigured()).toBe(false);
    expect(configureCloudAuth('https://proj.supabase.co/', '  ')).toBe(false);
    expect(cloudConfigured()).toBe(false);
    // Trailing slashes are tolerated.
    expect(configureCloudAuth('https://proj.supabase.co/', 'key')).toBe(true);
  });
});

describe('sign-up and sign-in', () => {
  it('signs up and stores the session when the server returns one', async () => {
    respond = () => ({ status: 200, body: TOKEN_BODY });
    const r = await signUpCloud('someone@example.com', 'password123');
    expect(r.error).toBeNull();
    expect(r.session?.user.id).toBe('u-1');
    expect(calls[0].url).toBe('https://proj.supabase.co/auth/v1/signup');
    expect(calls[0].body).toEqual({ email: 'someone@example.com', password: 'password123' });
    const restored = await restoreSession();
    expect(restored?.accessToken).toBe('at-123');
  });

  it('reports email confirmation when no session comes back', async () => {
    respond = () => ({ status: 200, body: { id: 'u-1', email: 'someone@example.com' } });
    const r = await signUpCloud('someone@example.com', 'password123');
    expect(r.error).toBeNull();
    expect(r.needsConfirmation).toBe(true);
    expect(r.session).toBeUndefined();
  });

  it('surfaces the server error message on a failed sign-in', async () => {
    respond = () => ({ status: 400, body: { error_description: 'Invalid login credentials' } });
    const r = await signInCloud('someone@example.com', 'wrong');
    expect(r.error).toBe('Invalid login credentials');
  });

  it('reports a network failure without inventing a session', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    const r = await signInCloud('someone@example.com', 'password123');
    expect(r.error).toBe('Could not reach the account server.');
  });
});

describe('session lifecycle', () => {
  it('refreshes an expired access token exactly once', async () => {
    respond = () => ({ status: 200, body: TOKEN_BODY });
    await signInCloud('someone@example.com', 'password123');
    calls = [];

    // Age the stored session past expiry.
    const raw = JSON.parse(store.get('joe-browser:auth')!);
    raw.expiresAt = Date.now() - 1000;
    store.set('joe-browser:auth', JSON.stringify(raw));

    respond = () => ({ status: 200, body: { ...TOKEN_BODY, access_token: 'at-fresh' } });
    const session = await restoreSession();
    expect(session?.accessToken).toBe('at-fresh');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/auth/v1/token?grant_type=refresh_token');
    expect(calls[0].body).toEqual({ refresh_token: 'rt-456' });

    // A second restore inside the fresh window makes no call.
    calls = [];
    await restoreSession();
    expect(calls).toHaveLength(0);
  });

  it('drops the session when the server rejects the refresh', async () => {
    respond = () => ({ status: 200, body: TOKEN_BODY });
    await signInCloud('someone@example.com', 'password123');
    const raw = JSON.parse(store.get('joe-browser:auth')!);
    raw.expiresAt = Date.now() - 1000;
    store.set('joe-browser:auth', JSON.stringify(raw));

    respond = () => ({ status: 400, body: { error_description: 'Invalid refresh token' } });
    expect(await restoreSession()).toBeNull();
    expect(store.get('joe-browser:auth')).toBeUndefined();
  });

  it('clears the session on sign-out and calls the server', async () => {
    respond = () => ({ status: 200, body: TOKEN_BODY });
    await signInCloud('someone@example.com', 'password123');
    calls = [];
    respond = () => ({ status: 204, body: null });
    await signOutCloud();
    expect(store.get('joe-browser:auth')).toBeUndefined();
    expect(calls[0].url).toContain('/auth/v1/logout');
    expect(calls[0].auth).toBe('Bearer at-123');
  });

  it('rejects malformed stored sessions instead of trusting them', () => {
    expect(normalizeSession(null)).toBeNull();
    expect(normalizeSession({ accessToken: 'x' })).toBeNull();
    expect(normalizeSession({ ...TOKEN_BODY })).toBeNull(); // token response is not a stored session
    expect(normalizeSession({
      accessToken: 'a', refreshToken: 'b', expiresAt: 1, user: { id: 'u', email: 'e' },
    })?.user.id).toBe('u');
  });
});

describe('password recovery and change', () => {
  it('posts the recovery request to the configured project', async () => {
    respond = () => ({ status: 200, body: {} });
    const r = await recoverCloud('someone@example.com');
    expect(r.error).toBeNull();
    expect(calls[0].url).toContain('/auth/v1/recover');
    expect(calls[0].body).toEqual({ email: 'someone@example.com' });
  });

  it('changes the password on the current session', async () => {
    respond = () => ({ status: 200, body: TOKEN_BODY });
    await signInCloud('someone@example.com', 'password123');
    calls = [];
    respond = () => ({ status: 200, body: {} });
    const r = await updatePasswordCloud('newpassword9');
    expect(r.error).toBeNull();
    expect(calls[0].url).toContain('/auth/v1/user');
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].auth).toBe('Bearer at-123');
  });
});

describe('entitlements', () => {
  it('reads the server row and maps it to an account', async () => {
    respond = (url) => url.includes('/rest/v1/user_entitlements')
      ? { status: 200, body: [{ plan: 'premium', role: 'member', renews_at: '2027-01-01T00:00:00Z' }] }
      : { status: 200, body: TOKEN_BODY };
    await signInCloud('someone@example.com', 'password123');
    calls = [];
    const session = await restoreSession();
    const ent = await fetchEntitlement(session!);
    expect(ent).toEqual({ plan: 'premium', role: 'member', renewsAt: '2027-01-01T00:00:00Z' });
    expect(calls[0].url).toContain('user_id=eq.u-1');
    expect(calls[0].auth).toBe('Bearer at-123');

    const account = accountFromEntitlement('someone@example.com', ent);
    expect(account).toEqual({ plan: 'premium', role: 'member', renewsAt: '2027-01-01T00:00:00Z' });
  });

  it('falls back to free when the table is missing or empty', async () => {
    respond = () => ({ status: 404, body: { message: 'relation missing' } });
    const session = { accessToken: 'a', refreshToken: 'b', expiresAt: Date.now() + 60_000, user: { id: 'u', email: 'e' } };
    expect(await fetchEntitlement(session)).toBeNull();
    expect(accountFromEntitlement('someone@example.com', null)).toEqual({ plan: 'free', role: 'member', renewsAt: null });
  });

  it('gives the owner address full access regardless of the stored row', () => {
    const account = accountFromEntitlement(ADMIN_EMAIL.toUpperCase(), { plan: 'free', role: 'member', renewsAt: null });
    expect(account.plan).toBe('premium');
    expect(account.role).toBe('owner');
  });
});
