import { describe, it, expect, vi } from 'vitest';
import { createLocalTransport, createSupabaseTransport, SyncClient } from '@joe/sync';

describe('EXE ⇄ APK sync bus', () => {
  it('routes broadcasts without echoing to the sender', async () => {
    const bus = createLocalTransport();
    const exe = new SyncClient('desktop-exe', bus);
    const apk = new SyncClient('android-apk', bus);
    const onApk = vi.fn(), onExe = vi.fn();
    apk.on('command:launch', onApk); exe.on('command:launch', onExe);
    await exe.send('command:launch', { profileIds: ['p1'] });
    expect(onApk).toHaveBeenCalledTimes(1);
    expect(onExe).not.toHaveBeenCalled();
    exe.dispose(); apk.dispose();
  });

  it('honours directed messages and workspace isolation', async () => {
    const bus = createLocalTransport();
    const exe = new SyncClient('desktop-exe', bus, 'ws-a');
    const apk = new SyncClient('android-apk', bus, 'ws-a');
    const web = new SyncClient('web-dashboard', bus, 'ws-a');
    const other = new SyncClient('android-apk', bus, 'ws-b');
    const a = vi.fn(), w = vi.fn(), o = vi.fn();
    apk.on('*', a); web.on('*', w); other.on('*', o);
    await exe.send('command:stop', { profileIds: ['p1'] }, 'android-apk');
    expect(a).toHaveBeenCalledTimes(1);
    expect(w).not.toHaveBeenCalled();
    expect(o).not.toHaveBeenCalled();
  });

  it('stops on unsubscribe and caps history', async () => {
    const bus = createLocalTransport();
    const exe = new SyncClient('desktop-exe', bus);
    const apk = new SyncClient('android-apk', bus);
    const fn = vi.fn();
    apk.on('presence:heartbeat', fn)();
    await exe.send('presence:heartbeat', { online: true });
    expect(fn).not.toHaveBeenCalled();
    for (let i = 0; i < 250; i++) await exe.send('presence:heartbeat', { i });
    expect(apk.history).toHaveLength(200);
  });

  it('maps envelopes onto the Supabase broadcast wire format', async () => {
    const sent: unknown[] = [];
    const listeners: Array<(m: { payload: unknown }) => void> = [];
    const channel = {
      async send(m: { type: 'broadcast'; event: string; payload: unknown }) { sent.push(m); },
      on(_e: 'broadcast', _f: { event: string }, cb: (m: { payload: unknown }) => void) { listeners.push(cb); },
    };
    const transport = createSupabaseTransport(channel);
    const exe = new SyncClient('desktop-exe', transport);
    const apk = new SyncClient('android-apk', transport);
    const fn = vi.fn(); apk.on('command:launch', fn);
    const e = await exe.send('command:launch', { profileIds: ['p9'] });
    expect(sent[0]).toEqual({ type: 'broadcast', event: 'joe-sync', payload: e });
    listeners.forEach((cb) => cb({ payload: e }));
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
