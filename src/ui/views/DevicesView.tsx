import { useStore } from '@/state/store';
import { Icon } from '@/ui/Icons';
import { Button, Badge, Toggle, Stat } from '@/ui/Primitives';
import { DEVICE_LABEL } from './labels';

export function DevicesView() {
  const s = useStore();
  const running = s.profiles.filter((p) => p.status === 'running').length;

  return (
    <div className="view">
      <div className="stat-row">
        <Stat label="Connected" value={s.devices.filter((d) => d.online).length} icon="devices" />
        <Stat label="Running profiles" value={running} icon="play" tone="teal" />
        <Stat label="Messages" value={s.syncEvents.length} icon="activity" tone="blue" />
        <Stat label="Channel" value="joe-sync" icon="link" tone="amber" />
      </div>

      <div className="device-grid">
        {s.devices.map((d) => (
          <div className={`device-card ${d.online ? '' : 'offline'}`} key={d.kind}>
            <div className="dc-top">
              <span className="dc-icon"><Icon name={d.kind === 'android-apk' ? 'phone' : 'monitor'} size={22} /></span>
              <Badge tone={d.online ? 'ok' : 'neutral'} dot>{d.online ? 'online' : 'offline'}</Badge>
            </div>
            <h3>{d.name}</h3><p>{DEVICE_LABEL[d.kind]} · {d.platform} · v{d.appVersion}</p>
            <div className="dc-foot"><span>{d.profiles} running profiles</span><Toggle checked={d.online} onChange={(v) => s.setDeviceOnline(d.kind, v)} label={`Toggle ${d.name}`} /></div>
          </div>
        ))}
        <div className="device-card cloud">
          <div className="dc-top"><span className="dc-icon"><Icon name="globe" size={22} /></span><Badge tone="violet" dot>ready</Badge></div>
          <h3>Control plane</h3><p>Vercel · Supabase Realtime · Postgres</p>
          <div className="dc-foot"><span>{s.settings.workspace} workspace</span><Icon name="check" size={16} className="ok-icon" /></div>
        </div>
      </div>

      <div className="panel">
        <div className="toolbar">
          <div className="toolbar-left"><div className="panel-title"><Icon name="bolt" size={17} /><h2>Send command</h2></div></div>
          <div className="toolbar-right">
            <Button icon="play" size="sm" onClick={() => { void s.send('command:launch', { profileIds: s.profiles.slice(0, 1).map((p) => p.id) }, 'android-apk'); s.toast('Launch command sent'); }}>Launch on APK</Button>
            <Button icon="refresh" size="sm" onClick={() => { void s.send('profiles:changed', { count: s.profiles.length }); s.toast('Reload broadcast'); }}>Reload profiles</Button>
            <Button icon="activity" size="sm" onClick={() => { void s.send('presence:heartbeat', { online: true }); s.toast('Heartbeat sent'); }}>Heartbeat</Button>
          </div>
        </div>
        <div className="sync-flow"><span className="flow-node"><Icon name="monitor" size={15} />EXE</span><i /><span className="flow-node mid"><Icon name="globe" size={15} />Supabase Realtime</span><i /><span className="flow-node"><Icon name="phone" size={15} />APK</span></div>
        <div className="event-log">
          <div className="event-head"><span>Time</span><span>Topic</span><span>Route</span><span>Payload</span></div>
          {s.syncEvents.length === 0 && <div className="event-empty">No messages yet — send a command above.</div>}
          {s.syncEvents.slice(0, 24).map((e) => (
            <div className="event-row" key={e.id}>
              <time>{new Date(e.sentAt).toLocaleTimeString()}</time>
              <code className="topic">{e.topic}</code>
              <span>{DEVICE_LABEL[e.from]} → {e.to ? DEVICE_LABEL[e.to] : 'all'}</span>
              <code>{JSON.stringify(e.payload).slice(0, 60)}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
