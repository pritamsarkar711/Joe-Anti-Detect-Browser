/**
 * Supabase account + entitlement client.
 *
 * Why this file exists
 * --------------------
 * v3.1.1 shipped an account screen that *described* hosted auth but never called
 * the server: the email was written to localStorage, any password was accepted,
 * and typing the owner address in the email field unlocked the owner plan. The
 * plan could also be changed with one button, so the free tier was advisory.
 *
 * This module talks to Supabase directly (GoTrue + PostgREST) using `fetch`, so
 * it works unchanged in the browser, the Electron renderer and the Android
 * WebView without adding a dependency or a Node-only code path.
 *
 * Truth model
 * -----------
 * - Identity and plan come from the server: `/auth/v1/token` proves the password
 *   and the caller's row in `public.accounts` (see
 *   supabase/migrations/0002_accounts_and_licensing.sql, applied to the live
 *   project) is the only source of `plan` and the administrator flag. The row
 *   is read with the user's JWT under RLS (`auth.uid() = id`), and the
 *   `guard_account_plan` trigger makes every plan/limit column immutable to
 *   clients.
 * - The anon key is public by design and is never used as a credential of
 *   authority; every privileged read is a user JWT subject to RLS.
 * - When no project is configured, or the migration has not been applied, the
 *   caller gets `verified: false` and the app stays on the local free tier. It
 *   never invents a paid state.
 */

export interface CloudConfig {
  /** Project URL, e.g. https://xyz.supabase.co */
  url: string;
  /** Public anon key. Never a service-role key. */
  anonKey: string;
}

export interface CloudUser {
  id: string;
  email: string;
}

export interface CloudSession {
  accessToken: string;
  refreshToken: string;
  /** epoch milliseconds */
  expiresAt: number;
  user: CloudUser;
}

export type CloudPlan = 'free' | 'starter' | 'premium';

export interface ServerEntitlement {
  /** server-assigned plan */
  plan: CloudPlan;
  /** true only when the server flags this account as an administrator */
  isAdmin: boolean;
  /** null = unlimited */
  profileLimit: number | null;
  renewsAt: string | null;
  /** provenance: server, cached server response, or local/offline */
  source: 'server' | 'cache' | 'local';
  /** epoch ms when the value was fetched (cache/grace reporting) */
  fetchedAt: number;
}

export type CloudErrorCode =
  | 'not_configured'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'weak_password'
  | 'email_taken'
  | 'rate_limited'
  | 'not_provisioned'
  | 'network'
  | 'server'
  | 'expired_session';

