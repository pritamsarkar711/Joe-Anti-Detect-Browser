import { useEffect, useMemo, useState } from 'react';
import { createProfile, type BrowserProfile } from './core/profile';
import { createLocalTransport, SyncClient, type DeviceKind, type SyncEnvelope } from './core/sync';

// Module-level singleton: one loopback bus, two peers. In production each peer
// lives in its own process and `createSupabaseTransport` replaces this bus.
const bus = createLocalTransport();
const desktop = new SyncClient('desktop-exe', bus);
const android = new SyncClient('android-apk', bus);

interface LogEntry {
  id: string;
  topic: string;
  route: string;
  detail: string;
  time: string;
}

const DEVICE_LABEL: Record<DeviceKind, string> = {
  'desktop-exe': 'Desktop · EXE',
  'android-apk': 'Android · APK',
  'web-dashboard': 'Web · Vercel',
};

function describe(envelope: SyncEnvelope): string {
  const p = envelope.payload as Record<string, unknown>;
  if ('profileId' in p) return String(p.profileId);
  if ('online' in p) return p.online ? 'online' : 'offline';
  if ('ack' in p) return String(p.ack);
  return JSON.stringify(p);
}

export default function App() {
  const profiles = useMemo<BrowserProfile[]>(
    () => [
      createProfile('QA · Account A', 'workspace-seed', { group: 'QA', platform: 'windows', proxy: 'socks5://10.0.0.4:1080' }),
      createProfile('QA · Account B', 'workspace-seed', { group: 'QA', platform: 'windows', proxy: 'socks5://10.0.0.9:1080' }),
      createProfile('Mobile · Smoke', 'workspace-seed', { group: 'Mobile', platform: 'android', proxy: 'direct://' }),
      createProfile('Staging · EU', 'workspace-seed', { group: 'Staging', platform: 'windows', proxy: 'http://eu-proxy:8080' }),
    ],
    [],
  );

  const [selected, setSelected] = useState(0);
  const [events, setEvents] = useState<LogEntry[]>([]);
  const [lastAck, setLastAck] = useState('—');
  const [androidOnline, setAndroidOnline] = useState(true);

  useEffect(() => {
    const offBus = bus.subscribe((e: SyncEnvelope) => {
      setEvents((prev) =>
        [
          {
            id: e.id + e.sentAt,
            topic: e.topic,
            route: `${DEVICE_LABEL[e.from]} → ${e.to ? DEVICE_LABEL[e.to] : 'all peers'}`,
            detail: describe(e),
            time: new Date().toLocaleTimeString(),
          },
          ...prev,
        ].slice(0, 30),
      );
    });
    const offDesktop = desktop.on('*', (e) => {
      if (e.topic === 'event:launch-ack') setLastAck(`received ${describe(e)} at ${new Date().toLocaleTimeString()}`);
    });
    const offAndroid = android.on('command:launch', () => {
      if (androidOnline) void android.send('event:launch-ack', { ack: 'launched' }, 'desktop-exe');
    });
    return () => {
      offBus();
      offDesktop();
      offAndroid();
    };
  }, [androidOnline]);

  const active = profiles[selected];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark">◈</span>
          <div>
            <h1>Joe Browser</h1>
            <p>Profile isolation control plane · capability proof</p>
          </div>
        </div>
        <div className="status-row">
          <span className="pill live"><i /> LIVE PREVIEW</span>
          <span className="pill">React + TypeScript</span>
          <span className="pill ok">Supabase connector: enabled</span>
          <span className="pill ok">Vercel connector: enabled</span>
        </div>
      </header>

      <div className="grid">
        <section className="card">
          <div className="card-head">
            <h2>Profiles</h2>
            <span className="count">{profiles.length}</span>
          </div>
          <p className="hint">Same deterministic spec on EXE and APK — derived from one seed in the shared core.</p>
          <ul className="profile-list">
            {profiles.map((p, i) => (
              <li key={p.id}>
                <button className={i === selected ? 'profile active' : 'profile'} onClick={() => setSelected(i)}>
                  <span className="dot" style={{ background: p.platform === 'android' ? '#5eead4' : '#818cf8' }} />
                  <span className="profile-name">{p.name}<small>{p.group} · {p.platform}</small></span>
                  <span className="rev">r{p.revision}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <div className="card-head"><h2>Fingerprint spec</h2><span className="tag">{active.id}</span></div>
          <dl className="spec">
            <div><dt>User agent</dt><dd>{active.fingerprint.userAgent}</dd></div>
            <div><dt>Platform</dt><dd>{active.fingerprint.platform}</dd></div>
            <div><dt>Screen / DPR</dt><dd>{active.fingerprint.screen.width}×{active.fingerprint.screen.height} @ {active.fingerprint.screen.dpr}</dd></div>
            <div><dt>Timezone</dt><dd>{active.fingerprint.timezone}</dd></div>
            <div><dt>Locale</dt><dd>{active.fingerprint.locale}</dd></div>
            <div><dt>CPU / RAM</dt><dd>{active.fingerprint.hardwareConcurrency} cores · {active.fingerprint.deviceMemoryGb} GB</dd></div>
            <div><dt>WebGL</dt><dd>{active.fingerprint.webglVendor}</dd></div>
            <div><dt>Noise seed</dt><dd className="mono">0x{active.fingerprint.noiseSeed.toString(16)}</dd></div>
            <div><dt>Proxy</dt><dd>{active.proxy}</dd></div>
          </dl>
        </section>

        <section className="card devices">
          <div className="card-head"><h2>Connected peers</h2><span className="tag">via sync bus</span></div>
          <div className="device">
            <span className="dev-icon">▣</span>
            <div><strong>Desktop · EXE</strong><small>Electron · Windows · online</small></div>
            <span className="badge on">online</span>
          </div>
          <div className="device">
            <span className="dev-icon">▤</span>
            <div><strong>Android · APK</strong><small>WebView shell · Android 14</small></div>
            <button className={androidOnline ? 'badge on' : 'badge off'} onClick={() => setAndroidOnline((v) => !v)}>
              {androidOnline ? 'online' : 'offline'}
            </button>
          </div>
          <div className="device">
            <span className="dev-icon">☁</span>
            <div><strong>Control plane</strong><small>Next.js on Vercel + Supabase</small></div>
            <span className="badge on">ready</span>
          </div>

          <div className="actions">
            <button className="btn primary" onClick={() => void desktop.send('command:launch', { profileId: active.id }, 'android-apk')}>
              EXE → APK · launch profile
            </button>
            <button className="btn" onClick={() => void android.send('presence:heartbeat', { online: androidOnline }, 'desktop-exe')}>
              APK → EXE · heartbeat
            </button>
            <button className="btn" onClick={() => void desktop.send('profiles:reload', { count: profiles.length })}>
              Broadcast · reload profiles
            </button>
          </div>
          <p className="ack"><span>Last ACK on desktop:</span> <code>{lastAck}</code></p>
        </section>

        <section className="card log">
          <div className="card-head"><h2>Realtime event log</h2><span className="tag">joe-sync channel</span></div>
          <div className="log-body">
            {events.length === 0 && <p className="empty">No messages yet — click a button above to send one between the two apps.</p>}
            {events.map((e) => (
              <div className="log-row" key={e.id}>
                <time>{e.time}</time>
                <span className="topic">{e.topic}</span>
                <span className="route">{e.route}</span>
                <code>{e.detail}</code>
              </div>
            ))}
          </div>
        </section>
      </div>

      <footer className="stack">
        <span>shared core (TS)</span><b>→</b><span>Electron / EXE</span><b>+</b><span>Kotlin WebView / APK</span>
        <b>⇄</b><span>Supabase Realtime</span><b>⇄</b><span>Vercel control plane</span>
      </footer>
    </div>
  );
}
