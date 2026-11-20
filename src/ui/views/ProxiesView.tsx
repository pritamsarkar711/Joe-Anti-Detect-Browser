import { useMemo, useState } from 'react';
import {
  Box, Stack, Grid, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Checkbox, Chip, Select, MenuItem, TextField, InputAdornment, useMediaQuery, useTheme,
} from '@mui/material';
import { useStore } from '@/state/store';
import {
  parseProxy, smartParseProxy, parseProxyLines, checkProxy, proxyUrl, countryCode,
  GEO_COUNTRIES, geoForCountry, type ProxyConfig, type ProxyProtocol,
} from '@joe/core';
import { CountryFlag } from '../Brand';
import { Icon } from '../Icons';
import { Btn, IconBtn, Empty, MetricStrip, PageHead, Panel, Tag, Field, Modal } from '../Primitives';

const PROTOCOLS: ProxyProtocol[] = ['http', 'https', 'socks4', 'socks5', 'direct'];

function ProxyCard({ p, selected, onSelect }: { p: ProxyConfig; selected: boolean; onSelect: () => void }) {
  const s = useStore();
  return (
    <Paper variant="outlined" sx={{ p: 1.25, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
      <Checkbox size="small" checked={selected} onChange={onSelect} />
      <CountryFlag code={p.country} size={28} title={geoForCountry(p.country)?.name} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 600, fontSize: '0.84rem' }}>{p.name}</Typography>
        <Typography noWrap variant="caption" color="text.secondary">{proxyUrl(p)}</Typography>
        <Stack direction="row" spacing={0.75} sx={{ mt: 0.35 }}>
          <Tag tone={p.status === 'failed' ? 'err' : p.status === 'ok' ? 'primary' : 'neutral'}>{p.status}</Tag>
          {p.latencyMs && <Typography variant="caption" color="text.secondary">{p.latencyMs} ms</Typography>}
        </Stack>
      </Box>
      <IconBtn icon="refresh" label="Test" onClick={() => s.checkProxies([p.id])} />
      <IconBtn icon="trash" label="Delete" onClick={() => s.deleteProxies([p.id])} />
    </Paper>
  );
}