export class CloudError extends Error {
  readonly code: CloudErrorCode;
  constructor(code: CloudErrorCode, message: string) {
    super(message);
    this.name = 'CloudError';
    this.code = code;
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const SESSION_KEY = 'joe-browser:session:v1';
const ENTITLEMENT_KEY = 'joe-browser:entitlement:v1';

/** How long a cached entitlement may be trusted while offline. */
export const ENTITLEMENT_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/** Refresh an access token this many ms before it expires. */
export const REFRESH_MARGIN_MS = 60 * 1000;

export function normalizeConfig(config: Partial<CloudConfig> | null | undefined): CloudConfig {
  const url = String(config?.url ?? '').trim().replace(/\/+$/, '');
  const anonKey = String(config?.anonKey ?? '').trim();
  if (url && !/^https?:\/\/[^\s]+$/i.test(url)) return { url: '', anonKey };
  return { url, anonKey };
}

export function isConfigured(config: Partial<CloudConfig> | null | undefined): boolean {
  const c = normalizeConfig(config);
  return Boolean(c.url && c.anonKey);
}

/**
 * A service-role key must never reach a renderer. Supabase keys are JWTs whose
 * payload carries the role, so decode it and refuse anything privileged.
 */
export function looksLikeServiceRoleKey(key: string): boolean {
  const parts = String(key ?? '').split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = JSON.parse(atob(padded)) as { role?: string };
    return decoded.role === 'service_role';
  } catch {
    return false;
  }
}

function headersFor(config: CloudConfig, accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: config.anonKey,
    'Content-Type': 'application/json',
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

function apiError(status: number): CloudErrorCode {
  if (status === 400) return 'invalid_credentials';
  if (status === 401 || status === 403) return 'invalid_credentials';
  if (status === 404) return 'not_provisioned';
  if (status === 422) return 'weak_password';
  if (status === 429) return 'rate_limited';
  return 'server';
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return { message: text.slice(0, 200) };
  }
}

/** GoTrue returns `error_description`, `msg` or `message` depending on the path. */
function messageOf(body: Record<string, unknown>, fallback: string): string {
  for (const key of ['error_description', 'msg', 'message', 'error']) {
    const value = body[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return fallback;
}

function mapAuthFailure(status: number, body: Record<string, unknown>): CloudError {
  const message = messageOf(body, 'The account service rejected that request.');
  const code = messageOf(body, '').toLowerCase();
  if (status === 404) {
    return new CloudError('not_provisioned', 'This Supabase project has no auth service at the configured URL.');
  }
  if (code.includes('email not confirmed')) {
    return new CloudError('email_not_confirmed', 'Confirm your email address first — check your inbox for the link.');
  }
  if (code.includes('invalid login credentials') || status === 400 || status === 401) {
    return new CloudError('invalid_credentials', 'That email and password do not match an account.');
  }
  if (code.includes('already registered') || code.includes('already been registered')) {
    return new CloudError('email_taken', 'An account with that email already exists. Sign in instead.');
  }
  if (status === 429) {
    return new CloudError('rate_limited', 'Too many attempts. Wait a minute and try again.');
  }
  if (code.includes('password') && (code.includes('least') || code.includes('weak'))) {
    return new CloudError('weak_password', message);
  }
  return new CloudError(apiError(status), message);
}

function sessionFrom(body: Record<string, unknown>): CloudSession | null {
  const accessToken = typeof body.access_token === 'string' ? body.access_token : '';
  const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : '';
  if (!accessToken || !refreshToken) return null;
  const expiresIn = typeof body.expires_in === 'number' ? body.expires_in : 3600;
  const user = (body.user ?? {}) as { id?: string; email?: string };
  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    user: { id: String(user.id ?? ''), email: String(user.email ?? '') },
  };
}

async function request(
  fetchImpl: FetchLike,
  config: CloudConfig,
  path: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetchImpl(`${config.url}${path}`, init);
  } catch (error) {
    throw new CloudError('network', error instanceof Error ? `Cannot reach ${config.url}: ${error.message}` : 'Network error.');
  }
  const body = await readJson(response);
  if (!response.ok) throw mapAuthFailure(response.status, body);
  return body;
}

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

export interface SignUpResult {
  session: CloudSession | null;
  /** true when Supabase is configured to require an email click-through */
  confirmationRequired: boolean;
}

export async function signUp(
  config: CloudConfig,
  email: string,
  password: string,
  fetchImpl: FetchLike = fetch,
): Promise<SignUpResult> {
  if (!isConfigured(config)) throw new CloudError('not_configured', 'No Supabase project is configured.');
  const body = await request(fetchImpl, config, '/auth/v1/signup', {
    method: 'POST',
    headers: headersFor(config),
    body: JSON.stringify({ email, password }),
  });
  const session = sessionFrom(body);
  return { session, confirmationRequired: !session };
}

export async function signInWithPassword(
  config: CloudConfig,
  email: string,
  password: string,
  fetchImpl: FetchLike = fetch,
): Promise<CloudSession> {
  if (!isConfigured(config)) throw new CloudError('not_configured', 'No Supabase project is configured.');
  const body = await request(fetchImpl, config, '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: headersFor(config),
    body: JSON.stringify({ email, password }),
  });
  const session = sessionFrom(body);
  if (!session) throw new CloudError('server', 'The account service returned no session.');
  return session;
}

export async function sendRecoveryEmail(
  config: CloudConfig,
  email: string,
  fetchImpl: FetchLike = fetch,
): Promise<void> {
  if (!isConfigured(config)) throw new CloudError('not_configured', 'No Supabase project is configured.');
  await request(fetchImpl, config, '/auth/v1/recover', {
    method: 'POST',
    headers: headersFor(config),
    body: JSON.stringify({ email }),
  });
}

