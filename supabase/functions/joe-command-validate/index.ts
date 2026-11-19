/** Supabase Edge Function: validate EXE ⇄ APK command envelopes before fan-out. */
const TOPICS = new Set([
  'command:launch', 'command:stop', 'command:sync', 'command:reload',
  'event:launch-ack', 'event:status', 'presence:heartbeat', 'profiles:changed',
]);
const DEVICES = new Set(['desktop-exe', 'android-apk', 'web-dashboard']);
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return Response.json({ ok: false, error: 'POST required' }, { status: 405, headers: cors });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return Response.json({ ok: false, error: 'invalid JSON' }, { status: 400, headers: cors }); }

  const errors: string[] = [];
  const { id, topic, from, to, payload, seq, workspace } = body as Record<string, unknown>;
  if (typeof id !== 'string' || !id) errors.push('id is required');
  if (typeof topic !== 'string' || !TOPICS.has(topic)) errors.push('unknown topic');
  if (typeof from !== 'string' || !DEVICES.has(from)) errors.push('unknown from device');
  if (to !== undefined && (typeof to !== 'string' || !DEVICES.has(to))) errors.push('unknown to device');
  if (typeof seq !== 'number' || seq < 1) errors.push('invalid seq');
  if (typeof workspace !== 'string' || !workspace) errors.push('workspace is required');
  if (payload === undefined || payload === null) errors.push('payload is required');
  if (typeof payload === 'object' && JSON.stringify(payload).length > 16000) errors.push('payload too large');
  const p = payload as { profileIds?: unknown } | null;
  if (topic === 'command:launch' && (!p || !Array.isArray(p.profileIds) || p.profileIds.length === 0)) {
    errors.push('command:launch requires profileIds');
  }

  if (errors.length) return Response.json({ ok: false, errors }, { status: 422, headers: cors });
  return Response.json({ ok: true, envelope: body, validatedAt: new Date().toISOString() }, { headers: cors });
});
