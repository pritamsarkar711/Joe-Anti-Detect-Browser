import { useMemo, useState } from 'react';
import {
  Box, Stack, Grid, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Checkbox, Chip, Select, MenuItem, TextField, InputAdornment, useMediaQuery, useTheme, Divider, Tooltip,
} from '@mui/material';
import { useStore } from '@/state/store';
import { checkProfile, profileQuality, exportWorkspace, downloadFile, profilesToCsv, REAL_DEVICE_PRESETS, type BrowserProfile } from '@joe/core';
import { Icon } from '../Icons';
import { Official, CountryFlag } from '../Brand';
import { Btn, IconBtn, Empty, StatCard, ScoreRing, SectionHead, Panel, Tag } from '../Primitives';

const PAGE_SIZE = 25;

function osMark(os: string): string {
  return os === 'Windows' ? 'windows' : os === 'macOS' ? 'apple' : os === 'Android' ? 'android' : 'linux';
}

function ProfileCard({ p, selected, onSelect, onOpen }: {
  p: BrowserProfile; selected: boolean; onSelect: () => void; onOpen: () => void;
}) {
  const s = useStore();
  const px = s.proxies.find((x) => x.id === p.proxyId);
  const report = checkProfile(p);
  return (
    <Paper variant="outlined" sx={{ p: 1.6, mb: 1.2 }}>
      <Stack direction="row" alignItems="flex-start" spacing={1.2}>
        <Checkbox size="small" checked={selected} onChange={onSelect} sx={{ mt: -0.6 }} />
        <Box sx={{ minWidth: 0, flex: 1 }} onClick={onOpen}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box sx={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)', flex: 'none' }}>
              <Official name={osMark(p.os)} size={19} color="#D81B60" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</Typography>
              <Typography variant="caption" color="text.secondary">{p.group} · Chrome {p.fingerprint.chromeMajor}</Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mt: 1.3, flexWrap: 'wrap', gap: 0.7 }}>
            {px ? <><CountryFlag code={px.country} size={16} /><Typography variant="caption">{px.host}:{px.port}</Typography></> : <Typography variant="caption" color="text.secondary">Direct</Typography>}
            <Box sx={{ flex: 1 }} />
            <Tag tone={p.status === 'error' ? 'err' : p.status === 'running' ? 'primary' : 'neutral'}>{p.status}</Tag>
          </Stack>
        </Box>
        <ScoreRing value={report.score} size={44} />
        <IconBtn icon="play" label="Launch" onClick={() => s.setStatus([p.id], 'running')} size={20} />
      </Stack>
    </Paper>
  );
}

