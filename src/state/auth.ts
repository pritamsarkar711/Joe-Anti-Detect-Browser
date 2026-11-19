/**
 * Supabase authentication for the shared UI.
 *
 * The account screen used to say "accounts are handled by your Supabase
 * project" while never calling auth at all — sign-in just bound an email
 * locally. These helpers make the copy true when keys are configured in
 * Settings → Sync:
 *
 *   - sign-up / sign-in / sign-out / password recovery via the official client
 *   - session persistence (tokens in localStorage, silent refresh)
 *   - entitlement read from `public.accounts`, whose plan columns a database
 *     trigger fills from the allowlist and a guard trigger stops the client
 *     from editing (see supabase/migrations 0002)
 *
 * Without keys every helper reports `null` so the UI stays in honest local
 * mode instead of pretending a cloud session exists.
 */
import { createClient, type AuthError, type Session, type SupabaseClient, type User } from '@supabase/supabase-js';
import { accountFromServer, type Account, type ServerAccountRow } from '@joe/core';

interface CachedClient { key: string; client: SupabaseClient }
let cached: CachedClient | null = null;

/** Canonical site — email links (confirmation, recovery) land here. */
export const AUTH_REDIRECT = 'https://joe-browser-control.vercel.app';

/** Returns a memoized client, or null when the device has no keys yet. */
export function authClient(url?: string, key?: string): SupabaseClient | null {
  const u = (url ?? '').trim();
  const k = (key ?? '').trim();
  if (!u || !k) return null;
  const cacheKey = `${u}|${k}`;
  if (cached?.key === cacheKey) return cached.client;
  try {
    const client = createClient(u, k, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    cached = { key: cacheKey, client };
    return client;
  } catch {
    return null;
  }
}

/** Human message for the common GoTrue failures; never leaks internals. */
export function authErrorMessage(error: AuthError | null | undefined): string {
  if (!error) return 'Authentication failed. Try again.';
  const code = error.message || '';
  if (/invalid login credentials/i.test(code)) return 'Wrong email or password.';
  if (/email not confirmed/i.test(code)) return 'Confirm your email first — check your inbox for the link.';
  if (/already registered/i.test(code)) return 'That email already has an account. Sign in instead.';
  if (/password should be at least/i.test(code)) return 'Use at least 6 characters for the password.';
  if (/rate limit/i.test(code)) return 'Too many attempts. Wait a moment and try again.';
  if (/fetch|network|failed to fetch/i.test(code)) return 'Could not reach the account service. Check your connection.';
  return 'Authentication failed. Try again.';
}

/** Read the server's entitlement row for the signed-in user. */
export async function fetchServerAccount(client: SupabaseClient): Promise<ServerAccountRow | null> {
  try {
    const { data, error } = await client
      .from('accounts')
      .select('email, plan, unlimited, profile_limit')
      .limit(1);
    if (error || !Array.isArray(data) || !data.length) return null;
    return data[0] as ServerAccountRow;
  } catch {
    return null;
  }
}

/**
 * Build the store's Account from a session plus (when reachable) the server
 * row. Falls back to a member account on the session email so an offline
 * server never signs the user out of their own workspace.
 */
export async function accountForSession(client: SupabaseClient, session: Session | null): Promise<Account | null> {
  const email = session?.user?.email;
  if (!session || !email) return null;
  const row = await fetchServerAccount(client);
  return accountFromServer(row, email);
}

export interface AuthSubmission {
  ok: boolean;
  /** Present on success when a session was established immediately. */
  session?: Session | null;
  /** True when the user must confirm their email before signing in. */
  needsConfirmation?: boolean;
  /** True when a recovery link was sent. */
  recoverySent?: boolean;
  error?: string;
}

/** Create an account. With email confirmation on, no session comes back yet. */
export async function signUp(client: SupabaseClient, email: string, password: string): Promise<AuthSubmission> {
  try {
    const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: AUTH_REDIRECT } });
    if (error) return { ok: false, error: authErrorMessage(error) };
    return { ok: true, session: data.session, needsConfirmation: !data.session };
  } catch {
    return { ok: false, error: authErrorMessage(null) };
  }
}

export async function signIn(client: SupabaseClient, email: string, password: string): Promise<AuthSubmission> {
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: authErrorMessage(error) };
    return { ok: true, session: data.session };
  } catch {
    return { ok: false, error: authErrorMessage(null) };
  }
}

export async function sendPasswordReset(client: SupabaseClient, email: string): Promise<AuthSubmission> {
  try {
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: AUTH_REDIRECT });
    // GoTrue answers 200 for unknown addresses too; never confirm existence.
    if (error) return { ok: false, error: authErrorMessage(error) };
    return { ok: true, recoverySent: true };
  } catch {
    return { ok: false, error: authErrorMessage(null) };
  }
}

/**
 * Finish a recovery from a pasted link: adopt its tokens, then set the new
 * password. Email links cannot deep-link into a file:// desktop window, so
 * pasting the link is the honest way to complete the flow on every platform.
 */
export async function completePasswordReset(
  client: SupabaseClient,
  pastedLink: string,
  newPassword: string,
): Promise<AuthSubmission> {
  try {
    const url = new URL(pastedLink.trim());
    const access = url.hash ? new URLSearchParams(url.hash.slice(1)) : new URLSearchParams();
    const accessToken = url.searchParams.get('access_token') ?? access.get('access_token');
    const refreshToken = url.searchParams.get('refresh_token') ?? access.get('refresh_token');
    if (!accessToken || !refreshToken) {
      return { ok: false, error: 'That does not look like a password-reset link from your email.' };
    }
    const { error: sessionError } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (sessionError) return { ok: false, error: 'That reset link has expired. Request a new one.' };
    if (newPassword.length < 8) return { ok: false, error: 'Use at least 8 characters for the new password.' };
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) return { ok: false, error: authErrorMessage(error) };
    return { ok: true };
  } catch {
    return { ok: false, error: 'That does not look like a password-reset link from your email.' };
  }
}

export async function signOut(client: SupabaseClient): Promise<void> {
  try { await client.auth.signOut(); } catch { /* local session is cleared below regardless */ }
}

export async function currentSession(client: SupabaseClient): Promise<Session | null> {
  try {
    const { data } = await client.auth.getSession();
    return data.session ?? null;
  } catch {
    return null;
  }
}

/**
 * Subscribe to token refresh / sign-out so the store can follow along.
 * The event name matters: `INITIAL_SESSION` with no session must not sign a
 * local-mode user out of their own workspace — only an explicit `SIGNED_OUT`
 * (a real sign-out, or revoked tokens) should.
 */
export function onAuthStateChange(
  client: SupabaseClient,
  handler: (event: string, session: Session | null, user: User | null) => void,
): () => void {
  const { data } = client.auth.onAuthStateChange((event, session) => handler(event, session, session?.user ?? null));
  return () => data.subscription.unsubscribe();
}
