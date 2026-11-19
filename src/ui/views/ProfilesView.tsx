import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/state/store';
import { DEVICE_TEMPLATES, COUNTRY_FLAG, checkProfile, exportWorkspace, downloadFile, type BrowserProfile } from '@joe/core';
import { Icon } from '@/ui/Icons';
import { Button, IconButton, Badge, Empty, Stat } from '@/ui/Primitives';

const PAGE_SIZE = 25;
type Sort = 'name' | 'created' | 'launched' | 'score';

export function ProfilesView() {
  const s = useStore();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('All');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState<Sort>('created');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  useEffect(() => {
    const h = (e: Event) => { setGroup((e as CustomEvent<string>).detail); setPage(0); };
    window.addEventListener('joe:group', h);
    return () => window.removeEventListener('joe:group', h);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = s.profiles.filter((p) =>
      (!q || p.name.toLowerCase().includes(q) || p.group.toLowerCase().includes(q) || p.tags.some((t) => t.includes(q)) || p.templateId.includes(q)) &&
      (group === 'All' || p.group === group) &&
      (status === 'all' || p.status === status));
    const cmp: Record<Sort, (a: BrowserProfile, b: BrowserProfile) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      created: (a, b) => b.createdAt.localeCompare(a.createdAt),
      launched: (a, b) => (b.lastLaunchedAt ?? '').localeCompare(a.lastLaunchedAt ?? ''),
      score: (a, b) => checkProfile(b).score - checkProfile(a).score,
    };
    return [...out].sort(cmp[sort]);
  }, [s.profiles, search, group, status, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = Math.min(page, pages - 1);
  const rows = filtered.slice(cur * PAGE_SIZE, cur * PAGE_SIZE + PAGE_SIZE);
  const allOnPage = rows.length > 0 && rows.every((p) => selected.has(p.id));

  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((prev) => {
    const n = new Set(prev);
    rows.forEach((p) => allOnPage ? n.delete(p.id) : n.add(p.id));
    return n;
  });
  const clearSel = () => setSelected(new Set());
  const ids = [...selected];
  const bulk = (fn: () => void, msg: string) => { fn(); s.toast(msg); clearSel(); };

  const launch = (list: string[]) => bulk(() => s.setStatus(list, 'running', s.settings.defaultDevice), `${list.length} launched`);
  const stop = (list: string[]) => bulk(() => s.setStatus(list, 'stopped', null), `${list.length} stopped`);
  const remove = (list: string[]) => bulk(() => s.deleteProfiles(list), `${list.length} deleted`);
  const exportSel = (list: string[]) => {
    const chosen = s.profiles.filter((p) => list.includes(p.id));
    downloadFile(`joe-profiles-${list.length}.json`, JSON.stringify(exportWorkspace(chosen, [], []), null, 2));
    s.toast(`${list.length} exported`); clearSel();
  };

  const stats = useMemo(() => ({
    total: s.profiles.length,
    running: s.profiles.filter((p) => p.status === 'running').length,
    groups: new Set(s.profiles.map((p) => p.group)).size,
    avg: Math.round(s.profiles.reduce((a, p) => a + checkProfile(p).score, 0) / Math.max(1, s.profiles.length)),
  }), [s.profiles]);

  return (
    <div className="view">
      <div className="stat-row">
        <Stat label="Profiles" value={stats.total} icon="layers" />
        <Stat label="Running" value={stats.running} icon="play" tone="teal" />
        <Stat label="Groups" value={stats.groups} icon="folder" tone="blue" />
        <Stat label="Avg. consistency" value={`${stats.avg}%`} icon="shield" tone="amber" />
      </div>

      <div className="panel">
        <div className="toolbar">
          <div className="toolbar-left">
            <div className="search-box"><Icon name="search" size={15} /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder="Search" aria-label="Search profiles" /></div>
            <div className="select-wrap"><Icon name="folder" size={14} /><select value={group} onChange={(e) => { setGroup(e.target.value); setPage(0); }} aria-label="Group">
              <option value="All">All groups</option>{s.groups.map((g) => <option key={g}>{g}</option>)}
            </select><Icon name="chevronDown" size={13} /></div>
            <div className="select-wrap"><Icon name="filter" size={14} /><select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="Status">
              <option value="all">All status</option><option value="ready">Ready</option><option value="running">Running</option><option value="stopped">Stopped</option><option value="error">Error</option>
            </select><Icon name="chevronDown" size={13} /></div>
            <div className="select-wrap"><Icon name="sliders" size={14} /><select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
              <option value="created">Newest</option><option value="name">Name</option><option value="launched">Last launch</option><option value="score">Consistency</option>
            </select><Icon name="chevronDown" size={13} /></div>
          </div>
          <div className="toolbar-right">
            {selected.size > 0 ? (
              <>
                <span className="sel-count">{selected.size} selected</span>
                <Button icon="play" size="sm" onClick={() => launch(ids)}>Launch</Button>
                <Button icon="stop" size="sm" onClick={() => stop(ids)}>Stop</Button>
                <Button icon="download" size="sm" onClick={() => exportSel(ids)}>Export</Button>
                <Button icon="trash" size="sm" variant="danger" onClick={() => remove(ids)}>Delete</Button>
                <IconButton icon="close" label="Clear selection" onClick={clearSel} />
              </>
            ) : (
              <>
                <span className="result-count">{filtered.length} results</span>
                <IconButton icon="refresh" label="Refresh" onClick={() => s.toast('Workspace up to date', 'info')} />
                <Button icon="upload" size="sm" onClick={() => s.setView('settings')}>Import</Button>
                <Button icon="plus" size="sm" variant="primary" onClick={() => s.setCreateOpen(true)}>Create</Button>
              </>
            )}
          </div>
        </div>

        {rows.length === 0 ? (
          <Empty icon="grid" title="No profiles here" hint="Adjust the filters, or create a new profile." action={<Button icon="plus" variant="primary" onClick={() => s.setCreateOpen(true)}>Create profile</Button>} />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>
                <th className="col-check"><input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select page" /></th>
                <th>Profile</th><th>Device</th><th>Proxy</th><th>Score</th><th>Status</th><th>Last launch</th><th className="col-actions" />
              </tr></thead>
              <tbody>
                {rows.map((p) => {
                  const rep = checkProfile(p);
                  const px = s.proxies.find((x) => x.id === p.proxyId);
                  const tpl = DEVICE_TEMPLATES.find((t) => t.id === p.templateId);
                  return (
                    <tr key={p.id} className={selected.has(p.id) ? 'row-sel' : ''} onClick={() => s.setSelectedId(p.id)}>
                      <td className="col-check" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} /></td>
                      <td>
                        <div className="cell-profile">
                          <span className={`os-badge os-${p.os.toLowerCase()}`}>{p.os === 'Windows' ? '⊞' : p.os === 'macOS' ? '⌘' : p.os === 'Android' ? '◧' : '◇'}</span>
                          <div><strong>{p.name}</strong><span>{p.group}{p.tags.length ? ` · ${p.tags.join(', ')}` : ''}</span></div>
                        </div>
                      </td>
                      <td><div className="cell-device"><span>{tpl?.label ?? p.templateId}</span><em>Chrome {p.fingerprint.chromeMajor} · {p.fingerprint.screen.width}×{p.fingerprint.screen.height}</em></div></td>
                      <td>{px ? <span className="cell-proxy">{COUNTRY_FLAG[px.country] ?? '🌐'} {px.host}:{px.port}</span> : <span className="muted">Direct</span>}</td>
                      <td><div className="score"><span className={`score-dot g${rep.grade}`} />{rep.score}</div></td>
                      <td><Badge tone={p.status === 'running' ? 'ok' : p.status === 'error' ? 'err' : 'neutral'} dot>{p.status}</Badge></td>
                      <td className="muted nowrap">{p.lastLaunchedAt ? new Date(p.lastLaunchedAt).toLocaleDateString() : '—'}</td>
                      <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                        <IconButton icon={p.status === 'running' ? 'stop' : 'play'} label={p.status === 'running' ? 'Stop' : 'Launch'} onClick={() => p.status === 'running' ? stop([p.id]) : launch([p.id])} />
                        <IconButton icon="chevron" label="Details" onClick={() => s.setSelectedId(p.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="pager">
          <span>Page {cur + 1} of {pages} · {filtered.length} profiles</span>
          <div>
            <IconButton icon="arrowLeft" label="Previous page" disabled={cur === 0} onClick={() => setPage(cur - 1)} />
            <span className="page-num">{cur + 1}</span>
            <IconButton icon="chevron" label="Next page" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} />
          </div>
        </div>
      </div>
    </div>
  );
}
