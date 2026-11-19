/**
 * Supabase cloud accounts — sign-up, login, logout, password reset and
 * entitlement lookup over the platform's own REST endpoints.
 *
 * Plain `fetch` against GoTrue (`/auth/v1/*`) and PostgREST (`/rest/v1/*`):
 * no SDK dependency in the UI bundle, and every call is unit-testable against
 * a stubbed fetch. The client is used only when a project URL and anon key are
 * configured in Settings → Sync; without them the app stays local-first and
 * says so.
 *
 * The session lives in localStorage (`joe-browser:auth`) and is refreshed
 * through `grant_type=refresh_token` when the access token is stale. The anon
 * key is a publishable key by design — security rests on the server's RLS
 * policies (supabase/migrations), never on this file.
 */

import { ADMIN_EMAIL, type Account, type PlanId } from '@joe/core';

const AUTH_KEY = 'joe-browser:auth';

export interface CloudSession {
  accessToken: string;
  refreshToken: string;
  /** epoch milliseconds at which the access token stops working */
  expiresAt: number;
  user: { id: string; email: string };
}

export interface EntitlementRow {
  plan: PlanId;
  role: Account['role'];
  renewsAt: string | null;
}

interface CloudConfig {
  url: string;
  anonKey: string;
}

let config: CloudConfig | null = null;

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Point the auth client at a Supabase project. An empty key clears the
 * configuration and returns the app to local-first mode.
 */
export function configureCloudAuth(url: string, anonKey: string): boolean {
  const clean = { url: normalizeUrl(url), anonKey: anonKey.trim() };
  if (!clean.url || !clean.anonKey) {
    config = null;
    return false;
  }
  if (!/^https:\/\//i.test(clean.url)) {
    config = null;
    return false;
  }
  config = clean;
  return true;
}

export function cloudConfigured(): boolean {
  return config !== null;
}

/** Headers every Supabase REST call carries. The anon key is publishable. */
function headers(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: config?.anonKey ?? '',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** Supabase error bodies arrive in several shapes; one normaliser for all. */
function errorOf(body: unknown, fallback: string): string {
  const b = body as { error_description?: string; msg?: string; message?: string; error?: string } | null;
  return b?.error_description || b?.msg || b?.message || b?.error || fallback;
}

/** Persisted session helpers. The stored blob is validated before trust. */
export function normalizeSession(raw: unknown): CloudSession | null {
  const s = raw as Partial<CloudSession> | null;
  if (!s || typeof s !== 'object') return null;
  if (typeof s.accessToken !== 'string' || !s.accessToken) return null;
  if (typeof s.refreshToken !== 'string' || !s.refreshToken) return null;
  const user = s.user as Partial<CloudSession['user']> | undefined;
  if (!user || typeof user.id !== 'string' || typeof user.email !== 'string') return null;
  return {
    accessToken: s.accessToken,
    refreshToken: s.refreshToken,
    expiresAt: typeof s.expiresAt === 'number' ? s.expiresAt : 0,
    user: { id: user.id, email: user.email },
  };
}

function readStored(): CloudSession | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return normalizeSession(JSON.parse(localStorage.getItem(AUTH_KEY) ?? 'null'));
  } catch {
    return null;
  }
}

function writeStored(session: CloudSession | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (session) localStorage.setItem(AUTH_KEY, JSON.stringify(session));
    else localStorage.removeItem(AUTH_KEY);
  } catch { /* private mode / quota: session simply will not survive a reload */ }
}

/** Turn a GoTrue token response into a CloudSession. */
function sessionFromTokenBody(body: unknown): CloudSession | null {
  const b = body as {
    access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: number;
    user?: { id?: string; email?: string };
  } | null;
  if (!b?.access_token || !b?.refresh_token || !b.user?.id || !b.user?.email) return null;
  const expiresAt = b.expires_at
    ? b.expires_at * 1000
    : Date.now() + Math.max(0, (b.expires_in ?? 3600)) * 1000;
  return {
    accessToken: b.access_token,
    refreshToken: b.refresh_token,
    expiresAt,
    user: { id: b.user.id, email: b.user.email },
  };
}

