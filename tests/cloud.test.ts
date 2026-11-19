import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CloudError, ENTITLEMENT_GRACE_MS, cacheEntitlement, ensureFreshSession, fetchEntitlement,
  isConfigured, loadCachedEntitlement, loadSession, localEntitlement, looksLikeServiceRoleKey,
  needsRefresh, normalizeConfig, parseEntitlement, refreshSession, saveSession,
  sendRecoveryEmail, signInWithPassword, signOut, signUp,
  type CloudConfig, type CloudSession,
} from '../src/state/cloud';

const CONFIG: CloudConfig = { url: 'https://demo.supabase.co', anonKey: 'anon-key' };

/** A JWT-shaped string with the given role claim (never a real key). */
function jwtWithRole(role: string): string {
  const payload = Buffer.from(JSON.stringify({ role })).toString('base64url');
  return `header.${payload}.signature`;
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function session(overrides: Partial<CloudSession> = {}): CloudSession {
  return {
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresAt: Date.now() + 60 * 60 * 1000,
    user: { id: 'u1', email: 'user@example.com' },
    ...overrides,
  };
}

/** Minimal localStorage so the persistence helpers are exercised, not skipped. */
function installMemoryStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => { map.clear(); },
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  return storage;
}

describe('cloud configuration', () => {
  it('trims the URL and refuses a malformed one', () => {
    expect(normalizeConfig({ url: ' https://x.supabase.co/ ', anonKey: ' k ' })).toEqual({ url: 'https://x.supabase.co', anonKey: 'k' });
    expect(normalizeConfig({ url: 'not a url', anonKey: 'k' }).url).toBe('');
    expect(isConfigured({ url: 'https://x.supabase.co', anonKey: 'k' })).toBe(true);
    expect(isConfigured({ url: 'https://x.supabase.co', anonKey: '' })).toBe(false);
    expect(isConfigured(null)).toBe(false);
  });

  it('detects a service-role key so it can be refused in the client', () => {
    expect(looksLikeServiceRoleKey(jwtWithRole('service_role'))).toBe(true);
    expect(looksLikeServiceRoleKey(jwtWithRole('anon'))).toBe(false);
    expect(looksLikeServiceRoleKey('sb_publishable_abc')).toBe(false);
    expect(looksLikeServiceRoleKey('')).toBe(false);
    expect(looksLikeServiceRoleKey('a.b.c')).toBe(false);
  });
});

describe('authentication', () => {
  it('exchanges a password for a session with the server endpoint', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, {
      access_token: 'tok', refresh_token: 'ref', expires_in: 3600,
      user: { id: 'u1', email: 'user@example.com' },
    }));
    const result = await signInWithPassword(CONFIG, 'user@example.com', 'secret', fetchImpl as never);
    expect(result.user.email).toBe('user@example.com');
    expect(result.accessToken).toBe('tok');
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://demo.supabase.co/auth/v1/token?grant_type=password');
    expect((init.headers as Record<string, string>).apikey).toBe('anon-key');
    expect(JSON.parse(String(init.body))).toEqual({ email: 'user@example.com', password: 'secret' });
  });

  it('maps a rejected password to a readable error instead of a silent pass', async () => {
    const fetchImpl = async () => jsonResponse(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
    await expect(signInWithPassword(CONFIG, 'a@b.co', 'wrong', fetchImpl as never))
      .rejects.toMatchObject({ code: 'invalid_credentials' });
  });

  it('reports an unconfirmed email distinctly from a wrong password', async () => {
    const fetchImpl = async () => jsonResponse(400, { msg: 'Email not confirmed' });
    await expect(signInWithPassword(CONFIG, 'a@b.co', 'pw', fetchImpl as never))
      .rejects.toMatchObject({ code: 'email_not_confirmed' });
  });

  it('treats a network failure as a network error, never as success', async () => {
    const fetchImpl = async () => { throw new Error('offline'); };
    await expect(signInWithPassword(CONFIG, 'a@b.co', 'pw', fetchImpl as never))
      .rejects.toMatchObject({ code: 'network' });
  });

  it('signs up and reports when confirmation is still required', async () => {
    const fetchImpl = async () => jsonResponse(200, { user: { id: 'u1', email: 'a@b.co' } });
    const result = await signUp(CONFIG, 'a@b.co', 'password1', fetchImpl as never);
    expect(result.session).toBeNull();
    expect(result.confirmationRequired).toBe(true);
  });

  it('does not claim a reset email was sent when no project is configured', async () => {
    await expect(sendRecoveryEmail({ url: '', anonKey: '' }, 'a@b.co'))
      .rejects.toMatchObject({ code: 'not_configured' });
  });

  it('survives a logout with no network', async () => {
    const fetchImpl = async () => { throw new Error('offline'); };
    await expect(signOut(CONFIG, session(), fetchImpl as never)).resolves.toBeUndefined();
  });
});