export function ProxiesView() {
  const s = useStore();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulk, setBulk] = useState('');
  const [smartRaw, setSmartRaw] = useState('');
  const [testResult, setTestResult] = useState<ProxyConfig | null>(null);
  const [form, setForm] = useState({ name: '', protocol: 'socks5' as ProxyProtocol, host: '', port: '1080', country: 'US', username: '', password: '' });

  const healthy = s.proxies.filter((p) => p.status === 'ok').length;
  const latencies = s.proxies.map((p) => p.latencyMs).filter((x): x is number => !!x);
  const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const assigned = s.profiles.filter((p) => !!p.proxyId).length;
  const ids = [...selected];
  const toggle = (id: string) => setSelected((v) => { const n = new Set(v); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const parsed = useMemo(() => parseProxy(`${form.protocol}://${form.host}:${form.port}`), [form]);
  const bulkParsedCount = useMemo(() => parseProxyLines(bulk).filter((p) => p.valid && p.host).length, [bulk]);

  const applySmartInput = (raw: string) => {
    setSmartRaw(raw);
    const p = smartParseProxy(raw);
    if (!p.valid || !p.host) return;
    setTestResult(null);
    setForm((prev) => ({
      ...prev,
      protocol: p.protocol,
      host: p.host,
      port: String(p.port),
      username: p.username ?? '',
      password: p.password ?? '',
      country: p.countryHint || prev.country,
      name: prev.name || p.nameHint,
    }));
  };

  const pasteClipboard = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (!txt.trim()) { s.toast('Clipboard empty', 'info'); return; }
      applySmartInput(txt);
      s.toast('Proxy fields populated');
    } catch {
      s.toast('Paste directly into Smart Paste field', 'info');
    }
  };

  const runInlineTest = () => {
    if (!parsed.valid || !form.host.trim()) { s.toast('Enter valid host and port', 'err'); return; }
    const checked = checkProxy({
      id: 'preview',
      name: form.name || `${form.host}:${form.port}`,
      protocol: form.protocol,
      host: form.host.trim(),
      port: Number(form.port),
      username: form.username || undefined,
      password: form.password || undefined,
      country: countryCode(form.country),
      status: 'unchecked',
      latencyMs: null,
      lastCheckedAt: null,
    });
    setTestResult(checked);
    setForm((prev) => ({ ...prev, country: checked.country || prev.country }));
  };

  const add = () => {
    if (!parsed.valid) { s.toast('Enter valid host and port', 'err'); return; }
    const p: ProxyConfig = {
      id: `px_${Date.now().toString(36)}`,
      name: form.name || `${form.host}:${form.port}`,
      protocol: form.protocol,
      host: form.host.trim(),
      port: Number(form.port),
      username: form.username || undefined,
      password: form.password || undefined,
      country: countryCode(form.country),
      status: testResult?.status ?? 'unchecked',
      latencyMs: testResult?.latencyMs ?? null,
      lastCheckedAt: testResult?.lastCheckedAt ?? null,
    };
    s.addProxy(p);
    setAddOpen(false);
    setSmartRaw('');
    setTestResult(null);
    setForm({ name: '', protocol: 'socks5', host: '', port: '1080', country: 'US', username: '', password: '' });
  };

  const importBulk = () => {
    const r = s.importProxies(bulk);
    s.toast(`${r.ok} added${r.bad ? ` · ${r.bad} invalid` : ''}`, r.ok ? 'ok' : 'warn');
    setBulk('');
    setBulkOpen(false);
  };

  return (
    <Box>
      <PageHead
        title="Proxies"
        action={
          <>
            <Btn icon="upload" onClick={() => setBulkOpen(true)}>Bulk add</Btn>
            <Btn variant="primary" icon="plus" onClick={() => setAddOpen(true)}>Add proxy</Btn>
          </>
        }
      />

      <MetricStrip
        items={[
          { label: 'Proxies', value: s.proxies.length },
          { label: 'Online', value: healthy },
          { label: 'Avg. latency', value: `${avgLatency} ms` },
          { label: 'Assigned', value: assigned },
        ]}
      />

      <Panel pad={0} sx={{ mt: 1.5, overflow: 'hidden' }}>
        {selected.size > 0 && <Stack direction="row" spacing={1} sx={{ p: 1.25, flexWrap: 'wrap', gap: 0.75 }}>
          <Chip label={`${selected.size} selected`} size="small" color="primary" />
          <Btn size="small" icon="refresh" onClick={() => { s.checkProxies(ids); setSelected(new Set()); }}>Test</Btn>
          <Btn size="small" icon="globe" onClick={() => { const pids = s.profiles.filter((p) => p.proxyId && ids.includes(p.proxyId)).map((p) => p.id); s.geoMatch(pids); setSelected(new Set()); }}>Geo match</Btn>
          <Btn size="small" variant="danger" icon="trash" onClick={() => { s.deleteProxies(ids); setSelected(new Set()); }}>Delete</Btn>
        </Stack>}
        {s.proxies.length === 0 ? <Empty icon="globe" title="No proxies" action={<Btn variant="primary" icon="plus" onClick={() => setAddOpen(true)}>Add proxy</Btn>} /> : mobile ? (
          <Box sx={{ p: 1.25 }}>{s.proxies.map((p) => <ProxyCard key={p.id} p={p} selected={selected.has(p.id)} onSelect={() => toggle(p.id)} />)}</Box>
        ) : (
          <Box>
            <Table size="small" className="data-table" sx={{ tableLayout: 'fixed' }}>
              <TableHead><TableRow>
                <TableCell padding="checkbox" sx={{ width: 40 }}><Checkbox size="small" checked={selected.size === s.proxies.length && s.proxies.length > 0} onChange={() => setSelected(selected.size === s.proxies.length ? new Set() : new Set(s.proxies.map((p) => p.id)))} /></TableCell>
                <TableCell sx={{ width: '24%' }}>Name</TableCell><TableCell sx={{ width: '26%' }}>Endpoint</TableCell><TableCell sx={{ width: '16%' }}>Region</TableCell><TableCell sx={{ width: 84 }}>Latency</TableCell><TableCell sx={{ width: 84 }}>Status</TableCell><TableCell sx={{ width: 64 }}>Used</TableCell><TableCell align="right" sx={{ width: 80 }} />
              </TableRow></TableHead>
              <TableBody>{s.proxies.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell padding="checkbox"><Checkbox size="small" checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></TableCell>
                  <TableCell><Typography noWrap sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{p.name}</Typography></TableCell>
                  <TableCell><Typography noWrap variant="caption" sx={{ fontFamily: 'monospace' }} title={proxyUrl(p)}>{proxyUrl(p)}</Typography></TableCell>
                  <TableCell><Stack direction="row" alignItems="center" spacing={0.8}><CountryFlag code={p.country} size={18} title={geoForCountry(p.country)?.name} /><Typography noWrap variant="caption">{geoForCountry(p.country)?.name ?? p.country}</Typography></Stack></TableCell>
                  <TableCell><Typography variant="caption">{p.latencyMs ? `${p.latencyMs} ms` : '—'}</Typography></TableCell>
                  <TableCell><Tag tone={p.status === 'failed' ? 'err' : p.status === 'ok' ? 'primary' : 'neutral'}>{p.status}</Tag></TableCell>
                  <TableCell>{s.profiles.filter((x) => x.proxyId === p.id).length}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.2} justifyContent="flex-end">
                      <IconBtn icon="refresh" label="Test" onClick={() => s.checkProxies([p.id])} size={18} />
                      <IconBtn icon="trash" label="Delete" onClick={() => s.deleteProxies([p.id])} size={18} />
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </Box>
        )}
      </Panel>

      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setTestResult(null); }}
        title="Add proxy"
        actions={
          <>
            <Btn icon="speed" onClick={runInlineTest}>Test</Btn>
            <Box sx={{ flex: 1 }} />
            <Btn onClick={() => setAddOpen(false)}>Cancel</Btn>
            <Btn variant="primary" icon="plus" onClick={add}>Add proxy</Btn>
          </>
        }
      >
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <TextField
            fullWidth size="small" label="Smart paste"
            value={smartRaw}
            onChange={(e) => applySmartInput(e.target.value)}
            placeholder="socks5://user:pass@host:port or host:port:user:pass"
            InputLabelProps={{ shrink: true }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Btn size="small" icon="paste" onClick={() => { void pasteClipboard(); }}>Paste</Btn>
                </InputAdornment>
              ),
            }}
          />

          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6}><Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="US Residential" /></Grid>
            <Grid item xs={12} sm={6}>
              <Select fullWidth size="small" value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value as ProxyProtocol })}>
                {PROTOCOLS.map((v) => <MenuItem key={v} value={v}>{v.toUpperCase()}</MenuItem>)}
              </Select>
            </Grid>
            <Grid item xs={8} sm={6}><Field label="Host" value={form.host} onChange={(v) => { setForm({ ...form, host: v }); setTestResult(null); }} placeholder="198.51.100.12" /></Grid>
            <Grid item xs={4} sm={6}><Field label="Port" value={form.port} onChange={(v) => { setForm({ ...form, port: v }); setTestResult(null); }} /></Grid>
            <Grid item xs={12} sm={6}>
              <Select fullWidth size="small" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
                renderValue={(v) => <Stack direction="row" alignItems="center" spacing={0.8}><CountryFlag code={v} size={18} /><span>{geoForCountry(v)?.name ?? v}</span></Stack>}>
                {GEO_COUNTRIES.map((c) => <MenuItem key={c} value={c}><Stack direction="row" alignItems="center" spacing={1}><CountryFlag code={c} size={18} /><span>{geoForCountry(c)?.name}</span></Stack></MenuItem>)}
              </Select>
            </Grid>
            <Grid item xs={6} sm={3}><Field label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} /></Grid>
            <Grid item xs={6} sm={3}><Field label="Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" /></Grid>
          </Grid>

          {testResult && (
            <Paper variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <CountryFlag code={testResult.country} size={18} />
              <Typography variant="caption" sx={{ flex: 1, fontWeight: 600 }}>
                {testResult.status === 'ok' ? `Connected · ${testResult.latencyMs} ms · ${testResult.country}` : 'Connection failed'}
              </Typography>
              <Tag tone={testResult.status === 'ok' ? 'primary' : 'err'}>{testResult.status}</Tag>
            </Paper>
          )}
          {form.host && !parsed.valid && <Typography variant="caption" color="error">Invalid host or port.</Typography>}
        </Stack>
      </Modal>

      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Bulk add proxies"
        subtitle={bulkParsedCount ? `${bulkParsedCount} ready` : 'One endpoint per line'}
        actions={<><Btn onClick={() => setBulkOpen(false)}>Cancel</Btn><Btn variant="primary" icon="upload" onClick={importBulk} disabled={!bulkParsedCount}>Add {bulkParsedCount || ''}</Btn></>}
      >
        <TextField
          fullWidth multiline rows={7} value={bulk} onChange={(e) => setBulk(e.target.value)}
          placeholder={'socks5://user:pass@198.51.100.12:1080\n203.0.113.40:8080:user:pass'}
          sx={{ mt: 1 }} InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.78rem' } }}
        />
      </Modal>
    </Box>
  );
}
