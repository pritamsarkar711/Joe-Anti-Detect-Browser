import { useMemo, useState } from 'react';
import {
  Box, Stack, Grid, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Checkbox, Chip, Select, MenuItem, TextField, Divider, useMediaQuery, useTheme,
} from '@mui/material';
import { useStore } from '@/state/store';
import { parseProxy, proxyUrl, countryCode, GEO_COUNTRIES, geoForCountry, type ProxyConfig, type ProxyProtocol } from '@joe/core';
import { Official, CountryFlag } from '../Brand';
import { Icon } from '../Icons';
import { Btn, IconBtn, Empty, MetricStrip, PageHead, Panel, Tag, Field, Modal } from '../Primitives';

const PROTOCOLS: ProxyProtocol[] = ['http', 'https', 'socks4', 'socks5', 'direct'];

function ProxyCard({ p, selected, onSelect }: { p: ProxyConfig; selected: boolean; onSelect: () => void }) {
  const s = useStore();
  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1.2, display: 'flex', alignItems: 'center', gap: 1.2 }}>
      <Checkbox size="small" checked={selected} onChange={onSelect} />
      <CountryFlag code={p.country} size={30} title={geoForCountry(p.country)?.name} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, fontSize: '0.84rem' }}>{p.name}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{proxyUrl(p)}</Typography>
        <Stack direction="row" spacing={0.8} sx={{ mt: 0.5 }}><Tag tone={p.status === 'failed' ? 'err' : p.status === 'ok' ? 'primary' : 'neutral'}>{p.status}</Tag><Typography variant="caption">{p.latencyMs ? `${p.latencyMs} ms` : ''}</Typography></Stack>
      </Box>
      <IconBtn icon="refresh" label="Check" onClick={() => s.checkProxies([p.id])} />
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
  const [form, setForm] = useState({ name: '', protocol: 'socks5' as ProxyProtocol, host: '', port: '1080', country: 'US', username: '', password: '' });

  const healthy = s.proxies.filter((p) => p.status === 'ok').length;
  const latencies = s.proxies.map((p) => p.latencyMs).filter((x): x is number => !!x);
  const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const assigned = s.profiles.filter((p) => !!p.proxyId).length;
  const ids = [...selected];
  const toggle = (id: string) => setSelected((v) => { const n = new Set(v); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const parsed = useMemo(() => parseProxy(`${form.protocol}://${form.host}:${form.port}`), [form]);
  const add = () => {
    if (!parsed.valid) { s.toast('Enter a valid host and port', 'err'); return; }
    const p: ProxyConfig = {
      id: `px_${Date.now().toString(36)}`, name: form.name || `${form.host}:${form.port}`,
      protocol: form.protocol, host: form.host, port: Number(form.port),
      username: form.username || undefined, password: form.password || undefined,
      country: countryCode(form.country), status: 'unchecked', latencyMs: null, lastCheckedAt: null,
    };
    s.addProxy(p); setAddOpen(false); setForm({ name: '', protocol: 'socks5', host: '', port: '1080', country: 'US', username: '', password: '' });
  };
  const importBulk = () => { const r = s.importProxies(bulk); s.toast(`${r.ok} imported · ${r.bad} invalid`, r.ok ? 'ok' : 'warn'); setBulk(''); setBulkOpen(false); };

  return (
    <Box>
      <PageHead
        title="Proxies" hint="One exit point per profile, checked against its region."
        action={
          <>
            <Btn icon="upload" onClick={() => setBulkOpen(true)}>Bulk import</Btn>
            <Btn variant="primary" icon="plus" onClick={() => setAddOpen(true)}>Add proxy</Btn>
          </>
        }
      />

      <MetricStrip
        items={[
          { label: 'Proxies', value: s.proxies.length },
          { label: 'Healthy', value: healthy },
          { label: 'Avg. latency', value: `${avgLatency} ms` },
          { label: 'Assigned', value: assigned },
        ]}
      />

      <Panel pad={0} sx={{ mt: 1.75, overflow: 'hidden' }}>
        {selected.size > 0 && <Stack direction="row" spacing={1} sx={{ p: 1.4, flexWrap: 'wrap', gap: 0.8 }}>
          <Chip label={`${selected.size} selected`} size="small" color="primary" />
          <Btn size="small" icon="refresh" onClick={() => { s.checkProxies(ids); setSelected(new Set()); }}>Check</Btn>
          <Btn size="small" icon="globe" onClick={() => { const pids = s.profiles.filter((p) => p.proxyId && ids.includes(p.proxyId)).map((p) => p.id); s.geoMatch(pids); setSelected(new Set()); }}>Geo match profiles</Btn>
          <Btn size="small" variant="danger" icon="trash" onClick={() => { s.deleteProxies(ids); setSelected(new Set()); }}>Delete</Btn>
        </Stack>}
        {s.proxies.length === 0 ? <Empty icon="globe" title="No proxies" hint="Add one endpoint or paste a list." action={<Btn variant="primary" icon="plus" onClick={() => setAddOpen(true)}>Add proxy</Btn>} /> : mobile ? (
          <Box sx={{ p: 1.4 }}>{s.proxies.map((p) => <ProxyCard key={p.id} p={p} selected={selected.has(p.id)} onSelect={() => toggle(p.id)} />)}</Box>
        ) : (
          <Box>
            <Table size="small" className="data-table" sx={{ tableLayout: 'fixed' }}>
              <TableHead><TableRow>
                <TableCell padding="checkbox" sx={{ width: 40 }}><Checkbox size="small" checked={selected.size === s.proxies.length && s.proxies.length > 0} onChange={() => setSelected(selected.size === s.proxies.length ? new Set() : new Set(s.proxies.map((p) => p.id)))} /></TableCell>
                <TableCell sx={{ width: '24%' }}>Name</TableCell><TableCell sx={{ width: '26%' }}>Endpoint</TableCell><TableCell sx={{ width: '16%' }}>Country</TableCell><TableCell sx={{ width: 84 }}>Latency</TableCell><TableCell sx={{ width: 84 }}>Status</TableCell><TableCell sx={{ width: 64 }}>Used</TableCell><TableCell align="right" sx={{ width: 80 }} />
              </TableRow></TableHead>
              <TableBody>{s.proxies.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell padding="checkbox"><Checkbox size="small" checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></TableCell>
                  <TableCell><Typography sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{p.name}</Typography></TableCell>
                  <TableCell><Typography noWrap variant="caption" sx={{ fontFamily: 'monospace' }} title={proxyUrl(p)}>{proxyUrl(p)}</Typography></TableCell>
                  <TableCell><Stack direction="row" alignItems="center" spacing={0.8}><CountryFlag code={p.country} size={18} title={geoForCountry(p.country)?.name} /><Typography variant="caption">{geoForCountry(p.country)?.name ?? p.country}</Typography></Stack></TableCell>
                  <TableCell><Typography variant="caption">{p.latencyMs ? `${p.latencyMs} ms` : '—'}</Typography></TableCell>
                  <TableCell><Tag tone={p.status === 'failed' ? 'err' : p.status === 'ok' ? 'primary' : 'neutral'}>{p.status}</Tag></TableCell>
                  <TableCell>{s.profiles.filter((x) => x.proxyId === p.id).length}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.2} justifyContent="flex-end">
                      <IconBtn icon="refresh" label="Check" onClick={() => s.checkProxies([p.id])} size={18} />
                      <IconBtn icon="trash" label="Delete" onClick={() => s.deleteProxies([p.id])} size={18} />
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </Box>
        )}
      </Panel>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add proxy" subtitle="HTTP, HTTPS, SOCKS4 or SOCKS5."
        actions={<><Btn onClick={() => setAddOpen(false)}>Cancel</Btn><Btn variant="primary" icon="plus" onClick={add}>Add proxy</Btn></>}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}><Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="US Residential" /></Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>Protocol</Typography>
              <Select fullWidth size="small" value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value as ProxyProtocol })}>
                {PROTOCOLS.map((v) => <MenuItem key={v} value={v}>{v.toUpperCase()}</MenuItem>)}
              </Select>
            </Grid>
            <Grid item xs={8} sm={6}><Field label="Host" value={form.host} onChange={(v) => setForm({ ...form, host: v })} placeholder="198.51.100.12" /></Grid>
            <Grid item xs={4} sm={6}><Field label="Port" value={form.port} onChange={(v) => setForm({ ...form, port: v })} /></Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>Country</Typography>
              <Select fullWidth size="small" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
                renderValue={(v) => <Stack direction="row" alignItems="center" spacing={0.8}><CountryFlag code={v} size={18} /><span>{geoForCountry(v)?.name}</span></Stack>}>
                {GEO_COUNTRIES.map((c) => <MenuItem key={c} value={c}><Stack direction="row" alignItems="center" spacing={1}><CountryFlag code={c} size={18} /><span>{geoForCountry(c)?.name}</span></Stack></MenuItem>)}
              </Select>
            </Grid>
            <Grid item xs={6}><Field label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} /></Grid>
            <Grid item xs={6}><Field label="Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" /></Grid>
          </Grid>
          {form.host && !parsed.valid && <Typography variant="caption" color="error">Enter a valid host and port.</Typography>}
        </Stack>
      </Modal>

      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk import" subtitle="One endpoint per line."
        actions={<><Btn onClick={() => setBulkOpen(false)}>Cancel</Btn><Btn variant="primary" icon="upload" onClick={importBulk}>Import</Btn></>}>
        <TextField fullWidth multiline rows={7} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={'socks5://198.51.100.12:1080\nhttp://user:pass@203.0.113.40:8080'} sx={{ mt: 1 }} InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.78rem' } }} />
      </Modal>
    </Box>
  );
}
