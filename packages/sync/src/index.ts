/**
 * EXE ⇄ APK sync. Transport-agnostic by design: the exact same SyncClient runs
 * in Electron (Node), the browser control plane, and is mirrored by the Kotlin
 * REST client on Android. Production transport = Supabase Realtime broadcast.
 */

export type DeviceKind = 'desktop-exe' | 'android-apk' | 'web-dashboard';
export type Topic =
  | 'command:launch' | 'command:stop' | 'command:sync' | 'command:reload'
  | 'event:launch-ack' | 'event:status' | 'presence:heartbeat' | 'profiles:changed';

export interface SyncEnvelope<T = unknown> {
  id: string;
  topic: Topic | string;
  from: DeviceKind;
  to?: DeviceKind;
  payload: T;
  sentAt: string;
  seq: number;
  workspace: string;
}

export interface SyncTransport {
  publish(e: SyncEnvelope): Promise<void>;
  subscribe(handler: (e: SyncEnvelope) => void): () => void;
}

export function createLocalTransport(): SyncTransport {
  const handlers = new Set<(e: SyncEnvelope) => void>();
  return {
    async publish(e) { await Promise.resolve(); for (const h of [...handlers]) h(e); },
    subscribe(h) { handlers.add(h); return () => handlers.delete(h); },
  };
}

/** Minimal shape of a supabase-js RealtimeChannel. */
export interface RealtimeChannelLike {
  send(m: { type: 'broadcast'; event: string; payload: unknown }): Promise<unknown>;
  on(event: 'broadcast', filter: { event: string }, cb: (m: { payload: unknown }) => void): unknown;
}

export function createSupabaseTransport(channel: RealtimeChannelLike, event = 'joe-sync'): SyncTransport {
  return {
    async publish(e) { await channel.send({ type: 'broadcast', event, payload: e }); },
    subscribe(h) { channel.on('broadcast', { event }, (m) => h(m.payload as SyncEnvelope)); return () => {}; },
  };
}

export interface DevicePresence {
  kind: DeviceKind;
  name: string;
  platform: string;
  appVersion: string;
  online: boolean;
  lastSeen: string;
  profiles: number;
}

export class SyncClient {
  readonly device: DeviceKind;
  readonly workspace: string;
  readonly history: SyncEnvelope[] = [];
  private readonly transport: SyncTransport;
  private readonly listeners = new Map<string, Set<(e: SyncEnvelope) => void>>();
  private seq = 0;
  private off: () => void;

  constructor(device: DeviceKind, transport: SyncTransport, workspace = 'default') {
    this.device = device;
    this.workspace = workspace;
    this.transport = transport;
    this.off = this.transport.subscribe((e) => this.deliver(e));
  }

  async send<T>(topic: Topic | string, payload: T, to?: DeviceKind): Promise<SyncEnvelope<T>> {
    const e: SyncEnvelope<T> = {
      id: `${this.device}-${this.seq + 1}-${Date.now().toString(36)}`,
      topic, from: this.device, ...(to ? { to } : {}), payload,
      sentAt: new Date().toISOString(), seq: ++this.seq, workspace: this.workspace,
    };
    await this.transport.publish(e);
    return e;
  }

  on(topic: Topic | string | '*', handler: (e: SyncEnvelope) => void): () => void {
    const set = this.listeners.get(topic) ?? new Set<(e: SyncEnvelope) => void>();
    set.add(handler); this.listeners.set(topic, set);
    return () => set.delete(handler);
  }

  dispose(): void { this.off(); this.listeners.clear(); }

  private deliver(e: SyncEnvelope): void {
    this.history.push(e);
    if (this.history.length > 200) this.history.shift();
    if (e.from === this.device) return;
    if (e.workspace !== this.workspace) return;
    if (e.to && e.to !== this.device) return;
    for (const h of this.listeners.get(e.topic) ?? []) h(e);
    for (const h of this.listeners.get('*') ?? []) h(e);
  }
}

export const DEFAULT_PRESENCE: DevicePresence[] = [
  { kind: 'desktop-exe', name: 'DESKTOP-7F2A', platform: 'Windows 11 x64', appVersion: '1.0.0', online: true, lastSeen: '', profiles: 0 },
  { kind: 'android-apk', name: 'Pixel 8', platform: 'Android 14', appVersion: '1.0.0', online: false, lastSeen: '', profiles: 0 },
];
