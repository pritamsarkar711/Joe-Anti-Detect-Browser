import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore, type View } from '@/state/store';
import { Icon, Logo, type IconName } from './Icons';
import { Button, IconButton, Badge } from './Primitives';

const NAV: Array<{ id: View; label: string; icon: IconName }> = [
  { id: 'profiles', label: 'Profiles', icon: 'grid' },
  { id: 'proxies', label: 'Proxies', icon: 'globe' },
  { id: 'devices', label: 'Devices', icon: 'devices' },
  { id: 'fingerprints', label: 'Fingerprints', icon: 'fingerprint' },
  { id: 'activity', label: 'Activity', icon: 'activity' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export function Shell({ children }: { children: ReactNode }) {
  const s = useStore();
  const [collapsed, setCollapsed] = useState(false);
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('All');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true); }
      if (e.key === 'Escape') { setPalette(false); s.setSelectedId(null); s.setCreateOpen(false); }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); setCollapsed((v) => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s]);

  useEffect(() => { if (palette) setTimeout(() => searchRef.current?.focus(), 20); }, [palette]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const nav = NAV.filter((n) => !q || n.label.toLowerCase().includes(q)).map((n) => ({ kind: 'nav' as const, id: n.id, label: n.label, icon: n.icon, meta: 'Go to' }));
    const profiles = (q ? s.profiles.filter((p) => p.name.toLowerCase().includes(q) || p.group.toLowerCase().includes(q)).slice(0, 8) : s.profiles.slice(0, 5))
      .map((p) => ({ kind: 'profile' as const, id: p.id, label: p.name, icon: 'grid' as IconName, meta: `${p.group} · ${p.fingerprint.uaClientHints.platform}` }));
    const actions = [{ kind: 'action' as const, id: 'new', label: 'New profile', icon: 'plus' as IconName, meta: 'Create' },
      { kind: 'action' as const, id: 'gen', label: 'Bulk generate profiles', icon: 'layers' as IconName, meta: 'Create' }]
      .filter((a) => !q || a.label.toLowerCase().includes(q));
    return [...nav, ...actions, ...profiles].slice(0, 14);
  }, [query, s.profiles]);

  const running = s.profiles.filter((p) => p.status === 'running').length;

  return (
    <div className={`shell ${collapsed ? 'collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="side-brand">
          <Logo size={32} />
          <div className="side-brand-text"><strong>Joe Browser</strong><span>Workspace</span></div>
          <IconButton icon="panel" label="Collapse sidebar" className="collapse-btn" onClick={() => setCollapsed((v) => !v)} />
        </div>

        <nav className="side-nav">
          <span className="side-label">Workspace</span>
          {NAV.map((n) => (
            <button key={n.id} className={`nav-item ${s.view === n.id ? 'active' : ''}`} onClick={() => { s.setView(n.id); s.setSelectedId(null); }} title={n.label}>
              <Icon name={n.icon} size={18} /><span>{n.label}</span>
              {n.id === 'profiles' && <em>{s.profiles.length}</em>}
              {n.id === 'proxies' && <em>{s.proxies.length}</em>}
              {n.id === 'devices' && <em className={running ? 'hot' : ''}>{s.devices.filter((d) => d.online).length}</em>}
            </button>
          ))}
        </nav>

        <div className="side-groups">
          <span className="side-label">Groups</span>
          <button className={`group-item ${groupFilter === 'All' ? 'active' : ''}`} onClick={() => { setGroupFilter('All'); s.setView('profiles'); window.dispatchEvent(new CustomEvent('joe:group', { detail: 'All' })); }}>
            <i className="group-dot all" /><span>All profiles</span><em>{s.profiles.length}</em>
          </button>
          {s.groups.slice(0, 9).map((g, i) => (
            <button key={g} className={`group-item ${groupFilter === g ? 'active' : ''}`} onClick={() => { setGroupFilter(g); s.setView('profiles'); window.dispatchEvent(new CustomEvent('joe:group', { detail: g })); }}>
              <i className="group-dot" style={{ background: ['#8b93ff', '#4ad9b6', '#f0b45e', '#f0789a', '#69b7ff', '#b18cff', '#7ed1a0', '#d9a2f0', '#e9c46a'][i % 9] }} />
              <span>{g}</span><em>{s.profiles.filter((p) => p.group === g).length}</em>
            </button>
          ))}
        </div>

        <div className="side-foot">
          <div className="sync-chip"><i className="pulse" /><span>Sync active</span><Badge tone="ok" dot>Live</Badge></div>
          <div className="side-version">v{s.appVersion} · local-first</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <IconButton icon="panel" label="Toggle sidebar" onClick={() => setCollapsed((v) => !v)} />
            <div className="crumb"><span>Workspace</span><Icon name="chevron" size={13} /><strong>{NAV.find((n) => n.id === s.view)?.label}</strong></div>
          </div>
          <div className="topbar-right">
            <button className="search-trigger" onClick={() => setPalette(true)}>
              <Icon name="search" size={15} /><span>Search profiles, actions…</span><kbd>⌘K</kbd>
            </button>
            <div className="top-devices" title="Connected devices">
              <Icon name="monitor" size={15} className={s.devices[0]?.online ? 'on' : ''} />
              <Icon name="phone" size={14} className={s.devices[1]?.online ? 'on' : ''} />
            </div>
            <IconButton icon={s.settings.theme === 'dark' ? 'sun' : 'moon'} label="Toggle theme" onClick={() => s.setSetting('theme', s.settings.theme === 'dark' ? 'light' : 'dark')} />
            <Button icon="plus" variant="primary" size="sm" onClick={() => s.setCreateOpen(true)}>New profile</Button>
            <div className="avatar" title="Local workspace">JB</div>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>

      {palette && (
        <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setPalette(false); }}>
          <div className="palette" role="dialog" aria-label="Command palette">
            <div className="palette-input"><Icon name="search" size={17} /><input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search or jump to…" /><kbd>ESC</kbd></div>
            <div className="palette-list">
              {results.length === 0 && <div className="palette-empty">No matches</div>}
              {results.map((r, i) => (
                <button key={`${r.kind}-${r.id}-${i}`} className="palette-row" onClick={() => {
                  setPalette(false); setQuery('');
                  if (r.kind === 'nav') s.setView(r.id as View);
                  else if (r.kind === 'profile') { s.setView('profiles'); s.setSelectedId(r.id); }
                  else s.setCreateOpen(true);
                }}>
                  <Icon name={r.icon} size={16} /><span>{r.label}</span><em>{r.meta}</em>
                </button>
              ))}
            </div>
            <div className="palette-foot"><span>↑↓ navigate</span><span>↵ open</span><span>esc close</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Toasts() {
  const s = useStore();
  return (
    <div className="toasts">
      {s.toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <Icon name={t.kind === 'err' ? 'warn' : t.kind === 'warn' ? 'info' : 'check'} size={16} />
          <span>{t.text}</span>
          <button onClick={() => s.dismissToast(t.id)} aria-label="Dismiss"><Icon name="close" size={13} /></button>
        </div>
      ))}
    </div>
  );
}
