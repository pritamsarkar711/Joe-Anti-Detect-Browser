import { useMemo, useState } from 'react';
import {
  Box, Stack, Grid, Typography, Paper, ToggleButton, ToggleButtonGroup, Divider,
} from '@mui/material';
import { useStore, type ActivityEntry } from '@/state/store';
import { downloadFile } from '@joe/core';
import { Icon, type IconName } from '../Icons';
import { Btn, Empty, SectionHead, StatCard, Panel } from '../Primitives';

const ICONS: Record<ActivityEntry['kind'], IconName> = {
  launch: 'play', stop: 'stop', create: 'plus', delete: 'trash', proxy: 'globe',
  sync: 'refresh', import: 'upload', export: 'download', check: 'check', edit: 'edit',
};

export function ActivityView() {
  const s = useStore();
  const [filter, setFilter] = useState<'all' | 'sessions' | 'changes' | 'sync'>('all');
  const list = useMemo(() => s.activity.filter((a) => {
    if (filter === 'all') return true;
    if (filter === 'sessions') return a.kind === 'launch' || a.kind === 'stop';
    if (filter === 'changes') return ['create', 'delete', 'import', 'export', 'edit'].includes(a.kind);
    return ['sync', 'check', 'proxy'].includes(a.kind);
  }), [s.activity, filter]);

  return (
    <Box>
      <SectionHead kicker="HISTORY" title="Activity" hint="Recent workspace events." action={<Btn icon="download" onClick={() => { downloadFile('joe-activity.json', JSON.stringify(s.activity, null, 2)); s.toast('Activity exported'); }}>Export log</Btn>} />

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {[
          { icon: 'activity' as const, label: 'Events', value: s.activity.length },
          { icon: 'play' as const, label: 'Launches', value: s.activity.filter((a) => a.kind === 'launch').length },
          { icon: 'sync' as const, label: 'Sync messages', value: s.syncEvents.length },
          { icon: 'clock' as const, label: 'Retention', value: 400 },
        ].map((c) => <Grid item xs={6} md={3} key={c.label}><StatCard icon={c.icon} label={c.label} value={c.value} /></Grid>)}
      </Grid>

      <Panel pad={0} sx={{ overflow: 'hidden' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 1.6, flexWrap: 'wrap', gap: 1 }}>
          <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)}>
            <ToggleButton value="all" sx={{ px: 1.4, fontSize: '0.75rem' }}>All</ToggleButton>
            <ToggleButton value="sessions" sx={{ px: 1.4, fontSize: '0.75rem' }}>Sessions</ToggleButton>
            <ToggleButton value="changes" sx={{ px: 1.4, fontSize: '0.75rem' }}>Changes</ToggleButton>
            <ToggleButton value="sync" sx={{ px: 1.4, fontSize: '0.75rem' }}>Sync</ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary">{list.length} events</Typography>
        </Stack>
        <Divider />
        {list.length === 0 ? <Empty icon="activity" title="No events yet" hint="Create or launch a profile to see activity here." /> : (
          <Stack divider={<Divider flexItem />}>
            {list.map((a) => (
              <Stack key={a.id} direction="row" alignItems="center" spacing={1.4} sx={{ px: 1.6, py: 1.15 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)', color: 'primary.main', flex: 'none' }}>
                  <Icon name={ICONS[a.kind]} size={18} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.text}</Typography>
                  <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap', gap: 0.4 }}>
                    <Typography variant="caption" color="text.secondary">{new Date(a.at).toLocaleString()}</Typography>
                    {a.meta && <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{a.meta}</Typography>}
                  </Stack>
                </Box>
                <Paper variant="outlined" sx={{ px: 0.9, py: 0.3, display: { xs: 'none', sm: 'block' } }}><Typography variant="caption" color="text.secondary">{a.kind}</Typography></Paper>
              </Stack>
            ))}
          </Stack>
        )}
      </Panel>
    </Box>
  );
}
