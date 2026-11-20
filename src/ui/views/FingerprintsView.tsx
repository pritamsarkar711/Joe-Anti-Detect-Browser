import { useState } from 'react';
import {
  Box, Stack, Grid, Typography, Paper, Tabs, Tab, Chip, Divider, Tooltip, LinearProgress,
} from '@mui/material';
import { useStore } from '@/state/store';
import {
  profileQuality, workspaceQuality, checkProfile, REAL_DEVICE_PRESETS,
  FINGERPRINT_DATA_SOURCE, GEO, GEO_COUNTRIES,
} from '@joe/core';
import { surfaces, buildInjectionScript } from '@joe/fingerprint';
import { Icon } from '../Icons';
import { Official, CountryFlag } from '../Brand';
import { Btn, MetricStrip, PageHead, Panel, ScoreRing, Tag } from '../Primitives';

type TabKey = 'quality' | 'data' | 'surfaces' | 'geo' | 'limits';

const LIMITS = [
  ['TLS and JA4', 'Network handshake signatures stay Chromium or WebView.'],
  ['HTTP/2 and QUIC', 'Header order, priorities and HTTP/3 are not JavaScript surfaces.'],
  ['Font rasterisation', 'Installed system fonts and glyph rendering remain native.'],
  ['GPU driver', 'Low level WebGL extensions, shader timing and vendor behaviour stay native.'],
  ['CDP and automation', 'Runtime.enable, debugger and navigator.webdriver need native patches.'],
  ['Android WebView', 'System WebView version and system locale are controlled by Android.'],
];

function osMark(os: string): string {
  return os === 'Windows' ? 'windows' : os === 'macOS' || os === 'iOS' || os === 'iPadOS' ? 'apple' : os === 'Android' ? 'android' : 'linux';
}