export async function signOut(config: CloudConfig, session: CloudSession | null, fetchImpl: FetchLike = fetch): Promise<void> {
  if (!session || !isConfigured(config)) return;
  try {
    await fetchImpl(`${config.url}/auth/v1/logout`, {
      method: 'POST',
      headers: headersFor(config, session.accessToken),
    });
  } catch {
    // A local sign-out must succeed even on a plane; the token expires anyway.
  }
}

/** Exchange a refresh token for a fresh access token. Returns null when revoked. */
export async function refreshSession(
  config: CloudConfig,
  session: CloudSession,
  fetchImpl: FetchLike = fetch,
): Promise<CloudSession | null> {
  if (!isConfigured(config) || !session.refreshToken) return null;
  let response: Response;
  try {
    response = await fetchImpl(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: headersFor(config),
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
  } catch {
    throw new CloudError('network', 'Cannot reach the account service.');
  }
  if (response.status === 400 || response.status === 401) return null;
  const body = await readJson(response);
  if (!response.ok) throw mapAuthFailure(response.status, body);
  const next = sessionFrom(body);
  if (!next) return null;
  // GoTrue omits the user on some refresh responses; keep the identity we had.
  return next.user.id ? next : { ...next, user: session.user };
}

export function needsRefresh(session: CloudSession, now = Date.now()): boolean {
  return session.expiresAt - now <= REFRESH_MARGIN_MS;
}

/** Refresh when close to expiry; otherwise return the same session. */
export async function ensureFreshSession(
  config: CloudConfig,
  session: CloudSession | null,
  fetchImpl: FetchLike = fetch,
  now = Date.now(),
): Promise<CloudSession | null> {
  if (!session) return null;
  if (!needsRefresh(session, now)) return session;
  return refreshSession(config, session, fetchImpl);
}

/* ------------------------------------------------------------------ *
 * Entitlement
 * ------------------------------------------------------------------ */

export function localEntitlement(profileLimit: number | null = 2): ServerEntitlement {
  return {
    plan: 'free',
    isAdmin: false,
    profileLimit,
    renewsAt: null,
    source: 'local',
    fetchedAt: Date.now(),
  };
}

/** undefined = absent/unusable, null = explicitly unlimited. */
function readLimit(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Parse the normalised entitlement payload built from the `accounts` row
 * without trusting missing fields.
 *
 * Fail-closed rule: a missing or malformed limit is NOT "unlimited". Only an
 * explicit `profile_limit: null` or a premium plan grants unlimited profiles,
 * and only the server can say either.
 */
export function parseEntitlement(payload: unknown, now = Date.now()): ServerEntitlement {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const plan = raw.plan === 'premium' || raw.plan === 'starter' ? raw.plan : 'free';
  const limit = readLimit(raw.profile_limit);
  return {
    plan,
    isAdmin: raw.is_admin === true,
    profileLimit: limit !== undefined ? limit : plan === 'premium' ? null : 2,
    renewsAt: typeof raw.renews_at === 'string' ? raw.renews_at : null,
    source: raw.verified === true ? 'server' : 'local',
    fetchedAt: now,
  };
}

/**
 * Read the authoritative entitlement for this user.
 *
 * The row lives in `public.accounts`, readable only by its owner through the
 * `accounts: read own` RLS policy (`auth.uid() = id`), and every plan/limit
 * column is frozen by the `guard_account_plan` trigger — so the client cannot
 * fabricate a plan no matter what it sends. The `owner` plan (allowlist
 * bootstrap only) maps to premium plus the administrator flag, which the
 * client-side `isAdmin()` still requires a verified session to honour.
 */
export async function fetchEntitlement(
  config: CloudConfig,
  session: CloudSession,
  fetchImpl: FetchLike = fetch,
): Promise<ServerEntitlement> {
  if (!isConfigured(config)) throw new CloudError('not_configured', 'No Supabase project is configured.');
  const uid = String(session.user?.id ?? '').trim();
  if (!uid) throw new CloudError('expired_session', 'The session has no user id. Sign in again.');
  let response: Response;
  try {
    const query = `${config.url}/rest/v1/accounts?select=plan,unlimited,profile_limit&id=eq.${encodeURIComponent(uid)}&limit=1`;
    response = await fetchImpl(query, {
      method: 'GET',
      headers: headersFor(config, session.accessToken),
    });
  } catch (error) {
    throw new CloudError('network', error instanceof Error ? error.message : 'Network error.');
  }
  const body = await readJson(response);
  if (!response.ok) {
    const message = messageOf(body, '');
    if (response.status === 404 || message.includes('public.accounts') || message.includes('schema cache')) {
      throw new CloudError(
        'not_provisioned',
        'The project is missing public.accounts. Apply supabase/migrations/0002_accounts_and_licensing.sql.',
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new CloudError('expired_session', 'The session is no longer accepted. Sign in again.');
    }
    throw new CloudError(apiError(response.status), message || 'The project rejected the entitlement request.');
  }
  if (!Array.isArray(body) || body.length === 0) {
    throw new CloudError(
      'not_provisioned',
      'This account has no entitlement row yet. The signup trigger creates it; sign out and in again after the migration is applied.',
    );
  }
  const row = (body[0] ?? {}) as { plan?: unknown; unlimited?: unknown; profile_limit?: unknown };
  const rawPlan = typeof row.plan === 'string' ? row.plan : 'free';
  const isOwner = rawPlan === 'owner';
  const plan = isOwner ? 'premium' : rawPlan === 'premium' || rawPlan === 'starter' ? rawPlan : 'free';
  const limit =
    row.unlimited === true
      ? null
      : typeof row.profile_limit === 'number' && Number.isFinite(row.profile_limit)
        ? row.profile_limit
        : plan === 'premium'
          ? null
          : 2;
  return parseEntitlement({
    plan,
    is_admin: isOwner,
    profile_limit: limit,
    renews_at: null,
    verified: true,
  });
}

/* ------------------------------------------------------------------ *
 * Session and entitlement persistence
 * ------------------------------------------------------------------ */

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadSession(): CloudSession | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CloudSession>;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user?.email) return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: Number(parsed.expiresAt) || 0,
      user: { id: String(parsed.user.id ?? ''), email: String(parsed.user.email) },
    };
  } catch {
    return null;
  }
}