async function request(path: string, init: RequestInit): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${config?.url}${path}`, init);
  let body: unknown = null;
  try { body = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body };
}

export type AuthResult = { error: string | null; needsConfirmation?: boolean; session?: CloudSession | null };

/** Create an account. With email confirmation on, no session is returned. */
export async function signUpCloud(email: string, password: string): Promise<AuthResult> {
  if (!config) return { error: 'Cloud accounts are not configured.' };
  try {
    const { status, body } = await request('/auth/v1/signup', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email, password }),
    });
    if (status >= 400) return { error: errorOf(body, 'Sign-up failed.') };
    const session = sessionFromTokenBody(body);
    if (session) {
      writeStored(session);
      return { error: null, session };
    }
    return { error: null, needsConfirmation: true };
  } catch {
    return { error: 'Could not reach the account server.' };
  }
}

/** Sign in with email and password; the session is persisted on success. */
export async function signInCloud(email: string, password: string): Promise<AuthResult> {
  if (!config) return { error: 'Cloud accounts are not configured.' };
  try {
    const { status, body } = await request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email, password }),
    });
    if (status >= 400) return { error: errorOf(body, 'Sign-in failed.') };
    const session = sessionFromTokenBody(body);
    if (!session) return { error: 'The account server returned no session.' };
    writeStored(session);
    return { error: null, session };
  } catch {
    return { error: 'Could not reach the account server.' };
  }
}

/** End the cloud session locally and remotely (best effort). */
export async function signOutCloud(): Promise<void> {
  const session = readStored();
  writeStored(null);
  if (!config || !session) return;
  try {
    await request('/auth/v1/logout', { method: 'POST', headers: headers(session.accessToken) });
  } catch { /* the local session is already gone */ }
}

/** Send a password-reset email. Deliberately identical response either way. */
export async function recoverCloud(email: string): Promise<AuthResult> {
  if (!config) return { error: 'Cloud accounts are not configured.' };
  try {
    const { status, body } = await request('/auth/v1/recover', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email }),
    });
    if (status >= 400) return { error: errorOf(body, 'The reset request failed.') };
    return { error: null };
  } catch {
    return { error: 'Could not reach the account server.' };
  }
}

/** Set a new password on the current (e.g. post-recovery) session. */
export async function updatePasswordCloud(password: string): Promise<AuthResult> {
  const session = await restoreSession();
  if (!config || !session) return { error: 'Sign in first to change your password.' };
  try {
    const { status, body } = await request('/auth/v1/user', {
      method: 'PUT',
      headers: headers(session.accessToken),
      body: JSON.stringify({ password }),
    });
    if (status >= 400) return { error: errorOf(body, 'The password change failed.') };
    return { error: null };
  } catch {
    return { error: 'Could not reach the account server.' };
  }
}

/**
 * The current session, refreshed when the access token has expired.
 * Returns null when signed out or when refresh fails.
 */
export async function restoreSession(): Promise<CloudSession | null> {
  const session = readStored();
  if (!session) return null;
  if (session.expiresAt > Date.now() + 30_000) return session;
  if (!config) return session;
  try {
    const { status, body } = await request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });
    if (status >= 400) {
      writeStored(null);
      return null;
    }
    const fresh = sessionFromTokenBody(body) ?? { ...session, expiresAt: Date.now() + 3600_000 };
    writeStored(fresh);
    return fresh;
  } catch {
    // Offline: keep the old session rather than signing the user out.
    return session;
  }
}

/**
 * Map a `user_entitlements` row to the account fields the app uses.
 * The owner address is recognised client-side for UX; the same rule exists
 * server-side (migration 0002) and is what actually enforces permissions.
 */
export function accountFromEntitlement(
  email: string,
  row: Partial<EntitlementRow> | null | undefined,
): Pick<Account, 'plan' | 'role' | 'renewsAt'> {
  const isOwner = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const plan: PlanId = isOwner ? 'premium' : (row?.plan ?? 'free');
  const role: Account['role'] = isOwner ? 'owner' : (row?.role ?? 'member');
  return { plan, role, renewsAt: row?.renewsAt ?? null };
}

/**
 * Read this user's entitlement (plan, role, renewal) from Supabase.
 * Returns null when the table is missing or the call fails — callers fall
 * back to the free plan rather than blocking sign-in.
 */
export async function fetchEntitlement(session: CloudSession): Promise<EntitlementRow | null> {
  if (!config) return null;
  try {
    const { status, body } = await request(
      `/rest/v1/user_entitlements?select=plan,role,renews_at&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
      { method: 'GET', headers: headers(session.accessToken) },
    );
    if (status >= 400) return null;
    const rows = body as Array<{ plan?: string; role?: string; renews_at?: string | null }> | null;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;
    const plan: PlanId = row.plan === 'premium' || row.plan === 'starter' ? row.plan : 'free';
    const role: Account['role'] = row.role === 'admin' || row.role === 'owner' ? row.role : 'member';
    return { plan, role, renewsAt: row.renews_at ?? null };
  } catch {
    return null;
  }
}

/** Test seam: replace the module configuration and storage wholesale. */
export function resetCloudAuthForTests(): void {
  config = null;
  writeStored(null);
}
