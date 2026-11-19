import { describe, it, expect, vi } from 'vitest';
import { createProfile, hashString } from './profile';
import { createLocalTransport, createSupabaseTransport, SyncClient, type SyncEnvelope } from './sync';

describe('profile derivation (shared core)', () => {
  it('is deterministic for the same name + seed', () => {
    expect(hashString('joe')).toBe(hashString('joe'));
    expect(createProfile('QA Account 1', 'seed-A')).toEqual(createProfile('QA Account 1', 'seed-A'));
  });

  it('derives identical cross-device params on Windows and Android', () => {
    const desktop = createProfile('QA Account 1', 'seed-A', { platform: 'windows' });
    const mobile = createProfile('QA Account 1', 'seed-A', { platform: 'android' });
    expect(mobile.fingerprint.noiseSeed).toBe(desktop.fingerprint.noiseSeed);
    expect(mobile.fingerprint.timezone).toBe(desktop.fingerprint.timezone);
    expect(mobile.fingerprint.locale).toBe(desktop.fingerprint.locale);
    expect(mobile.fingerprint.screen).toEqual(desktop.fingerprint.screen);
    // only platform-specific fields differ
    expect(mobile.fingerprint.userAgent).not.toBe(desktop.fingerprint.userAgent);
  });

  it('different profiles get different noise seeds', () => {
    const a = createProfile('A', 'seed-A');
    const b = createProfile('B', 'seed-A');
    expect(a.fingerprint.noiseSeed).not.toBe(b.fingerprint.noiseSeed);
  });
});

describe('sync bus (EXE <-> APK)', () => {
  it('routes a broadcast from desktop to android without echoing to sender', async () => {
    const bus = createLocalTransport();
    const desktop = new SyncClient('desktop-exe', bus);
    const android = new SyncClient('android-apk', bus);
    const onAndroid = vi.fn();
    const onDesktop = vi.fn();
    android.on('command:launch', onAndroid);
    desktop.on('command:launch', onDesktop);

    await desktop.send('command:launch', { profileId: 'p_1' });

    expect(onAndroid).toHaveBeenCalledTimes(1);
    expect(onAndroid.mock.calls[0][0].payload).toEqual({ profileId: 'p_1' });
    expect(onDesktop).not.toHaveBeenCalled();
    desktop.dispose();
    android.dispose();
  });

  it('honours directed messages (to: android-apk)', async () => {
    const bus = createLocalTransport();
    const desktop = new SyncClient('desktop-exe', bus);
    const android = new SyncClient('android-apk', bus);
    const web = new SyncClient('web-dashboard', bus);
    const onAndroid = vi.fn();
    const onWeb = vi.fn();
    android.on('*', onAndroid);
    web.on('*', onWeb);

    await desktop.send('command:close', { profileId: 'p_1' }, 'android-apk');

    expect(onAndroid).toHaveBeenCalledTimes(1);
    expect(onWeb).not.toHaveBeenCalled();
    desktop.dispose();
    android.dispose();
    web.dispose();
  });

  it('stops delivering after unsubscribe and caps history at 100', async () => {
    const bus = createLocalTransport();
    const a = new SyncClient('desktop-exe', bus);
    const b = new SyncClient('android-apk', bus);
    const handler = vi.fn();
    const off = b.on('ping', handler);

    off();
    await a.send('ping', { n: 1 });
    expect(handler).not.toHaveBeenCalled();

    for (let i = 0; i < 120; i++) await a.send('ping', { i });
    // 121 envelopes were delivered, but the bounded history keeps only the latest 100.
    expect(b.history.length).toBe(100);
    expect(b.history[0].payload).toEqual({ i: 20 });
    a.dispose();
    b.dispose();
  });
});

describe('Supabase Realtime adapter', () => {
  it('maps envelopes onto the broadcast wire format', async () => {
    const sent: unknown[] = [];
    const received: Array<(m: { payload: unknown }) => void> = [];
    const channel = {
      async send(m: { type: 'broadcast'; event: string; payload: unknown }) {
        sent.push(m);
      },
      on(_event: 'broadcast', _filter: { event: string }, cb: (m: { payload: unknown }) => void) {
        received.push(cb);
      },
    };
    const transport = createSupabaseTransport(channel);
    const desktop = new SyncClient('desktop-exe', transport);
    const android = new SyncClient('android-apk', transport);
    const handler = vi.fn();
    android.on('command:launch', handler);

    const envelope = await desktop.send('command:launch', { profileId: 'p_9' });
    expect(sent[0]).toEqual({ type: 'broadcast', event: 'joe-sync', payload: envelope });

    // simulate the server echoing to the other peer
    received.forEach((cb) => cb({ payload: envelope }));
    expect(handler).toHaveBeenCalledTimes(1);
    desktop.dispose();
    android.dispose();
  });

  it('never emits an envelope with a missing topic', async () => {
    const bus = createLocalTransport();
    const desktop = new SyncClient('desktop-exe', bus);
    const android = new SyncClient('android-apk', bus);
    const seen: SyncEnvelope[] = [];
    android.on('*', (e) => seen.push(e));
    await desktop.send('presence:heartbeat', { online: true });
    expect(seen).toHaveLength(1);
    expect(seen[0].topic).toBeTruthy();
  });
});
