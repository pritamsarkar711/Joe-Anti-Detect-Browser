import { useMemo, useState } from 'react';
import { useStore } from '@/state/store';
import { checkProfile, DEVICE_TEMPLATES, countryCode, proxyUrl, exportWorkspace, downloadFile } from '@joe/core';
import { surfaces, buildInjectionScript } from '@joe/fingerprint';
import { Icon } from '@/ui/Icons';
import { Button, IconButton, Badge, Progress, Empty, Segmented } from '@/ui/Primitives';

type Tab = 'overview' | 'fingerprint' | 'network' | 'data';

export function ProfileDetail() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>('overview');
  const p = s.profiles.find((x) => x.id === s.selectedId);
  const report = useMemo(() => p ? checkProfile(p) : null, [p]);
  const spec = p?.fingerprint;

  if (!p || !report || !spec) return null;
  const px = s.proxies.find((x) => x.id === p.proxyId);
  const tpl = DEVICE_TEMPLATES.find((t) => t.id === p.templateId);
  const rows = surfaces(spec);

  const duplicate = () => {
    s.addProfiles([{ ...structuredClone(p), id: `${p.id}_copy_${Date.now().toString(36)}`, name: `${p.name} (copy)`, status: 'ready', createdAt: new Date().toISOString(), lastLaunchedAt: null, revision: 1 }]);
    s.toast('Profile duplicated'); s.setSelectedId(null);
  };
  const exportOne = () => { downloadFile(`${p.name.replace(/\s+/g, '-').toLowerCase()}.json`, JSON.stringify(exportWorkspace([p], px ? [px] : [], [p.group]), null, 2)); s.toast('Profile exported'); };
  const copyScript = () => { navigator.clipboard?.writeText(buildInjectionScript(spec)); s.toast('Injection script copied'); };

  return (
    <div className="drawer-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) s.setSelectedId(null); }}>
      <aside className="drawer drawer-wide" role="dialog" aria-label="Profile details">
        <div className="drawer-head">
          <div className="detail-title">
            <span className={`os-badge big os-${p.os.toLowerCase()}`}>{p.os === 'Windows' ? '⊞' : p.os === 'macOS' ? '⌘' : p.os === 'Android' ? '◧' : '◇'}</span>
            <div><h2>{p.name}</h2><p>{p.group} · rev {p.revision} · {p.id}</p></div>
          </div>
          <div className="detail-actions">
            <IconButton icon="copy" label="Duplicate" onClick={duplicate} />
            <IconButton icon="download" label="Export" onClick={exportOne} />
            <IconButton icon="close" label="Close" onClick={() => s.setSelectedId(null)} />
          </div>
        </div>

        <div className="detail-toolbar">
          <Segmented value={tab} onChange={setTab} options={[
            { value: 'overview', label: 'Overview' }, { value: 'fingerprint', label: 'Fingerprint' },
            { value: 'network', label: 'Network' }, { value: 'data', label: 'Data' },
          ]} />
          <div className="detail-launch">
            <Button icon={p.status === 'running' ? 'stop' : 'play'} variant={p.status === 'running' ? 'outline' : 'primary'} size="sm" onClick={() => s.setStatus([p.id], p.status === 'running' ? 'stopped' : 'running', p.status === 'running' ? null : s.settings.defaultDevice)}>
              {p.status === 'running' ? 'Stop' : 'Launch'}
            </Button>
          </div>
        </div>

        <div className="drawer-body">
          {tab === 'overview' && (
            <div className="detail-stack">
              <div className="score-card">
                <div className="score-ring" style={{ background: `conic-gradient(var(--accent) 0deg, var(--teal) ${report.score * 3.6}deg, var(--surface-3) ${report.score * 3.6}deg)` }}><strong>{report.score}</strong><span>/ 100</span></div>
                <div><h3>Consistency grade {report.grade}</h3><p>{report.checked} checks · {report.issues.filter((i) => i.severity === 'critical').length} critical · {report.issues.filter((i) => i.severity === 'warning').length} warnings</p><Progress value={report.score} /></div>
              </div>
              <div className="kv-grid">
                <div><span>Device</span><strong>{tpl?.label}</strong></div>
                <div><span>Engine</span><strong>Chromium {spec.chromeMajor}</strong></div>
                <div><span>Screen</span><strong>{spec.screen.width}×{spec.screen.height} @ {spec.screen.dpr}x</strong></div>
                <div><span>Timezone</span><strong>{spec.timezone}</strong></div>
                <div><span>Locale</span><strong>{spec.locale}</strong></div>
                <div><span>Hardware</span><strong>{spec.cores} cores · {spec.memoryGb} GB</strong></div>
                <div><span>Status</span><strong><Badge tone={p.status === 'running' ? 'ok' : 'neutral'} dot>{p.status}</Badge></strong></div>
                <div><span>Last launch</span><strong>{p.lastLaunchedAt ? new Date(p.lastLaunchedAt).toLocaleString() : 'Never'}</strong></div>
              </div>
              <div className="drawer-section-head"><h3>Checks</h3><span>{report.issues.length} results</span></div>
              <div className="issue-list">
                {report.issues.map((i) => (
                  <div className={`issue issue-${i.severity}`} key={i.id}>
                    <Icon name={i.severity === 'critical' ? 'warn' : i.severity === 'warning' ? 'info' : 'shield'} size={15} />
                    <div><strong>{i.surface}</strong><span>{i.message}</span><em>{i.hint}</em></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'fingerprint' && (
            <div className="detail-stack">
              <div className="notice"><Icon name="info" size={16} /><span>JS-level surfaces are patched per profile. TLS/JA4, HTTP/2 and font rasterisation are engine-level and need a patched Chromium build.</span></div>
              <div className="surface-list">
                {rows.map((r) => (
                  <div className="surface-row" key={r.key}>
                    <span>{r.label}</span><code>{r.value}</code>
                    <Badge tone={r.level === 'js' ? 'ok' : 'neutral'}>{r.level}</Badge>
                  </div>
                ))}
              </div>
              <div className="drawer-section-head"><h3>Injection payload</h3><span>{buildInjectionScript(spec).length} bytes</span></div>
              <div className="code-block"><code>{buildInjectionScript(spec).slice(0, 420)}…</code></div>
              <Button icon="copy" size="sm" onClick={copyScript}>Copy full script</Button>
            </div>
          )}

          {tab === 'network' && (
            <div className="detail-stack">
              {px ? (
                <div className="proxy-card">
                  <div className="proxy-flag">{countryCode(px.country)}</div>
                  <div><strong>{px.name}</strong><code>{proxyUrl(px)}</code></div>
                  <Badge tone={px.status === 'ok' ? 'ok' : px.status === 'failed' ? 'err' : 'neutral'} dot>{px.status}</Badge>
                </div>
              ) : <Empty icon="globe" title="Direct connection" hint="No proxy assigned to this profile." />}
              <div className="toggle-row"><div><strong>WebRTC mode</strong><span>{spec.webrtcMode === 'replace' ? 'Private / mDNS candidates stripped' : spec.webrtcMode}</span></div><Badge tone="violet">{spec.webrtcMode}</Badge></div>
              <div className="toggle-row"><div><strong>Do Not Track</strong><span>navigator.doNotTrack + header</span></div><Badge tone={spec.doNotTrack ? 'ok' : 'neutral'}>{spec.doNotTrack ? 'on' : 'off'}</Badge></div>
              <div className="form-grid">
                <label className="field"><span className="field-label">Assign proxy</span>
                  <select className="input" value={p.proxyId ?? ''} onChange={(e) => s.updateProfile(p.id, { proxyId: e.target.value || null })}>
                    <option value="">Direct</option>{s.proxies.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </label>
              </div>
            </div>
          )}

          {tab === 'data' && (
            <div className="detail-stack">
              <div className="notice"><Icon name="shield" size={16} /><span>Each profile gets its own cookie store, localStorage, cache and IndexedDB partition. Nothing is shared between profiles.</span></div>
              <div className="kv-grid">
                <div><span>Created</span><strong>{new Date(p.createdAt).toLocaleString()}</strong></div>
                <div><span>Updated</span><strong>{new Date(p.updatedAt).toLocaleString()}</strong></div>
                <div><span>Notes</span><strong>{p.notes || '—'}</strong></div>
                <div><span>Device</span><strong>{p.device ?? 'not launched'}</strong></div>
              </div>
              <div className="button-row">
                <Button icon="download" size="sm" onClick={exportOne}>Export profile</Button>
                <Button icon="copy" size="sm" onClick={duplicate}>Duplicate</Button>
                <Button icon="trash" size="sm" variant="danger" onClick={() => { s.deleteProfiles([p.id]); s.toast('Profile deleted'); }}>Delete</Button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
