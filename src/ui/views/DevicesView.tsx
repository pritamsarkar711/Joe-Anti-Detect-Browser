import {
  Box, Stack, Grid, Typography, Paper, Switch, Chip, Divider, useMediaQuery, useTheme,
} from '@mui/material';
import { useStore } from '@/state/store';
import { DEVICE_LABEL } from './labels';
import { Icon } from '../Icons';
import { Official } from '../Brand';
import { Btn, MetricStrip, PageHead, Panel, Tag } from '../Primitives';

export function DevicesView() {
  const s = useStore();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const running = s.profiles.filter((p) => p.status === 'running').length;

  return (
    <Box>
      <PageHead title="Devices" hint="Desktop, Android and the web workspace stay in sync." />

      <MetricStrip
        items={[
          { label: 'Connected', value: s.devices.filter((d) => d.online).length },
          { label: 'Running', value: running },
          { label: 'Messages', value: s.syncEvents.length },
        ]}
      />

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {s.devices.map((d) => (
          <Grid item xs={12} sm={6} lg={4} key={d.kind}>
            <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
              <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 1.6 }}>
                <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)', color: 'primary.main', flex: 'none' }}>
                  <Icon name={d.kind === 'android-apk' ? 'phone' : d.kind === 'web-dashboard' ? 'web' : 'monitor'} size={22} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ fontWeight: 600, fontSize: '0.86rem' }}>{d.name}</Typography><Typography variant="caption" color="text.secondary">{DEVICE_LABEL[d.kind]} · {d.platform}</Typography></Box>
                <Tag tone={d.online ? 'primary' : 'neutral'}>{d.online ? 'online' : 'offline'}</Tag>
              </Stack>
              <Divider sx={{ mb: 1.4 }} />
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">{d.profiles} running · v{d.appVersion}</Typography>
                <Switch size="small" checked={d.online} onChange={(e) => s.setDeviceOnline(d.kind, e.target.checked)} inputProps={{ 'aria-label': `Toggle ${d.name}` }} />
              </Stack>
            </Paper>
          </Grid>
        ))}
        <Grid item xs={12} sm={6} lg={4}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 1.6 }}>
              <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)', flex: 'none' }}><Official name="supabase" size={22} color="#D81B60" /></Box>
              <Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ fontWeight: 600, fontSize: '0.86rem' }}>Control plane</Typography><Typography variant="caption" color="text.secondary">Realtime · Postgres</Typography></Box>
              <Tag tone="primary">ready</Tag>
            </Stack>
            <Divider sx={{ mb: 1.4 }} />
            <Stack direction="row" alignItems="center" spacing={0.9}>
              <Official name="vercel" size={17} color="#D81B60" />
              <Typography variant="caption" color="text.secondary">{s.settings.workspace} workspace</Typography>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Panel title="Commands" action={<Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.8 }}>
        <Btn size="small" icon="play" onClick={() => { void s.send('command:launch', { profileIds: s.profiles.slice(0, 1).map((p) => p.id) }, 'android-apk'); s.toast('Launch command sent'); }}>Launch on APK</Btn>
        <Btn size="small" icon="refresh" onClick={() => { void s.send('command:reload', { count: s.profiles.length }); s.toast('Reload broadcast'); }}>Reload</Btn>
        <Btn size="small" icon="sync" onClick={() => { void s.send('presence:heartbeat', { online: true }); s.toast('Heartbeat sent'); }}>Heartbeat</Btn>
      </Stack>}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.8 }}>
          {[
            { icon: 'monitor' as const, label: 'Desktop', mark: 'electron' },
            { icon: 'globe' as const, label: 'Supabase', mark: 'supabase' },
            { icon: 'phone' as const, label: 'Android', mark: 'android' },
          ].map((n, i) => (
            <Stack direction="row" alignItems="center" spacing={1} key={n.label}>
              {i > 0 && <Icon name="arrow" size={18} color="#D81B60" />}
              <Paper variant="outlined" sx={{ px: 1.2, py: 0.8, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Official name={n.mark} size={17} color="#D81B60" /><Typography variant="caption">{n.label}</Typography>
              </Paper>
            </Stack>
          ))}
        </Stack>
        <Box sx={{ overflowX: 'auto', border: '1px solid', borderColor: 'divider' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th>Time</th><th>Topic</th><th>Route</th><th>Payload</th></tr></thead>
            <tbody>
              {s.syncEvents.length === 0 && <tr><td colSpan={4}><Typography variant="caption" color="text.secondary" sx={{ p: 2, display: 'block', textAlign: 'center' }}>No messages yet. Send a command above.</Typography></td></tr>}
              {s.syncEvents.slice(0, 24).map((e) => (
                <tr key={e.id}>
                  <td><Typography variant="caption">{new Date(e.sentAt).toLocaleTimeString()}</Typography></td>
                  <td><Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{e.topic}</Typography></td>
                  <td><Typography variant="caption">{DEVICE_LABEL[e.from]} to {e.to ? DEVICE_LABEL[e.to] : 'all'}</Typography></td>
                  <td><Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{JSON.stringify(e.payload).slice(0, 72)}</Typography></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
        {mobile && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Swipe the table horizontally to inspect every column.</Typography>}
      </Panel>
    </Box>
  );
}
