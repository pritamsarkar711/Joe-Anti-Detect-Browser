import { useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow,
  Checkbox, Select, MenuItem, TextField, InputAdornment, useMediaQuery, useTheme, Divider,
  ToggleButton, ToggleButtonGroup, Chip,
} from '@mui/material';
import { useStore } from '@/state/store';
import { checkProfile, profileQuality, profileBrowserLabel, exportWorkspace, downloadFile, profilesToCsv, REAL_DEVICE_PRESETS, type BrowserProfile } from '@joe/core';
import { Icon } from '../Icons';
import { Official, CountryFlag } from '../Brand';
import { Btn, IconBtn, Empty, ScoreRing, PageHead, Tag, MetricStrip } from '../Primitives';

const PAGE_SIZE = 20;

const osMark = (os: string) =>
  os === 'Windows' ? 'windows'
    : os === 'macOS' || os === 'iOS' || os === 'iPadOS' ? 'apple'
      : os === 'Android' ? 'android'
        : 'linux';
const statusTone = (s: string) => (s === 'error' ? 'err' : s === 'running' ? 'primary' : 'neutral');

function OsBadge({ os, size = 30 }: { os: string; size?: number }) {
  return (
    <Box
      sx={{
        width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center',
        bgcolor: 'rgba(216,27,96,0.08)', flex: 'none',
      }}
    >
      <Official name={osMark(os)} size={size * 0.55} color="#D81B60" />
    </Box>
  );
}

/** Compact card used below 960px — one profile, four facts, two actions. */
function ProfileCard({ p, selected, onSelect, onOpen }: {
  p: BrowserProfile; selected: boolean; onSelect: () => void; onOpen: () => void;
}) {
  const s = useStore();
  const px = s.proxies.find((x) => x.id === p.proxyId);
  const score = checkProfile(p).score;
  return (
    <Paper variant="outlined" sx={{ mb: 1, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.1, pr: 0.75 }}>
        <Checkbox size="small" checked={selected} onChange={onSelect} sx={{ p: 0.5, ml: -0.5 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flex: 1, cursor: 'pointer' }} onClick={onOpen}>
          <OsBadge os={p.os} size={32} />
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.name}</Typography>
            <Typography noWrap variant="caption" color="text.secondary">
              {p.group} · {p.fingerprint.uaClientHints.platform} · {profileBrowserLabel(p)}
            </Typography>
          </Box>
        </Box>
        <ScoreRing value={score} size={34} />
      </Box>
      <Divider />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.1, py: 0.6 }}>
        {px ? (
          <Stack direction="row" alignItems="center" spacing={0.6} sx={{ minWidth: 0 }}>
            <CountryFlag code={px.country} size={15} />
            <Typography noWrap variant="caption" color="text.secondary">{px.name}</Typography>
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary">Direct connection</Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <Tag tone={statusTone(p.status)}>{p.status}</Tag>
        <IconBtn
          icon={p.status === 'running' ? 'stop' : 'play'} size={19}
          label={p.status === 'running' ? 'Stop' : 'Launch'}
          onClick={() => s.setStatus([p.id], p.status === 'running' ? 'stopped' : 'running')}
        />
        {p.status === 'running' && (
          <IconBtn icon="web" size={18} label="Open session" onClick={() => s.setPreviewProfileId(p.id)} />
        )}
        <IconBtn icon="chevronRight" size={19} label="Open details" onClick={onOpen} />
      </Box>
    </Paper>
  );
}