export function saveSession(session: CloudSession | null): void {
  const store = storage();
  if (!store) return;
  try {
    if (!session) store.removeItem(SESSION_KEY);
    else store.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Private mode / quota: the session still works for this page's lifetime.
  }
}

/**
 * The cached value is bound to the account that earned it, so one user's plan
 * can never be restored onto another account after a sign-out on a shared
 * machine.
 */
export function loadCachedEntitlement(now = Date.now(), email?: string): ServerEntitlement | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(ENTITLEMENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ServerEntitlement> & { email?: string };
    if (!parsed.fetchedAt || now - parsed.fetchedAt > ENTITLEMENT_GRACE_MS) return null;
    if (email && parsed.email && parsed.email.toLowerCase() !== email.toLowerCase()) return null;
    if (parsed.source !== 'server') return null;
    const entitlement = parseEntitlement(parsed, parsed.fetchedAt);
    // The administrator flag is never restored from storage: it is re-verified
    // against the server on reconnect. A cached plan keeps a paying user working
    // offline; a cached *role* would be an escalation primitive.
    return { ...entitlement, isAdmin: false, source: 'cache' };
  } catch {
    return null;
  }
}

export function cacheEntitlement(entitlement: ServerEntitlement | null, email?: string): void {
  const store = storage();
  if (!store) return;
  try {
    if (!entitlement || entitlement.source === 'local') store.removeItem(ENTITLEMENT_KEY);
    else store.setItem(ENTITLEMENT_KEY, JSON.stringify({ ...entitlement, email: email ?? '' }));
  } catch {
    // Cache is an optimisation; failure is not an auth failure.
  }
}
