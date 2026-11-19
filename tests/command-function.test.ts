/**
 * Edge-function relay tests.
 *
 * The deployed function is this exact file (dependency-free fetch against
 * PostgREST), so testing it in Node tests production behaviour: envelope
 * validation, the three actions, auth-header wiring and failure paths.
 */
import { describe, expect, it, vi } from 'vitest';
import { createHandler, validateEnvelope, DEFAULT_WORKSPACE, TOPICS, DEVICES, type HandlerEnv } from '../supabase/functions/joe-command-validate/index';

const ENV: HandlerEnv = { url: 'https://ref.supabase.co', serviceKey: 'service-role-key' };

const post = (body: unknown, env: HandlerEnv = ENV) => {
  const handler = createHandler(env);
  return handler(new Request('https://ref.supabase.co/functions/v1/joe-command-validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
};

const validSend = {
  id: 'desktop-exe-1-abc',
  topic: 'command:launch',
  from: 'desktop-exe',
  to: 'android-apk',
  payload: { profileIds: ['prf_1'] },
  seq: 1,
  workspace: DEFAULT_WORKSPACE,
};

describe('validateEnvelope', () => {
  it('accepts a well-formed command', () => {
    expect(validateEnvelope(validSend)).toEqual([]);
  });

  it('rejects unknown topics, devices and launches without profiles', () => {
    expect(validateEnvelope({ ...validSend, topic: 'command:nuke' })).toContain('unknown topic');
    expect(validateEnvelope({ ...validSend, from: 'toaster' })).toContain('unknown from device');
    expect(validateEnvelope({ ...validSend, payload: {} })).toContain('command:launch requires profileIds');
    expect(validateEnvelope({ ...validSend, seq: 0 })).toContain('invalid seq');
    expect(validateEnvelope({ ...validSend, workspace: undefined })).toContain('workspace is required');
  });

  it('caps payload size at 16 KB', () => {
    const big = { ...validSend, payload: { blob: 'x'.repeat(16001) } };
    expect(validateEnvelope(big)).toContain('payload too large');
  });

  it('keeps the topic and device vocabularies closed', () => {
    expect(TOPICS.has('command:launch')).toBe(true);
    expect(DEVICES.has('android-apk')).toBe(true);
    expect(DEVICES.has('iphone')).toBe(false);
  });
});

describe('createHandler', () => {
  it('queues a valid send with service-role headers and ignores duplicates', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 201 }));
    const res = await post(validSend, { ...ENV, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: validSend.id });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://ref.supabase.co/rest/v1/commands');
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe('service-role-key');
    expect(headers.Authorization).toBe('Bearer service-role-key');
    expect(headers.Prefer).toContain('resolution=ignore-duplicate');
    expect(JSON.parse(String(init.body))).toMatchObject({
      id: validSend.id, workspace_id: DEFAULT_WORKSPACE, status: 'pending', topic: 'command:launch',
    });
  });

  it('never writes when validation fails', async () => {
    const fetchImpl = vi.fn();
    const res = await post({ ...validSend, topic: 'evil' }, { ...ENV, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.errors).toContain('unknown topic');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('polls only the requesting device in the default workspace', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify([{ id: 'c1', topic: 'command:stop' }]), { status: 200 }));
    const res = await post({ action: 'poll', device: 'desktop-exe', since: '2026-11-19T00:00:00Z' }, { ...ENV, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.commands).toHaveLength(1);

    const [url] = fetchImpl.mock.calls[0] as unknown as [string];
    expect(url).toContain('to_device=eq.desktop-exe');
    expect(url).toContain(`workspace_id=eq.${DEFAULT_WORKSPACE}`);
    expect(url).toContain('status=eq.pending');
    expect(url).toContain('created_at=gt.2026-11-19T00%3A00%3A00Z');
  });

  it('refuses to poll for an unknown device', async () => {
    const fetchImpl = vi.fn();
    const res = await post({ action: 'poll', device: 'toaster' }, { ...ENV, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.status).toBe(422);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('acks handled commands by id', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const res = await post({ action: 'ack', ids: ['c1', 'c2'] }, { ...ENV, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, acked: 2 });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('id=in.(c1,c2)');
    expect(url).toContain('status=eq.pending');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(String(init.body))).toEqual({ status: 'delivered' });
  });

  it('rejects an empty ack list without touching the database', async () => {
    const fetchImpl = vi.fn();
    const res = await post({ action: 'ack', ids: [] }, { ...ENV, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.status).toBe(422);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects ack ids that could break the query filter', async () => {
    const fetchImpl = vi.fn();
    const res = await post({ action: 'ack', ids: ['c1&status=eq.delivered'] }, { ...ENV, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.status).toBe(422);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports unconfigured credentials instead of failing open', async () => {
    const res = await post(validSend, { url: '', serviceKey: '' });
    expect(res.status).toBe(503);
  });

  it('answers unknown actions and bad JSON predictably', async () => {
    expect((await post({ action: 'drop-table' })).status).toBe(422);
    const handler = createHandler(ENV);
    const bad = await handler(new Request('https://x', { method: 'POST', body: '{' }));
    expect(bad.status).toBe(400);
    const get = await handler(new Request('https://x', { method: 'GET' }));
    expect(get.status).toBe(405);
    const pre = await handler(new Request('https://x', { method: 'OPTIONS' }));
    expect(pre.status).toBe(200);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
