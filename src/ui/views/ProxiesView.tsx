import { useMemo, useState } from 'react';
import { useStore } from '@/state/store';
import { countryCode, parseProxy, proxyUrl, type ProxyConfig, type ProxyProtocol } from '@joe/core';
import { Icon } from '@/ui/Icons';
import { Button, IconButton, Badge, Empty, Field, Stat } from '@/ui/Primitives';

export function ProxiesView() {
  const s = useStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [bulk, setBulk] = useState('');
  const [raw, setRaw] = useState('');
  const [name, setName] = useState('');
  const [protocol, setProtocol] = useState<ProxyProtocol>('socks5');

  const parsed = useMemo(() => parseProxy(raw), [raw]);
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const ids = [...selected];

  const add = () => {
    if (!parsed.valid || !parsed.host) { s.toast(parsed.error ?? 'Invalid proxy', 'err'); return; }
    const p: ProxyConfig = {
      id: `px_${Date.now().toString(36)}`, name: name.trim() || `${parsed.host}:${parsed.port}`,
      protocol: parsed.protocol, host: parsed.host, port: parsed.port,
      username: parsed.username, password: parsed.password, country: 'XX',
      status: 'unchecked', latencyMs: null, lastCheckedAt: null,
    };
    s.addProxy(p); setAddOpen(false); setRaw(''); setName(''); s.toast('Proxy added');
  };

  const doImport = () => {
    const r = s.importProxies(bulk);
    s.toast(`${r.ok} imported${r.bad ? ` · ${r.bad} skipped` : ''}`, r.bad ? 'warn' : 'ok');
    setImportOpen(false); setBulk('');
  };

  const ok = s.proxies.filter((p) => p.status === 'ok').length;
  const avg = s.proxies.filter((p) => p.latencyMs).reduce((a, p) => a + (p.latencyMs ?? 0), 0) / Math.max(1, s.proxies.filter((p) => p.latencyMs).length);

  return (
    <div className="view">
      <div className="stat-row">
        <Stat label="Proxies" value={s.proxies.length} icon="globe" />
        <Stat label="Healthy" value={ok} icon="check" tone="teal" />
        <Stat label="Avg. latency" value={`${Math.round(avg)} ms`} icon="bolt" tone="amber" />
        <Stat label="Assigned" value={s.profiles.filter((p) => p.proxyId).length} icon="link" tone="blue" />
      </div>
      <div className="panel">
        <div className="toolbar">
          <div className="toolbar-left"><div className="panel-title"><Icon name="globe" size={17} /><h2>Proxy pool</h2><span>{s.proxies.length}</span></div></div>
          <div className="toolbar-right">
            {selected.size > 0 ? (
              <>
                <span className="sel-count">{selected.size} selected</span>
                <Button icon="refresh" size="sm" onClick={() => { s.checkProxies(ids); setSelected(new Set()); s.toast('Checks finished'); }}>Check</Button>
                <Button icon="trash" size="sm" variant="danger" onClick={() => { s.deleteProxies(ids); setSelected(new Set()); s.toast('Proxies removed'); }}>Delete</Button>
              </>
            ) : (
              <>
                <Button icon="upload" size="sm" onClick={() => setImportOpen(true)}>Bulk import</Button>
                <Button icon="plus" size="sm" variant="primary" onClick={() => setAddOpen(true)}>Add proxy</Button>
              </>
            )}
          </div>
        </div>

        {s.proxies.length === 0 ? <Empty icon="globe" title="No proxies" hint="Add one proxy or paste a list." action={<Button icon="plus" variant="primary" onClick={() => setAddOpen(true)}>Add proxy</Button>} /> : (
          <div className="table-wrap"><table className="data-table">
            <thead><tr><th className="col-check"><input type="checkbox" checked={selected.size === s.proxies.length && s.proxies.length > 0} onChange={() => setSelected(selected.size === s.proxies.length ? new Set() : new Set(s.proxies.map((p) => p.id)))} aria-label="Select all" /></th>
              <th>Name</th><th>Endpoint</th><th>Country</th><th>Latency</th><th>Status</th><th>Used by</th><th className="col-actions" /></tr></thead>
            <tbody>{s.proxies.map((p) => (
              <tr key={p.id} className={selected.has(p.id) ? 'row-sel' : ''}>
                <td className="col-check"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} /></td>
                <td><strong>{p.name}</strong></td>
                <td><code className="endpoint">{proxyUrl(p)}</code></td>
                <td><span className="country-code">{countryCode(p.country)}</span></td>
                <td>{p.latencyMs ? `${p.latencyMs} ms` : '—'}</td>
                <td><Badge tone={p.status === 'ok' ? 'ok' : p.status === 'failed' ? 'err' : 'neutral'} dot>{p.status}</Badge></td>
                <td>{s.profiles.filter((x) => x.proxyId === p.id).length}</td>
                <td className="col-actions"><IconButton icon="refresh" label="Check" onClick={() => { s.checkProxies([p.id]); s.toast('Check finished'); }} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>

      {addOpen && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setAddOpen(false); }}>
        <div className="modal" role="dialog" aria-label="Add proxy"><div className="modal-head"><h2>Add proxy</h2><IconButton icon="close" label="Close" onClick={() => setAddOpen(false)} /></div>
          <div className="modal-body">
            <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="US · Residential" /></Field>
            <div className="form-grid"><Field label="Protocol"><select className="input" value={protocol} onChange={(e) => setProtocol(e.target.value as ProxyProtocol)}><option value="http">HTTP</option><option value="https">HTTPS</option><option value="socks4">SOCKS4</option><option value="socks5">SOCKS5</option></select></Field>
              <Field label="Endpoint" hint="host:port or user:pass@host:port"><input className="input" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="198.51.100.12:1080" /></Field></div>
            {raw && <div className={`parse-result ${parsed.valid ? 'ok' : 'bad'}`}><Icon name={parsed.valid ? 'check' : 'warn'} size={14} />{parsed.valid ? `Parsed: ${proxyUrl({ protocol: parsed.protocol, host: parsed.host, port: parsed.port, username: parsed.username, password: parsed.password })}` : parsed.error}</div>}
          </div>
          <div className="modal-foot"><Button onClick={() => setAddOpen(false)}>Cancel</Button><Button variant="primary" icon="plus" onClick={add}>Add proxy</Button></div>
        </div>
      </div>}

      {importOpen && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setImportOpen(false); }}>
        <div className="modal" role="dialog" aria-label="Bulk import proxies"><div className="modal-head"><h2>Bulk import</h2><IconButton icon="close" label="Close" onClick={() => setImportOpen(false)} /></div>
          <div className="modal-body"><p className="modal-hint">One per line. Accepts <code>socks5://user:pass@host:port</code>, <code>host:port</code> and <code>host:port:user:pass</code>.</p>
            <textarea className="input area" rows={8} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'socks5://198.51.100.12:1080\n203.0.113.40:8080\n198.51.100.9:1080:user:pass'} /></div>
          <div className="modal-foot"><span className="muted">{bulk.split('\n').filter(Boolean).length} lines</span><div><Button onClick={() => setImportOpen(false)}>Cancel</Button><Button variant="primary" icon="upload" onClick={doImport}>Import</Button></div></div>
        </div>
      </div>}
    </div>
  );
}