export function FingerprintsView() {
  const s = useStore();
  const [tab, setTab] = useState<TabKey>('quality');
  const wq = workspaceQuality(s.profiles);
  const healthScore = Math.round((wq.averageConsistency + wq.averageUniqueness) / 2);
  /**
   * Only real problems belong in "Needs attention". Info-level entries are the
   * three engine limits every profile shares by design (TLS, rasterisation,
   * CDP), so summing them produced "18 contradictions" on a workspace with
   * zero actual problems and pushed the grade to B next to a 100 ring.
   */
  const realIssues = s.profiles.flatMap((p) => checkProfile(p).issues
    .filter((i) => i.severity !== 'info')
    .map((i) => ({ name: p.name, issue: i })));
  const totalIssues = realIssues.length;
  const duplicates = wq.distinctBundles ? s.profiles.length - wq.distinctBundles : 0;
  const sample = s.profiles[0];
  const probe = sample ? buildInjectionScript(sample.fingerprint) : '';

  return (
    <Box>
      <PageHead
        title="Fingerprints"
        action={<Btn variant="primary" icon="factcheck" onClick={() => s.setView('tests')}>Open leak check</Btn>}
      />

      <MetricStrip
        items={[
          { label: 'Observed devices', value: REAL_DEVICE_PRESETS.length },
          { label: 'Consistency', value: `${wq.averageConsistency}%` },
          { label: 'Uniqueness', value: `${wq.averageUniqueness}%` },
          { label: 'Grade', value: wq.grade },
        ]}
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mt: 1, borderBottom: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Tab value="quality" label="Quality" /><Tab value="data" label="Observed data" /><Tab value="surfaces" label="Surfaces" /><Tab value="geo" label="Regions" /><Tab value="limits" label="Limits" />
      </Tabs>

      {tab === 'quality' && (
        <Stack spacing={2}>
          <Panel>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
              {/* Average of coherence and separation: the same score the grade
                  is derived from, so the ring and the letter cannot disagree. */}
              <ScoreRing value={healthScore} size={96} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h2">Workspace health {wq.grade}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {s.profiles.length} profiles · {duplicates} duplicate bundle{duplicates === 1 ? '' : 's'} ·{' '}
                  {totalIssues === 0 ? 'no contradictions' : `${totalIssues} contradiction${totalIssues === 1 ? '' : 's'}`} · {wq.entropyBits} bits of entropy
                </Typography>
              </Box>
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Grid container spacing={2}>
              {[['Consistency', wq.averageConsistency], ['Uniqueness', wq.averageUniqueness], ['Entropy', Math.min(100, wq.entropyBits * 10)]].map(([k, v]) => (
                <Grid item xs={12} sm={4} key={String(k)}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.6 }}><Typography variant="caption" color="text.secondary">{k}</Typography><Typography variant="caption" sx={{ fontWeight: 700 }}>{typeof v === 'number' && k !== 'Entropy' ? `${v}%` : v}</Typography></Stack>
                  <LinearProgress variant="determinate" value={typeof v === 'number' ? v : 0} />
                </Grid>
              ))}
            </Grid>
          </Panel>

          {realIssues.length > 0 ? (
            <Panel title="Needs attention" action={<Tag tone="warn">{realIssues.length}</Tag>}>
              {realIssues.slice(0, 10).map(({ name, issue }, n) => (
                <Paper key={n} variant="outlined" sx={{ p: 1.1, mb: 0.8, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Icon name="warn" size={19} color="#D81B60" />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>{name} · {issue.surface}</Typography>
                    <Typography variant="caption" color="text.secondary">{issue.message} — {issue.hint}</Typography>
                  </Box>
                  <Tag tone={issue.severity === 'critical' ? 'err' : 'warn'}>{issue.severity}</Tag>
                </Paper>
              ))}
              {realIssues.length > 10 && (
                <Typography variant="caption" color="text.secondary">and {realIssues.length - 10} more — open the profile to fix them.</Typography>
              )}
            </Panel>
          ) : (
            <Panel title="Status">
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Icon name="verified" size={20} color="#D81B60" />
                <Typography sx={{ fontSize: '0.84rem', fontWeight: 600 }}>No contradictions in this workspace</Typography>
              </Stack>
            </Panel>
          )}

          <Panel title="Per profile" pad={0}>
            <Box sx={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th>Profile</th><th>Source</th><th>Consistency</th><th>Uniqueness</th><th>Contradictions</th><th>Known limits</th></tr></thead>
                <tbody>{s.profiles.slice(0, 25).map((p) => {
                  const q = profileQuality(p, s.profiles);
                  const issues = checkProfile(p).issues;
                  return <tr key={p.id}><td>{p.name}</td><td>{q.realBacked ? <Tag tone="primary">Observed</Tag> : 'Generated'}</td><td>{q.consistency}%</td><td>{q.uniqueness}%</td><td>{issues.filter((i) => i.severity !== 'info').length}</td><td>{issues.filter((i) => i.severity === 'info').length}</td></tr>;
                })}</tbody>
              </table>
            </Box>
          </Panel>
        </Stack>
      )}

      {tab === 'data' && (
        <Stack spacing={1}>
          <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Box sx={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)', color: 'primary.main', flex: 'none' }}><Icon name="storage" size={22} /></Box>
            <Box><Typography sx={{ fontWeight: 600, fontSize: '0.84rem' }}>{FINGERPRINT_DATA_SOURCE}</Typography><Typography variant="caption" color="text.secondary">{REAL_DEVICE_PRESETS.length} observed device samples · Apache 2.0 · stored locally</Typography></Box>
          </Paper>
          {REAL_DEVICE_PRESETS.map((r) => (
            <Paper key={r.id} variant="outlined" sx={{ p: 1.25, display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)', flex: 'none' }}><Official name={osMark(r.os)} size={18} color="#D81B60" /></Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontSize: '0.81rem', fontWeight: 600 }}>{r.label}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all' }}>{r.gpu.renderer}</Typography>
                <Typography variant="caption" color="text.secondary">{r.screen.width}×{r.screen.height} · {r.fonts.length} fonts · {r.cores} cores · {r.memoryGb} GB</Typography>
              </Box>
              <Chip label={`Chrome ${r.chromeMajor}`} size="small" variant="outlined" />
            </Paper>
          ))}
        </Stack>
      )}

      {tab === 'surfaces' && sample && (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">Live injection script for {sample.name}: {probe.length.toLocaleString()} bytes.</Typography>
          {surfaces(sample.fingerprint).map((x) => (
            <Paper key={x.key} variant="outlined" sx={{ p: 1.1, display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Box sx={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)', color: 'primary.main', flex: 'none' }}><Icon name={x.level === 'js' ? 'code' : 'build'} size={17} /></Box>
              <Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{x.label}</Typography><Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{x.value}</Typography></Box>
              <Tag tone={x.level === 'js' ? 'primary' : 'neutral'}>{x.level === 'js' ? 'JS' : 'Engine'}</Tag>
            </Paper>
          ))}
        </Stack>
      )}

      {tab === 'geo' && (
        <Grid container spacing={1.5}>
          {GEO_COUNTRIES.map((code) => {
            const g = GEO[code];
            return <Grid item xs={12} sm={6} md={4} key={code}><Paper variant="outlined" sx={{ p: 1.4, display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <CountryFlag code={code} size={30} title={g.name} />
              <Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{g.name}</Typography><Typography variant="caption" color="text.secondary">{g.timezone} · {g.locale}</Typography></Box>
              <Typography variant="caption" color="text.secondary">{g.locale}</Typography>
            </Paper></Grid>;
          })}
        </Grid>
      )}

      {tab === 'limits' && (
        <Stack spacing={1}>
          {LIMITS.map(([k, v]) => <Paper key={k} variant="outlined" sx={{ p: 1.25, display: 'flex', gap: 1.1, alignItems: 'center' }}>
            <Icon name="warn" size={18} color="#D81B60" />
            <Box><Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{k}</Typography><Typography variant="caption" color="text.secondary">{v}</Typography></Box>
          </Paper>)}
        </Stack>
      )}
    </Box>
  );
}