export function ProfilesView() {
  const s = useStore();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string>('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');
  const [view, setViewMode] = useState<'table' | 'cards'>('table');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  // The sidebar group filter and the in-page select are the same state.
  useEffect(() => { setGroup(s.groupFilter ?? 'all'); setPage(0); }, [s.groupFilter]);
  useEffect(() => { setPage(0); }, [q, status, sort]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = s.profiles.filter((p) => {
      const hay = `${p.name} ${p.group} ${p.tags.join(' ')} ${p.fingerprint.uaClientHints.platform}`.toLowerCase();
      return (!needle || hay.includes(needle))
        && (group === 'all' || p.group === group)
        && (status === 'all' || p.status === status);
    });
    return [...out].sort((a, b) => (
      sort === 'name' ? a.name.localeCompare(b.name)
        : sort === 'score' ? checkProfile(b).score - checkProfile(a).score
          : b.createdAt.localeCompare(a.createdAt)
    ));
  }, [s.profiles, q, group, status, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const avg = s.profiles.length
    ? Math.round(s.profiles.reduce((a, p) => a + checkProfile(p).score, 0) / s.profiles.length)
    : 0;
  const running = s.profiles.filter((p) => p.status === 'running').length;

  const ids = [...selected];
  const toggle = (id: string) => setSelected((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const clear = () => setSelected(new Set());
  const allOnPage = pageRows.length > 0 && pageRows.every((p) => selected.has(p.id));

  const exportJson = () => {
    downloadFile('joe-workspace.json', JSON.stringify(exportWorkspace(s.profiles, s.proxies, s.groups), null, 2));
    s.toast('Workspace exported');
  };
  const exportCsv = () => { downloadFile('joe-profiles.csv', profilesToCsv(s.profiles), 'text/csv'); s.toast('CSV exported'); };
  const importFile = () => {
    const el = document.createElement('input');
    el.type = 'file'; el.accept = '.json,.csv';
    el.onchange = () => {
      const f = el.files?.[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const text = String(r.result);
        if (f.name.endsWith('.csv')) {
          const n = s.importCsv(text);
          s.toast(n ? `${n} profiles imported` : 'No profiles found', n ? 'ok' : 'warn');
        } else {
          try { s.toast(`${s.importData(text)} profiles imported`); }
          catch { s.toast('Invalid workspace file', 'err'); }
        }
      };
      r.readAsText(f);
    };
    el.click();
  };

  return (
    <Box>
      <PageHead
        title="Profiles"
        hint="Isolated profiles with separate storage, proxy, and fingerprint."
        action={(
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
            <Btn icon="upload" onClick={importFile}>Import</Btn>
            {/* The app bar already carries the primary create action on
                desktop; on phones it is hidden there, so the page header owns
                it. Exactly one "New profile" is visible at any width. */}
            {mobile && <Btn variant="primary" icon="plus" onClick={() => s.setCreateOpen(true)}>New profile</Btn>}
          </Stack>
        )}
      />

      <MetricStrip
        items={[
          { label: 'Profiles', value: s.profiles.length },
          { label: 'Running', value: running },
          { label: 'Groups', value: s.groups.length },
          { label: 'Avg. consistency', value: `${avg}%` },
        ]}
      />

      <Paper variant="outlined" sx={{ mt: 1.75, overflow: 'hidden' }}>
        {/* One compact toolbar. No duplicated header actions. */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, p: 1.25 }}>
          <TextField
            size="small" placeholder="Search profiles" value={q} onChange={(e) => setQ(e.target.value)}
            sx={{ flex: { xs: '1 1 100%', sm: '1 1 200px' }, maxWidth: { sm: 280 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="search" size={18} /></InputAdornment> }}
          />
          <Select size="small" value={group} onChange={(e) => { setGroup(e.target.value); s.setGroupFilter(e.target.value === 'all' ? null : e.target.value); }} sx={{ width: { xs: 'calc(50% - 4px)', sm: 132 } }}>
            <MenuItem value="all">All groups</MenuItem>
            {s.groups.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
          </Select>
          <Select size="small" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ width: { xs: 'calc(50% - 4px)', sm: 118 } }}>
            <MenuItem value="all">Any status</MenuItem>
            {['ready', 'running', 'stopped', 'error'].map((v) => <MenuItem key={v} value={v} sx={{ textTransform: 'capitalize' }}>{v}</MenuItem>)}
          </Select>
          <Select size="small" value={sort} onChange={(e) => setSort(e.target.value)} sx={{ width: { xs: 'calc(50% - 4px)', sm: 112 } }}>
            <MenuItem value="newest">Newest</MenuItem>
            <MenuItem value="name">Name</MenuItem>
            <MenuItem value="score">Score</MenuItem>
          </Select>
          <Box sx={{ flex: 1, display: { xs: 'none', lg: 'block' } }} />
          <ToggleButtonGroup
            exclusive size="small" value={view} onChange={(_e, v) => v && setViewMode(v)}
            sx={{ display: { xs: 'none', md: 'flex' }, '& .MuiToggleButton-root': { px: 0.9, py: 0.45 } }}
          >
            <ToggleButton value="table" aria-label="Table view"><Icon name="list" size={18} /></ToggleButton>
            <ToggleButton value="cards" aria-label="Card view"><Icon name="grid" size={18} /></ToggleButton>
          </ToggleButtonGroup>
          {/* On phones the page header owns the create action, so the toolbar
              keeps only search, filters and exports. */}
          {/* One export control on touch widths: two 40px icon buttons wrapped
              onto a row of their own and read as stray icons. */}
          <IconBtn icon="download" label="Export CSV" onClick={exportCsv} sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
          <IconBtn icon="save" label="Export workspace" onClick={exportJson} sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
        </Box>

        {selected.size > 0 && (
          <>
            <Divider />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.75, bgcolor: 'rgba(216,27,96,0.05)' }}>
              <Chip label={`${selected.size} selected`} size="small" sx={{ height: 22, fontSize: '0.68rem', bgcolor: 'rgba(216,27,96,0.12)', color: 'primary.main' }} />
              <Btn size="small" icon="play" onClick={() => { s.setStatus(ids, 'running'); clear(); }}>Launch</Btn>
              <Btn size="small" icon="stop" onClick={() => { s.setStatus(ids, 'stopped'); clear(); }}>Stop</Btn>
              <Btn size="small" icon="copy" onClick={() => { s.duplicateProfiles(ids); clear(); }}>Duplicate</Btn>
              <Btn size="small" icon="globe" onClick={() => { s.geoMatch(ids); clear(); }}>Match region</Btn>
              <Btn size="small" icon="swap" onClick={() => { s.rotateProxy(ids); clear(); }}>Rotate exit</Btn>
              <Btn size="small" icon="spark" onClick={() => { s.applyPreset(ids, REAL_DEVICE_PRESETS[s.profiles.length % REAL_DEVICE_PRESETS.length].id); clear(); }}>Apply device</Btn>
              <Box sx={{ flex: 1 }} />
              <Btn size="small" variant="danger" icon="trash" onClick={() => { s.deleteProfiles(ids); clear(); }}>Delete</Btn>
            </Box>
          </>
        )}
        <Divider />

        {pageRows.length === 0 ? (
          <Empty
            icon="profiles" title={s.profiles.length ? 'No matching profiles' : 'No profiles yet'}
            hint={s.profiles.length ? 'Clear the search or filters to see all profiles.' : 'Create your first isolated profile.'}
            action={<Btn variant="primary" icon="plus" onClick={() => s.setCreateOpen(true)}>New profile</Btn>}
          />
        ) : mobile || view === 'cards' ? (
          <Box sx={{ p: 1.25 }}>
            {pageRows.map((p) => (
              <ProfileCard
                key={p.id} p={p} selected={selected.has(p.id)}
                onSelect={() => toggle(p.id)} onOpen={() => s.setSelectedId(p.id)}
              />
            ))}
          </Box>
        ) : (
          <Box sx={{ width: '100%' }}>
            <Table size="small" className="data-table" sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={{ width: 40 }}>
                    <Checkbox
                      size="small" checked={allOnPage}
                      onChange={() => setSelected(allOnPage ? new Set() : new Set(pageRows.map((p) => p.id)))}
                    />
                  </TableCell>
                  <TableCell sx={{ width: '30%' }}>Profile</TableCell>
                  <TableCell sx={{ width: '20%', display: { xs: 'none', lg: 'table-cell' } }}>Device</TableCell>
                  <TableCell sx={{ width: '20%' }}>Proxy</TableCell>
                  <TableCell sx={{ width: 96 }}>Score</TableCell>
                  <TableCell sx={{ width: 84 }}>Status</TableCell>
                  <TableCell align="right" sx={{ width: 128 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map((p) => {
                  const px = s.proxies.find((x) => x.id === p.proxyId);
                  const score = checkProfile(p).score;
                  const quality = profileQuality(p, s.profiles);
                  return (
                    <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => s.setSelectedId(p.id)}>
                      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                        <Checkbox size="small" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <OsBadge os={p.os} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography noWrap sx={{ fontWeight: 600, fontSize: '0.84rem' }}>{p.name}</Typography>
                            <Typography noWrap variant="caption" color="text.secondary">{p.group}</Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                        <Typography noWrap sx={{ fontSize: '0.8rem' }}>{p.fingerprint.uaClientHints.platform}</Typography>
                        <Typography noWrap variant="caption" color="text.secondary">{profileBrowserLabel(p)}</Typography>
                      </TableCell>
                      <TableCell>
                        {px ? (
                          <Stack direction="row" alignItems="center" spacing={0.6} sx={{ minWidth: 0 }}>
                            <CountryFlag code={px.country} size={15} />
                            <Typography noWrap variant="caption" color="text.secondary">{px.name}</Typography>
                          </Stack>
                        ) : (
                          <Typography variant="caption" color="text.secondary">Direct</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" spacing={0.9}>
                          <ScoreRing value={score} size={32} />
                          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>Uniq {quality.uniqueness}%</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell><Tag tone={statusTone(p.status)}>{p.status}</Tag></TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Stack direction="row" spacing={0.2} justifyContent="flex-end">
                          <IconBtn
                            icon={p.status === 'running' ? 'stop' : 'play'} size={18}
                            label={p.status === 'running' ? 'Stop' : 'Launch'}
                            onClick={() => s.setStatus([p.id], p.status === 'running' ? 'stopped' : 'running')}
                          />
                          {p.status === 'running' && (
                            <IconBtn icon="web" size={17} label="Open session" onClick={() => s.setPreviewProfileId(p.id)} />
                          )}
                          <IconBtn icon="copy" size={18} label="Duplicate" onClick={() => s.duplicateProfiles([p.id])} />
                          <IconBtn icon="chevronRight" size={18} label="Details" onClick={() => s.setSelectedId(p.id)} />
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.85 }}>
          <Typography variant="caption" color="text.secondary">
            {rows.length === 0 ? 'No results' : `${safePage * PAGE_SIZE + 1}–${Math.min(rows.length, (safePage + 1) * PAGE_SIZE)} of ${rows.length}`}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <IconBtn icon="back" size={18} label="Previous page" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} />
          <Typography variant="caption" color="text.secondary">{safePage + 1}/{pages}</Typography>
          <IconBtn icon="chevronRight" size={18} label="Next page" onClick={() => setPage(Math.min(pages - 1, safePage + 1))} disabled={safePage >= pages - 1} />
        </Box>
      </Paper>
    </Box>
  );
}