describe('session lifetime', () => {
  it('refreshes an expired token and keeps the identity when the server omits it', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { access_token: 'new', refresh_token: 'ref2', expires_in: 3600 }));
    const result = await refreshSession(CONFIG, session({ expiresAt: Date.now() - 1000 }), fetchImpl as never);
    expect(result?.accessToken).toBe('new');
    expect(result?.user.email).toBe('user@example.com');
  });

  it('returns null when the refresh token was revoked', async () => {
    const fetchImpl = async () => jsonResponse(401, { msg: 'Invalid Refresh Token' });
    expect(await refreshSession(CONFIG, session(), fetchImpl as never)).toBeNull();
  });

  it('only refreshes inside the expiry margin', async () => {
    const now = Date.now();
    expect(needsRefresh(session({ expiresAt: now + 30_000 }), now)).toBe(true);
    expect(needsRefresh(session({ expiresAt: now + 600_000 }), now)).toBe(false);
    const fetchImpl = vi.fn(async () => jsonResponse(200, {}));
    const fresh = session({ expiresAt: now + 600_000 });
    expect(await ensureFreshSession(CONFIG, fresh, fetchImpl as never, now)).toBe(fresh);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('server entitlement', () => {
  it('parses the entitlement payload and keeps the administrator flag server-owned', () => {
    const ent = parseEntitlement({ plan: 'premium', is_admin: true, profile_limit: null, renews_at: '2027-01-01T00:00:00Z', verified: true });
    expect(ent).toMatchObject({ plan: 'premium', isAdmin: true, profileLimit: null, source: 'server' });
  });

  it('fails closed when the payload is incomplete', () => {
    expect(parseEntitlement({})).toMatchObject({ plan: 'free', isAdmin: false, profileLimit: 2, source: 'local' });
    // An unknown plan must not become premium.
    expect(parseEntitlement({ plan: 'ultimate', profile_limit: 999 }).plan).toBe('free');
    // A string flag is not a boolean.
    expect(parseEntitlement({ is_admin: 'true' }).isAdmin).toBe(false);
  });

  it('reads the accounts row with the user token, not the anon key alone', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, [{ plan: 'free', unlimited: false, profile_limit: 2 }]));
    await fetchEntitlement(CONFIG, session(), fetchImpl as never);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://demo.supabase.co/rest/v1/accounts?select=plan,unlimited,profile_limit&id=eq.u1&limit=1');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access');
  });

  it('maps the allowlist owner plan to premium plus the administrator flag', async () => {
    const fetchImpl = async () => jsonResponse(200, [{ plan: 'owner', unlimited: true, profile_limit: null }]);
    const ent = await fetchEntitlement(CONFIG, session(), fetchImpl as never);
    expect(ent).toMatchObject({ plan: 'premium', isAdmin: true, profileLimit: null, source: 'server' });
  });

  it('explains a missing migration instead of silently downgrading', async () => {
    const fetchImpl = async () =>
      jsonResponse(404, { message: "Could not find the table 'public.accounts' in the schema cache" });
    await expect(fetchEntitlement(CONFIG, session(), fetchImpl as never))
      .rejects.toMatchObject({ code: 'not_provisioned' });
  });

  it('refuses to invent a plan when the account has no entitlement row', async () => {
    const fetchImpl = async () => jsonResponse(200, []);
    await expect(fetchEntitlement(CONFIG, session(), fetchImpl as never))
      .rejects.toMatchObject({ code: 'not_provisioned' });
  });

  it('defaults every unsynchronised device to the free tier', () => {
    expect(localEntitlement()).toMatchObject({ plan: 'free', isAdmin: false, profileLimit: 2, source: 'local' });
  });
});

describe('persistence', () => {
  beforeEach(() => { installMemoryStorage(); });

  it('round-trips a session and clears it on sign-out', () => {
    saveSession(session());
    expect(loadSession()?.user.email).toBe('user@example.com');
    saveSession(null);
    expect(loadSession()).toBeNull();
  });

  it('never restores one account’s cached plan onto another', () => {
    const ent = { ...localEntitlement(2), plan: 'premium' as const, profileLimit: null, isAdmin: false, source: 'server' as const };
    cacheEntitlement(ent, 'owner@example.com');
    expect(loadCachedEntitlement(Date.now(), 'owner@example.com')?.plan).toBe('premium');
    expect(loadCachedEntitlement(Date.now(), 'someone-else@example.com')).toBeNull();
  });

  it('never restores the administrator role from storage', () => {
    cacheEntitlement({ ...localEntitlement(2), plan: 'premium', profileLimit: null, isAdmin: true, source: 'server' }, 'owner@example.com');
    const cached = loadCachedEntitlement(Date.now(), 'owner@example.com');
    expect(cached?.plan).toBe('premium');
    expect(cached?.isAdmin).toBe(false);
  });

  it('expires the cached plan after the grace window', () => {
    const ent = { ...localEntitlement(2), plan: 'premium' as const, profileLimit: null, source: 'server' as const };
    cacheEntitlement(ent, 'owner@example.com');
    expect(loadCachedEntitlement(Date.now() + ENTITLEMENT_GRACE_MS + 1000, 'owner@example.com')).toBeNull();
  });

  it('does not cache a local (unverified) plan', () => {
    cacheEntitlement(localEntitlement(), 'a@b.co');
    expect(loadCachedEntitlement()).toBeNull();
  });

  it('ignores a corrupted cache entry', () => {
    localStorage.setItem('joe-browser:entitlement:v1', '{not json');
    expect(loadCachedEntitlement()).toBeNull();
  });
});
