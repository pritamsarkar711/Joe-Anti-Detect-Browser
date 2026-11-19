/**
 * Supabase Edge Function: EXE ⇄ APK command relay.
 *
 * The native shells authenticate with the project's publishable (anon) key,
 * which row-level security deliberately keeps away from the `commands` table.
 * This function is the single validated door: it checks every envelope with
 * `verify_jwt: true`, writes and reads commands with the service-role key, and
 * never exposes raw PostgREST access.
 *
 * Actions (POST JSON):
 *   send  — validate an envelope and queue it for the target device.
 *           Backwards compatible: a body without `action` that carries `id` +
 *           `topic` is treated as `send`.
 *   poll  — { device, since? } return pending commands for one device.
 *   ack   — { ids } mark handled commands as delivered.
 *
 * Kept dependency-free (plain `fetch` against PostgREST) so the exact source in
 * this file is what runs in production and the handler can be unit-tested in
 * Node without Deno or `npm:` import shims.
 */

export const DEFAULT_WORKSPACE = '00000000-0000-0000-0000-000000000001';

export const TOPICS = new Set([
  'command:launch', 'command:stop', 'command:sync', 'command:reload',
  'event:launch-ack', 'event:status', 'presence:heartbeat', 'profiles:changed',
]);

export const DEVICES = new Set(['desktop-exe', 'android-apk', 'web-dashboard']);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });

export interface HandlerEnv {
  /** Supabase project URL, e.g. https://<ref>.supabase.co */
  url: string;
  /** Service-role key. Never logged, never sent to clients. */
  serviceKey: string;
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

type FetchImpl = typeof fetch;

/** Minimal PostgREST client bound to the service role. */
async function rest(env: HandlerEnv, path: string, init: RequestInit = {}): Promise<{ status: number; body: unknown }> {
  const f: FetchImpl = env.fetchImpl ?? fetch;
  const res = await f(`${env.url.replace(/\/+$/, '')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  let body: unknown = null;
  try { body = await res.json(); } catch { /* 204 and friends */ }
  return { status: res.status, body };
}

/** Validate a send envelope. Returns the list of problems (empty = valid). */
export function validateEnvelope(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const { id, topic, from, to, payload, seq, workspace, workspace_id } = body as Record<string, unknown>;
  if (typeof id !== 'string' || !id) errors.push('id is required');
  if (typeof topic !== 'string' || !TOPICS.has(topic)) errors.push('unknown topic');
  if (typeof from !== 'string' || !DEVICES.has(from)) errors.push('unknown from device');
  if (to !== undefined && to !== null && (typeof to !== 'string' || !DEVICES.has(to))) errors.push('unknown to device');
  if (typeof seq !== 'number' || seq < 1) errors.push('invalid seq');
  const ws = workspace ?? workspace_id;
  if (typeof ws !== 'string' || !ws) errors.push('workspace is required');
  if (payload === undefined || payload === null || typeof payload !== 'object') errors.push('payload is required');
  else if (JSON.stringify(payload).length > 16000) errors.push('payload too large');
  const p = payload as { profileIds?: unknown } | null;
  if (topic === 'command:launch' && (!p || !Array.isArray(p.profileIds) || p.profileIds.length === 0)) {
    errors.push('command:launch requires profileIds');
  }
  if (typeof id === 'string' && id.length > 128) errors.push('id too long');
  return errors;
}

export function createHandler(env: HandlerEnv) {
  return async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return json({ ok: false, error: 'POST required' }, 405);
    if (!env.url || !env.serviceKey) return json({ ok: false, error: 'server not configured' }, 503);

    let body: Record<string, unknown>;
    try { body = await req.json(); }
    catch { return json({ ok: false, error: 'invalid JSON' }, 400); }

    const action = typeof body.action === 'string'
      ? body.action
      : (typeof body.id === 'string' && typeof body.topic === 'string' ? 'send' : '');

    if (action === 'send') {
      const errors = validateEnvelope(body);
      if (errors.length) return json({ ok: false, errors }, 422);
      const id = body.id as string;
      const row = {
        id,
        workspace_id: DEFAULT_WORKSPACE,
        topic: body.topic,
        from_device: body.from,
        to_device: body.to ?? null,
        payload: body.payload,
        status: 'pending',
      };
      const { status } = await rest(env, 'commands', {
        method: 'POST',
        headers: { Prefer: 'resolution=ignore-duplicate,return=minimal' },
        body: JSON.stringify(row),
      });
      if (status >= 200 && status < 300) return json({ ok: true, id });
      return json({ ok: false, error: 'queue failed' }, 502);
    }

    if (action === 'poll') {
      const device = body.device;
      if (typeof device !== 'string' || !DEVICES.has(device)) {
        return json({ ok: false, errors: ['unknown device'] }, 422);
      }
      const since = typeof body.since === 'string' && body.since ? body.since : '1970-01-01T00:00:00Z';
      const path = 'commands?select=id,topic,payload,from_device,created_at'
        + `&workspace_id=eq.${DEFAULT_WORKSPACE}`
        + `&to_device=eq.${encodeURIComponent(device)}`
        + '&status=eq.pending'
        + `&created_at=gt.${encodeURIComponent(since)}`
        + '&order=created_at.asc&limit=20';
      const { status, body: rows } = await rest(env, path);
      if (status >= 200 && status < 300) return json({ ok: true, commands: Array.isArray(rows) ? rows : [] });
      return json({ ok: false, error: 'poll failed' }, 502);
    }

    if (action === 'ack') {
      const ids = body.ids;
      // Ids are generated as `<device>-<n>`; the closed charset means the
      // filter below never needs escaping or quoting.
      if (!Array.isArray(ids) || !ids.length || ids.length > 100
        || ids.some((i) => typeof i !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(i))) {
        return json({ ok: false, errors: ['ids must be 1–100 generated command ids'] }, 422);
      }
      const list = ids.join(',');
      const { status } = await rest(env, `commands?id=in.(${list})&status=eq.pending`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'delivered' }),
      });
      if (status >= 200 && status < 300) return json({ ok: true, acked: ids.length });
      return json({ ok: false, error: 'ack failed' }, 502);
    }

    return json({ ok: false, errors: ['unknown action'] }, 422);
  };
}

/* ------------------------------------------------------------------ *
 * Deno entry point. `declare` keeps the file type-checkable under tsc
 * (which follows it from tests/) while `typeof` guards make the module
 * a no-op when imported in Node.
 * ------------------------------------------------------------------ */
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
} | undefined;

if (typeof Deno !== 'undefined' && Deno) {
  Deno.serve((req) => {
    try {
      return createHandler({
        url: Deno.env.get('SUPABASE_URL') ?? '',
        // The platform reserves SUPABASE_SERVICE_ROLE_KEY, so the relay reads
        // the project secret under its own name (JOE_SERVICE_ROLE_KEY).
        serviceKey: Deno.env.get('JOE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      })(req);
    } catch (error) {
      console.error('[joe-command-validate] unexpected error', error instanceof Error ? error.message : error);
      return json({ ok: false, error: 'internal error' }, 500);
    }
  });
}
