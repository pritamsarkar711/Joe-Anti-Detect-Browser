import { useMemo, useState } from 'react';
import { useStore } from '@/state/store';
import { DEVICE_TEMPLATES, TEMPLATE_GROUPS, createProfile, generateProfiles, checkConsistency, COUNTRY_FLAG, type OSType } from '@joe/core';
import { Icon } from '@/ui/Icons';
import { Button, IconButton, Field, Badge, Toggle, Progress } from '@/ui/Primitives';

const OS_ICON: Record<OSType, string> = { Windows: '⊞', macOS: '⌘', Android: '◧', Linux: '◇' };

export function CreateProfile() {
  const s = useStore();
  const [name, setName] = useState('');
  const [count, setCount] = useState(1);
  const [templateId, setTemplateId] = useState(DEVICE_TEMPLATES[0].id);
  const [group, setGroup] = useState('Default');
  const [newGroup, setNewGroup] = useState('');
  const [tags, setTags] = useState('');
  const [proxyId, setProxyId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [tz, setTz] = useState('');
  const [locale, setLocale] = useState('');
  const [webrtc, setWebrtc] = useState<'disabled' | 'proxy' | 'replace'>('replace');
  const [dnt, setDnt] = useState(false);

  const template = DEVICE_TEMPLATES.find((t) => t.id === templateId)!;
  const input = useMemo(() => ({
    name: name || 'New profile',
    templateId,
    group,
    tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    proxyId: proxyId || null,
    notes,
    overrides: {
      ...(tz ? { timezone: tz } : {}), ...(locale ? { locale } : {}),
      webrtcMode: webrtc, doNotTrack: dnt ? '1' : null,
    },
  }), [name, templateId, group, tags, proxyId, notes, tz, locale, webrtc, dnt]);

  const preview = useMemo(() => createProfile(input, 1), [input]);
  const report = useMemo(() => checkConsistency(preview.fingerprint), [preview]);

  const submit = () => {
    const g = newGroup.trim() || group;
    if (newGroup.trim()) s.addGroup(g);
    const { name: _ignored, ...base } = { ...input, group: g, seed: `ws::${Date.now()}` };
    const made = count === 1
      ? [s.createOne({ ...input, group: g, name: name.trim() || `Profile ${s.profiles.length + 1}` })]
      : generateProfiles(count, base, name.trim() || 'Profile');
    if (count > 1) s.addProfiles(made);
    s.toast(`${made.length} profile${made.length === 1 ? '' : 's'} created`);
    s.setCreateOpen(false);
    setName(''); setCount(1); setNewGroup(''); setTags(''); setNotes('');
  };

  if (!s.createOpen) return null;
  return (
    <div className="drawer-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) s.setCreateOpen(false); }}>
      <aside className="drawer drawer-wide" role="dialog" aria-label="Create profile">
        <div className="drawer-head">
          <div><h2>New profile</h2><p>Coherent device · isolated storage · own proxy</p></div>
          <IconButton icon="close" label="Close" onClick={() => s.setCreateOpen(false)} />
        </div>

        <div className="drawer-body">
          <div className="form-grid">
            <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Storefront · US" /></Field>
            <Field label="Quantity" hint="No limit"><input className="input" type="number" min={1} max={100000} value={count} onChange={(e) => setCount(Math.max(1, Math.min(100000, Number(e.target.value) || 1)))} /></Field>
            <Field label="Group">
              <div className="inline-field">
                <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>{s.groups.map((g) => <option key={g}>{g}</option>)}</select>
                <input className="input" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="+ new" />
              </div>
            </Field>
            <Field label="Tags"><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="priority, review" /></Field>
          </div>

          <div className="drawer-section">
            <div className="drawer-section-head"><h3>Device template</h3><span>{DEVICE_TEMPLATES.length} coherent presets</span></div>
            <div className="template-groups">
              {TEMPLATE_GROUPS.map(({ os, items }) => (
                <div key={os} className="template-group">
                  <span className="template-os">{OS_ICON[os]} {os}</span>
                  <div className="template-cards">
                    {items.map((t) => (
                      <button key={t.id} className={`template-card ${templateId === t.id ? 'active' : ''}`} onClick={() => setTemplateId(t.id)}>
                        <span className="tc-top"><Icon name={t.mobile ? 'phone' : 'monitor'} size={16} /><i className="tc-check"><Icon name="check" size={11} /></i></span>
                        <strong>{t.label}</strong>
                        <em>{t.screens[0].width}×{t.screens[0].height} · {t.cores[0]} cores</em>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="drawer-section">
            <div className="drawer-section-head"><h3>Network</h3><span>proxy per profile</span></div>
            <div className="form-grid">
              <Field label="Proxy">
                <select className="input" value={proxyId} onChange={(e) => setProxyId(e.target.value)}>
                  <option value="">Direct connection</option>
                  {s.proxies.map((p) => <option key={p.id} value={p.id}>{COUNTRY_FLAG[p.country] ?? '🌐'} {p.name} · {p.protocol}://{p.host}:{p.port}</option>)}
                </select>
              </Field>
              <Field label="Notes"><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note" /></Field>
            </div>
          </div>

          <button className="advanced-toggle" onClick={() => setAdvanced((v) => !v)}>
            <Icon name="sliders" size={15} /><span>Advanced fingerprint overrides</span><Icon name={advanced ? 'chevronDown' : 'chevron'} size={14} />
          </button>
          {advanced && (
            <div className="advanced-body">
              <div className="form-grid">
                <Field label="Timezone"><select className="input" value={tz} onChange={(e) => setTz(e.target.value)}><option value="">Auto ({template.timezones[0]})</option>{template.timezones.map((z) => <option key={z}>{z}</option>)}</select></Field>
                <Field label="Locale"><select className="input" value={locale} onChange={(e) => setLocale(e.target.value)}><option value="">Auto ({template.locales[0]})</option>{template.locales.map((l) => <option key={l}>{l}</option>)}</select></Field>
              </div>
              <div className="toggle-row"><div><strong>WebRTC local-IP protection</strong><span>Strip private / mDNS candidates</span></div><select className="input compact" value={webrtc} onChange={(e) => setWebrtc(e.target.value as typeof webrtc)}><option value="replace">Replace candidates</option><option value="proxy">Proxy only</option><option value="disabled">Disable WebRTC</option></select></div>
              <div className="toggle-row"><div><strong>Do Not Track</strong><span>Send DNT: 1 header</span></div><Toggle checked={dnt} onChange={setDnt} label="Do Not Track" /></div>
            </div>
          )}

          <div className="preview-card">
            <div className="preview-head"><span className="preview-icon"><Icon name="shield" size={16} /></span><div><strong>Fingerprint preview</strong><em>{preview.fingerprint.uaClientHints.platform} · Chrome {preview.fingerprint.chromeMajor} · {preview.fingerprint.screen.width}×{preview.fingerprint.screen.height}</em></div><Badge tone={report.score >= 90 ? 'ok' : 'warn'}>{report.grade} · {report.score}</Badge></div>
            <Progress value={report.score} />
            <div className="preview-chips">
              <span>{preview.fingerprint.timezone}</span><span>{preview.fingerprint.locale}</span><span>{preview.fingerprint.cores} cores</span><span>{preview.fingerprint.memoryGb} GB</span><span>{preview.fingerprint.gpu.vendor}</span>
            </div>
            {report.issues.filter((i) => i.severity !== 'info').slice(0, 2).map((i) => <div className="preview-warn" key={i.id}><Icon name="warn" size={13} />{i.message}</div>)}
          </div>
        </div>

        <div className="drawer-foot">
          <span className="muted">{count} profile{count === 1 ? '' : 's'} · isolated storage</span>
          <div><Button onClick={() => s.setCreateOpen(false)}>Cancel</Button><Button icon="spark" variant="primary" onClick={submit}>Create {count > 1 ? `${count} profiles` : 'profile'}</Button></div>
        </div>
      </aside>
    </div>
  );
}
