/**
 * Transport-agnostic sync bus shared by the desktop EXE, the Android APK and
 * the web dashboard. The local loopback transport is used for tests and for
 * the live preview; the Supabase Realtime adapter is the production one.
 * Swapping adapters requires no changes in any UI code.
 */

export type DeviceKind = 'desktop-exe' | 'android-apk' | 'web-dashboard';

export interface SyncEnvelope<T = unknown> {
  id: string;
  topic: string;
  from: DeviceKind;
  to?: DeviceKind;
  payload: T;
  sentAt: string;
  seq: number;
}

export interface SyncTransport {
  publish(envelope: SyncEnvelope): Promise<void>;
  subscribe(handler: (envelope: SyncEnvelope) => void): () => void;
}

/** In-process loopback: mimics Realtime broadcast (own messages are not echoed). */
export function createLocalTransport(): SyncTransport {
  const handlers = new Set<(e: SyncEnvelope) => void>();
  return {
    async publish(envelope) {
      await Promise.resolve();
      for (const handler of [...handlers]) handler(envelope);
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}

/** Minimal shape of a supabase-js RealtimeChannel, so we can type the adapter. */
export interface RealtimeChannelLike {
  send(message: { type: 'broadcast'; event: string; payload: unknown }): Promise<unknown>;
  on(
    event: 'broadcast',
    filter: { event: string },
    callback: (message: { payload: unknown }) => void,
  ): unknown;
}

/** Production adapter. `channel` = supabase.channel('joe:<workspaceId>'). */
export function createSupabaseTransport(channel: RealtimeChannelLike, event = 'joe-sync'): SyncTransport {
  return {
    async publish(envelope) {
      await channel.send({ type: 'broadcast', event, payload: envelope });
    },
    subscribe(handler) {
      channel.on('broadcast', { event }, (message) => {
        handler(message.payload as SyncEnvelope);
      });
      return () => {};
    },
  };
}

export type EnvelopeHandler = (envelope: SyncEnvelope) => void;

export class SyncClient {
  readonly device: DeviceKind;
  readonly history: SyncEnvelope[] = [];
  private readonly transport: SyncTransport;
  private readonly listeners = new Map<string, Set<EnvelopeHandler>>();
  private seq = 0;
  private readonly unsubscribe: () => void;

  constructor(device: DeviceKind, transport: SyncTransport) {
    this.device = device;
    this.transport = transport;
    this.unsubscribe = this.transport.subscribe((e) => this.deliver(e));
  }

  async send<T>(topic: string, payload: T, to?: DeviceKind): Promise<SyncEnvelope<T>> {
    const envelope: SyncEnvelope<T> = {
      id: `${this.device}-${this.seq + 1}`,
      topic,
      from: this.device,
      ...(to ? { to } : {}),
      payload,
      sentAt: new Date().toISOString(),
      seq: ++this.seq,
    };
    await this.transport.publish(envelope);
    return envelope;
  }

  /** `topic` may be an exact topic or '*' to observe everything. */
  on(topic: string, handler: EnvelopeHandler): () => void {
    const set = this.listeners.get(topic) ?? new Set<EnvelopeHandler>();
    set.add(handler);
    this.listeners.set(topic, set);
    return () => set.delete(handler);
  }

  dispose(): void {
    this.unsubscribe();
    this.listeners.clear();
  }

  private deliver(envelope: SyncEnvelope): void {
    this.history.push(envelope);
    if (this.history.length > 100) this.history.shift();
    if (envelope.from === this.device) return; // Supabase broadcast w/ self:false
    if (envelope.to && envelope.to !== this.device) return;
    for (const handler of this.listeners.get(envelope.topic) ?? []) handler(envelope);
    for (const handler of this.listeners.get('*') ?? []) handler(envelope);
  }
}
