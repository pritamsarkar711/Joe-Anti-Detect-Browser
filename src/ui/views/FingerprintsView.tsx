import { useMemo, useState } from 'react';
import { useStore } from '@/state/store';
import { DEVICE_TEMPLATES, TEMPLATE_GROUPS, checkProfile, type OSType } from '@joe/core';
import { surfaces } from '@joe/fingerprint';
import { Icon } from '@/ui/Icons';
import { Badge, Stat, Button } from '@/ui/Primitives';

const OS_ICON: Record<OSType, string> = { Windows: '⊞', macOS: '⌘', Android: '◧', Linux: '◇' };

export function FingerprintsView() {
  const s = useStore();
  const [active, setActive] = useState(DEVICE_TEMPLATES[0].id);
  const tpl = DEVICE_TEMPLATES.find((t) => t.id === active)!;
  const sample = useMemo(() => s.profiles.find((p) => p.templateId === active), [s.profiles, active]);
  const spec = sample?.fingerprint;
  const rows = spec ? surfaces(spec) : [];

  const dist = useMemo(() => {
    const m = new Map<string, number>();
    s.profiles.forEach((p) => m.set(p.templateId, (m.get(p.templateId) ?? 0) + 1));
    return m;
  }, [s.profiles]);
  const avg = Math.round(s.profiles.reduce((a, p) => a + checkProfile(p).score, 0) / Math.max(1, s.profiles.length));

  return (
    <div className="view">
      <div className="stat-row">
        <Stat label="Templates" value={DEVICE_TEMPLATES.length} icon="layers" />
        <Stat label="Coherent profiles" value={`${s.profiles.filter((p) => checkProfile(p).score >= 90).length}/${s.profiles.length}`} icon="shield" tone="teal" />
        <Stat label="Avg. score" value={`${avg}%`} icon="activity" tone="amber" />
        <Stat label="JS surfaces" value={rows.filter((r) => r.level === 'js').length || 8} icon="cpu" tone="blue" />
      </div>

      <div className="notice big-notice"><Icon name="info" size={17} /><div><strong>What this covers — and what it doesn't</strong><span>Every JS-observable surface is derived from one coherent device template, so profiles don't contain contradictions (Windows UA + Apple GPU, mobile UA + desktop screen, mismatched Client Hints). Engine-level signals — TLS/JA4 ClientHello, HTTP/2 frame order, font rasterisation, CDP side channels — come from the browser binary itself. Full parity with commercial products requires a source-patched Chromium fork; this project documents that boundary instead of claiming it.</span></div></div>

      <div className="fp-layout">
        <div className="panel fp-library">
          <div className="panel-head"><div className="panel-title"><Icon name="layers" size={17} /><h2>Device library</h2></div><span>{DEVICE_TEMPLATES.length}</span></div>
          <div className="fp-groups">
            {TEMPLATE_GROUPS.map(({ os, items }) => (
              <div key={os} className="fp-group">
                <span className="fp-os">{OS_ICON[os]} {os}</span>
                {items.map((t) => (
                  <button key={t.id} className={`fp-item ${active === t.id ? 'active' : ''}`} onClick={() => setActive(t.id)}>
                    <span className="fp-item-icon"><Icon name={t.mobile ? 'phone' : 'monitor'} size={16} /></span>
                    <span className="fp-item-text"><strong>{t.label}</strong><em>{t.screens[0].width}×{t.screens[0].height} · Chrome {t.chromeMajor}</em></span>
                    <span className="fp-item-count">{dist.get(t.id) ?? 0}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="panel fp-detail">
          <div className="fp-detail-head">
            <div><span className="fp-kicker">{tpl.os} · {tpl.osVersion}</span><h2>{tpl.label}</h2><p>{tpl.ua}</p></div>
            <Badge tone="ok" dot>coherent</Badge>
          </div>
          <div className="kv-grid tight">
            <div><span>Platform</span><strong>{tpl.platform}</strong></div>
            <div><span>Chrome</span><strong>{tpl.chromeMajor}</strong></div>
            <div><span>Screens</span><strong>{tpl.screens.map((x) => `${x.width}×${x.height}`).join(', ')}</strong></div>
            <div><span>CPU / RAM</span><strong>{tpl.cores.join('/')} cores · {tpl.memoryGb.join('/')} GB</strong></div>
            <div><span>Timezones</span><strong>{tpl.timezones.join(', ')}</strong></div>
            <div><span>Locales</span><strong>{tpl.locales.join(', ')}</strong></div>
          </div>
          <div className="drawer-section-head"><h3>Patched surfaces</h3><span>{rows.length || 11} total</span></div>
          <div className="surface-list compact-list">
            {(rows.length ? rows : [
              { key: 'ua', label: 'User agent', value: tpl.ua.slice(0, 40) + '…', level: 'js' as const },
              { key: 'hints', label: 'Client hints', value: `${tpl.os} · ${tpl.chromeMajor}`, level: 'js' as const },
              { key: 'screen', label: 'Screen', value: `${tpl.screens[0].width}×${tpl.screens[0].height}`, level: 'js' as const },
              { key: 'gpu', label: 'WebGL', value: tpl.gpus[0].renderer.slice(0, 40) + '…', level: 'js' as const },
              { key: 'tz', label: 'Timezone / locale', value: `${tpl.timezones[0]} · ${tpl.locales[0]}`, level: 'js' as const },
              { key: 'canvas', label: 'Canvas / audio', value: 'seeded per-profile noise', level: 'js' as const },
              { key: 'webrtc', label: 'WebRTC', value: 'private candidates stripped', level: 'js' as const },
              { key: 'tls', label: 'TLS / JA4', value: 'native Chromium stack', level: 'engine' as const },
            ]).map((r) => <div className="surface-row" key={r.key}><span>{r.label}</span><code>{r.value}</code><Badge tone={r.level === 'js' ? 'ok' : 'neutral'}>{r.level}</Badge></div>)}
          </div>
          <div className="fp-foot"><span className="muted">Used by {dist.get(active) ?? 0} profiles</span><Button icon="plus" size="sm" variant="primary" onClick={() => s.setCreateOpen(true)}>Create with this template</Button></div>
        </div>
      </div>
    </div>
  );
}