export function ProfilesView() {
  const s = useStore();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = s.profiles.filter((p) =>
      (!needle || `${p.name} ${p.group} ${p.tags.join(' ')}`.toLowerCase().includes(needle)) &&
      (group === 'all' || p.group === group) && (status === 'all' || p.status === status));
    out = [...out].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'score'
      ? checkProfile(b).score - checkProfile(a).score : b.createdAt.localeCompare(a.createdAt));
    return out;
  }, [s.profiles, q, group, status, sort]);

  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const avg = s.profiles.length ? Math.round(s.profiles.reduce((a, p) => a + checkProfile(p).score, 0) / s.profiles.length) : 0;
  const running = s.profiles.filter((p) => p.status === 'running').length;
  const ids = [...selected];
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clear = () => setSelected(new Set());

  const exportJson = () => { downloadFile('joe-workspace.json', JSON.stringify(exportWorkspace(s.profiles, s.proxies, s.groups), null, 2)); s.toast('Workspace exported'); };
  const exportCsv = () => { downloadFile('joe-profiles.csv', profilesToCsv(s.profiles), 'text/csv'); s.toast('CSV exported'); };

  return (
    <Box>
      <SectionHead
        kicker="WORKSPACE" title="Profiles"
        hint="Isolated identities with coherent fingerprints."
        action={<Btn icon="upload" onClick={() => { const el = document.createElement('input'); el.type = 'file'; el.accept = '.json,.csv'; el.onchange = () => { const f = el.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const text = String(r.result); if (f.name.endsWith('.csv')) { const n = s.importCsv(text); s.toast(n ? `${n} profiles imported` : 'No profiles found', n ? 'ok' : 'warn'); } else { try { const n = s.importData(text); s.toast(`${n} profiles imported`); } catch { s.toast('Invalid workspace file', 'err'); } } }; r.readAsText(f); }; el.click(); }}>Import</Btn>}
      />

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {[
          { icon: 'layers' as const, label: 'Profiles', value: s.profiles.length },
          { icon: 'play' as const, label: 'Running', value: running },
          { icon: 'folder' as const, label: 'Groups', value: s.groups.length },
          { icon: 'verified' as const, label: 'Avg. consistency', value: `${avg}%` },
        ].map((c) => <Grid item xs={6} md={3} key={c.label}><StatCard icon={c.icon} label={c.label} value={c.value} /></Grid>)}
      </Grid>

      <Panel pad={0} sx={{ overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ p: 1.6, flexWrap: 'wrap', gap: 1 }}>
          <TextField
            size="small" placeholder="Search profiles" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
            sx={{ minWidth: { xs: '100%', md: 220 }, flex: 1 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="search" size={20} /></InputAdornment> }}
          />
          <Select size="small" value={group} onChange={(e) => { setGroup(e.target.value); setPage(0); }} sx={{ minWidth: 130 }}>
            <MenuItem value="all">All groups</MenuItem>
            {s.groups.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
          </Select>
          <Select size="small" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} sx={{ minWidth: 120 }}>
            <MenuItem value="all">All status</MenuItem>
            {['ready', 'running', 'stopped', 'error'].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
          </Select>
          <Select size="small" value={sort} onChange={(e) => setSort(e.target.value)} sx={{ minWidth: 120 }}>
            <MenuItem value="newest">Newest</MenuItem>
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="score">Score</MenuItem>
          </Select>
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center', px: 0.5, whiteSpace: 'nowrap', width: { xs: '100%', md: 'auto' }, textAlign: { xs: 'center', md: 'left' } }}>{rows.length} results</Typography>
          <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' } }} />
          <Stack direction="row" spacing={0.8} sx={{ width: { xs: '100%', md: 'auto' }, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
            <IconBtn icon="download" label="Export CSV" onClick={exportCsv} />
            <IconBtn icon="save" label="Export workspace" onClick={exportJson} />
          </Stack>
        </Stack>

        {selected.size > 0 && (
          <Stack direction="row" spacing={1} sx={{ px: 1.6, pb: 1.4, flexWrap: 'wrap', gap: 0.8, alignItems: 'center' }}>
            <Chip label={`${selected.size} selected`} size="small" color="primary" />
            <Btn size="small" icon="play" onClick={() => { s.setStatus(ids, 'running'); clear(); }}>Launch</Btn>
            <Btn size="small" icon="stop" onClick={() => { s.setStatus(ids, 'stopped'); clear(); }}>Stop</Btn>
            <Btn size="small" icon="copy" onClick={() => { s.duplicateProfiles(ids); clear(); }}>Duplicate</Btn>
            <Btn size="small" icon="globe" onClick={() => { s.geoMatch(ids); clear(); }}>Geo match</Btn>
            <Btn size="small" icon="spark" onClick={() => { const r = s.profiles.length % REAL_DEVICE_PRESETS.length; s.applyPreset(ids, REAL_DEVICE_PRESETS[r].id); clear(); }}>Apply real device</Btn>
            <Btn size="small" variant="danger" icon="trash" onClick={() => { s.deleteProfiles(ids); clear(); }}>Delete</Btn>
          </Stack>
        )}
        <Divider />

        {pageRows.length === 0 ? <Empty icon="layers" title="No profiles" hint="Create one or import a workspace." action={<Btn variant="primary" icon="plus" onClick={() => s.setCreateOpen(true)}>New profile</Btn>} /> : mobile ? (
          <Box sx={{ p: 1.4 }}>
            {pageRows.map((p) => <ProfileCard key={p.id} p={p} selected={selected.has(p.id)} onSelect={() => toggle(p.id)} onOpen={() => s.setSelectedId(p.id)} />)}
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" className="data-table">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox"><Checkbox size="small" checked={selected.size === pageRows.length && pageRows.length > 0} onChange={() => setSelected(selected.size === pageRows.length ? new Set() : new Set(pageRows.map((p) => p.id)))} /></TableCell>
                  <TableCell>Profile</TableCell><TableCell>Device</TableCell><TableCell>Proxy</TableCell>
                  <TableCell>Consistency</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map((p) => {
                  const px = s.proxies.find((x) => x.id === p.proxyId);
                  const report = checkProfile(p);
                  const quality = profileQuality(p, s.profiles);
                  return (
                    <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => s.setSelectedId(p.id)}>
                      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}><Checkbox size="small" checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1.2}>
                          <Box sx={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)', flex: 'none' }}>
                            <Official name={osMark(p.os)} size={18} color="#D81B60" />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 600, fontSize: '0.84rem' }}>{p.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{p.group}{p.tags.length ? ` · ${p.tags.join(', ')}` : ''}</Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: '0.82rem' }}>{p.fingerprint.uaClientHints.platform}</Typography>
                        <Typography variant="caption" color="text.secondary">Chrome {p.fingerprint.chromeMajor} · {p.fingerprint.screen.width}×{p.fingerprint.screen.height}</Typography>
                      </TableCell>
                      <TableCell>
                        {px ? <Stack direction="row" alignItems="center" spacing={0.8}><CountryFlag code={px.country} size={17} /><Typography variant="caption">{px.host}:{px.port}</Typography></Stack>
                          : <Typography variant="caption" color="text.secondary">Direct</Typography>}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <ScoreRing value={report.score} size={36} />
                          <Box>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>{report.score} · {report.grade}</Typography>
                            <Tooltip title={`Unique in ${quality.uniqueness}% of comparisons`}><span><Typography variant="caption" color="text.secondary">Unique {quality.uniqueness}%</Typography></span></Tooltip>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell><Tag tone={p.status === 'error' ? 'err' : p.status === 'running' ? 'primary' : 'neutral'}>{p.status}</Tag></TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Stack direction="row" spacing={0.3} justifyContent="flex-end">
                          <IconBtn icon={p.status === 'running' ? 'stop' : 'play'} label={p.status === 'running' ? 'Stop' : 'Launch'} onClick={() => s.setStatus([p.id], p.status === 'running' ? 'stopped' : 'running')} size={19} />
                          <IconBtn icon="copy" label="Duplicate" onClick={() => s.duplicateProfiles([p.id])} size={19} />
                          <IconBtn icon="chevronRight" label="Details" onClick={() => s.setSelectedId(p.id)} size={19} />
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}

        <Divider />
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 1.4, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">Page {page + 1} of {pages} · {rows.length} profiles</Typography>
          <Stack direction="row" spacing={1}>
            <Btn size="small" icon="back" onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Btn>
            <Btn size="small" onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>Next</Btn>
          </Stack>
        </Stack>
      </Panel>
    </Box>
  );
}
