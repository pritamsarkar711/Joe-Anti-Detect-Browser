import { useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField,
  InputAdornment, Select, MenuItem, Divider, useMediaQuery, useTheme,
} from '@mui/material';
import { useStore } from '@/state/store';
import { Icon } from '../Icons';
import { Btn, IconBtn, Empty, PageHead, MetricStrip } from '../Primitives';

const PAGE_SIZE = 25;

const hostOf = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
};

const when = (iso: string) => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function HistoryView() {
  const s = useStore();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [q, setQ] = useState('');
  const [profile, setProfile] = useState('all');
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return s.history.filter((h) => (
      (!needle || `${h.title} ${h.url} ${h.profileName}`.toLowerCase().includes(needle))
      && (profile === 'all' || h.profileId === profile)
    ));
  }, [s.history, q, profile]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const pageRows = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      s.toast('Link copied');
    } catch {
      s.toast('Clipboard is blocked in this context', 'warn');
    }
  };

  return (
    <Box>
      <PageHead
        title="History"
        hint="Every URL opened from a profile, newest first."
        action={s.history.length > 0 ? (
          <Btn icon="trash" variant="danger" onClick={() => { s.clearHistory(); s.toast('History cleared'); }}>Clear all</Btn>
        ) : undefined}
      />

      <MetricStrip
        items={[
          { label: 'Visits', value: s.history.length },
          { label: 'Profiles', value: new Set(s.history.map((h) => h.profileId)).size },
          { label: 'Sites', value: new Set(s.history.map((h) => hostOf(h.url))).size },
        ]}
      />

      <Paper variant="outlined" sx={{ mt: 1.75, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, p: 1.25 }}>
          <TextField
            size="small" placeholder="Search history" value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            sx={{ flex: { xs: '1 1 100%', sm: '1 1 220px' }, maxWidth: { sm: 320 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="search" size={18} /></InputAdornment> }}
          />
          <Select
            size="small" value={profile} displayEmpty
            onChange={(e) => { setProfile(e.target.value); setPage(0); }}
            sx={{ width: { xs: '100%', sm: 210 } }}
          >
            <MenuItem value="all">All profiles</MenuItem>
            {[...new Set(s.history.map((h) => h.profileId))].map((id) => {
              const name = s.history.find((h) => h.profileId === id)?.profileName ?? id;
              return <MenuItem key={id} value={id}>{name}</MenuItem>;
            })}
          </Select>
        </Box>
        <Divider />

        {pageRows.length === 0 ? (
          <Empty
            icon="history" title="No history yet"
            hint="Open a profile and browse — visited URLs appear here automatically."
            action={<Btn variant="primary" icon="profiles" onClick={() => s.setView('profiles')}>Go to profiles</Btn>}
          />
        ) : mobile ? (
          <Box sx={{ p: 1 }}>
            {pageRows.map((h) => (
              <Box key={h.id} sx={{ p: 1.1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography noWrap sx={{ fontSize: '0.83rem', fontWeight: 500 }}>{h.title || h.url}</Typography>
                <Typography noWrap variant="caption" color="text.secondary" sx={{ display: 'block' }}>{h.url}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.4 }}>
                  <Typography variant="caption" color="text.secondary">{h.profileName} · {when(h.at)}</Typography>
                  <Box sx={{ flex: 1 }} />
                  <IconBtn icon="copy" size={17} label="Copy link" onClick={() => void copy(h.url)} />
                  <IconBtn icon="open" size={17} label="Open URL" href={h.url} target="_blank" rel="noreferrer" />
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <Table size="small" className="data-table" sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '42%' }}>Page</TableCell>
                <TableCell sx={{ width: '18%' }}>Profile</TableCell>
                <TableCell sx={{ width: '12%' }}>Visited</TableCell>
                <TableCell align="right" sx={{ width: 88 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.map((h) => (
                <TableRow key={h.id} hover>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                      <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: 'rgba(216,27,96,0.08)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                        <Icon name={h.search ? 'search' : 'link'} size={14} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{h.title || h.url}</Typography>
                        <Typography noWrap variant="caption" color="text.secondary">{h.url}</Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell><Typography noWrap variant="caption">{h.profileName}</Typography></TableCell>
                  <TableCell><Typography noWrap variant="caption" color="text.secondary">{when(h.at)}</Typography></TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.2} justifyContent="flex-end">
                      <IconBtn icon="copy" size={18} label="Copy link" onClick={() => void copy(h.url)} />
                      <IconBtn icon="open" size={18} label="Open URL" href={h.url} target="_blank" rel="noreferrer" />
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {rows.length > PAGE_SIZE && (
          <>
            <Divider />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.85 }}>
              <Typography variant="caption" color="text.secondary">{rows.length} visits</Typography>
              <Box sx={{ flex: 1 }} />
              <IconBtn icon="back" size={18} label="Previous page" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} />
              <Typography variant="caption" color="text.secondary">{safePage + 1}/{pages}</Typography>
              <IconBtn icon="chevronRight" size={18} label="Next page" onClick={() => setPage(Math.min(pages - 1, safePage + 1))} disabled={safePage >= pages - 1} />
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}
