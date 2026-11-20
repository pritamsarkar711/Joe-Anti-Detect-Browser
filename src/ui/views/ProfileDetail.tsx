import { useState } from 'react';
import {
  Box, Stack, Grid, Typography, Paper, Tabs, Tab, Chip, Divider, Select, MenuItem, Tooltip,
} from '@mui/material';
import { useStore } from '@/state/store';
import {
  checkProfile, profileQuality, profileBrowserLabel, REAL_DEVICE_PRESETS, geoForCountry,
  getRealPreset, FINGERPRINT_DATA_SOURCE, downloadFile, BROWSER_SUPPORT,
  type BrowserFamily, type FingerprintSpec,
} from '@joe/core';
import { surfaces } from '@joe/fingerprint';
import { Icon } from '../Icons';
import { Official, CountryFlag } from '../Brand';
import { Btn, IconBtn, Panel, Tag, ScoreRing, Empty, Field, Modal } from '../Primitives';
import { PasteAsHuman } from './PasteAsHuman';

type TabKey = 'overview' | 'fingerprint' | 'network' | 'data' | 'devices' | 'tools';

function osMark(os: string): string {
  return os === 'Windows' ? 'windows' : os === 'Android' ? 'android' : os === 'macOS' || os === 'iOS' || os === 'iPadOS' ? 'apple' : 'linux';
}

export function ProfileDetail() {
  const s = useStore();
  const p = s.profiles.find((x) => x.id === s.selectedId) ?? null;
  const [tab, setTab] = useState<TabKey>('overview');
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!p) return null;

  const report = checkProfile(p);
  const quality = profileQuality(p, s.profiles);
  const px = s.proxies.find((x) => x.id === p.proxyId);
  const geo = px ? geoForCountry(px.country) : null;
  const real = p.realId ? getRealPreset(p.realId) : undefined;
  const close = () => s.setSelectedId(null);

  const exportProfile = () => { downloadFile(`${p.name.replace(/\s+/g, '_')}.json`, JSON.stringify(p, null, 2)); s.toast('Profile exported'); };

  return (
    <>
      <Modal
        open onClose={close} width={780} title={p.name} subtitle={p.group}
        actions={<>
          <Btn variant="danger" icon="trash" onClick={() => setConfirmDelete(true)}>Delete</Btn>
          <Box sx={{ flex: 1 }} />
          <Btn icon="download" onClick={exportProfile}>Export</Btn>
          <Btn variant="primary" icon={p.status === 'running' ? 'stop' : 'play'} onClick={() => s.setStatus([p.id], p.status === 'running' ? 'stopped' : 'running')}>{p.status === 'running' ? 'Stop' : 'Launch'}</Btn>
        </>}
      >
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          variant="scrollable" scrollButtons={false} allowScrollButtonsMobile
          sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 2, minHeight: 38, '& .MuiTab-root': { minHeight: 38, py: 0.5, fontSize: '0.78rem' } }}
        >
          <Tab value="overview" label="Overview" />
          <Tab value="fingerprint" label="Fingerprint" />
          <Tab value="network" label="Network" />
          <Tab value="data" label="Data" />
          <Tab value="devices" label="Samples" />
          <Tab value="tools" label="Tools" />
        </Tabs>

        {tab === 'overview' && (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <ScoreRing value={report.score} size={76} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h3">Consistency grade {report.grade}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {(() => {
                      // Info entries are engine limits that no JavaScript
                      // surface can fix; only criticals/warnings are problems.
                      const problems = report.issues.filter((i) => i.severity !== 'info').length;
                      const limits = report.issues.length - problems;
                      if (problems === 0 && limits === 0) return `${report.checked} static checks agree`;
                      if (problems === 0) return `${report.checked} static checks agree · ${limits} engine limit${limits === 1 ? '' : 's'} listed`;
                      return `${problems} of ${report.checked} checks need attention${limits ? ` · ${limits} engine limit${limits === 1 ? '' : 's'}` : ''}`;
                    })()}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>Uniqueness</Typography>
                  <Typography variant="h3" color="primary.main">{quality.uniqueness}%</Typography>
                  <Typography variant="caption" color="text.secondary">{quality.entropyBits} bits</Typography>
                </Box>
              </Stack>
            </Paper>

            <Grid container spacing={2}>
              {[
                ['Device', `${p.fingerprint.uaClientHints.platform} · ${profileBrowserLabel(p)}`],
                ['Screen', `${p.fingerprint.screen.width}×${p.fingerprint.screen.height} @${p.fingerprint.screen.dpr}`],
                ['Timezone', p.fingerprint.timezone],
                ['Locale', p.fingerprint.locale],
                ['Hardware', `${p.fingerprint.cores} cores · ${p.fingerprint.memoryGb} GB`],
                ['Status', p.status],
              ].map(([k, v]) => (
                <Grid item xs={6} sm={4} key={k}>
                  <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>{k}</Typography>
                  <Typography sx={{ fontSize: '0.84rem', fontWeight: 500, wordBreak: 'break-word' }}>{v}</Typography>
                </Grid>
              ))}
            </Grid>

            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Browser identity</Typography>
              <Select
                size="small"
                fullWidth
                value={p.browserFamily}
                onChange={(e) => {
                  const fam = e.target.value as BrowserFamily;
                  if (s.lockedBrowser(fam)) { s.toast('Edge and Brave require Premium.', 'warn'); return; }
                  s.updateProfileIdentity(p.id, { browserFamily: fam });
                  s.toast('Browser identity updated');
                }}
              >
                {BROWSER_SUPPORT.filter((b) => b.available).map((b) => (
                  <MenuItem key={b.family} value={b.family}>
                    {b.label}{s.lockedBrowser(b.family) ? ' (Premium)' : ''}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            {real && <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Box sx={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)' }}><Official name={osMark(real.os)} size={19} color="#D81B60" /></Box>
              <Box sx={{ minWidth: 0 }}><Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{real.label}</Typography><Typography variant="caption" color="text.secondary">{FINGERPRINT_DATA_SOURCE}</Typography></Box>
              <Box sx={{ flex: 1 }} /><Tag tone="primary">Observed</Tag>
            </Paper>}

            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6">Checks</Typography>
                <Typography variant="caption" color="text.secondary">
                  {report.issues.filter((i) => i.severity !== 'info').length} problem{report.issues.filter((i) => i.severity !== 'info').length === 1 ? '' : 's'} · {report.issues.filter((i) => i.severity === 'info').length} limits
                </Typography>
              </Stack>
              {report.issues.length === 0 ? <Empty icon="verified" title="No contradictions found" /> : report.issues.map((i) => (
                <Paper key={i.id} variant="outlined" sx={{ p: 1.3, mb: 0.9, display: 'flex', gap: 1.2, alignItems: 'flex-start' }}>
                  <Icon name={i.severity === 'critical' ? 'err' : i.severity === 'warning' ? 'warn' : 'info'} size={20} color={i.severity === 'info' ? undefined : '#D81B60'} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{i.surface}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{i.message}</Typography>
                    <Typography variant="caption" color="text.secondary">{i.hint}</Typography>
                  </Box>
                  <Box sx={{ flex: 1 }} />
                  <Tag tone={i.severity === 'critical' ? 'err' : i.severity === 'warning' ? 'warn' : 'neutral'}>{i.severity}</Tag>
                </Paper>
              ))}
            </Box>
          </Stack>
        )}

        {tab === 'fingerprint' && (
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">Every JavaScript surface comes from one observed device. Engine surfaces stay native.</Typography>
            {surfaces(p.fingerprint).map((x) => (
              <Paper key={x.key} variant="outlined" sx={{ p: 1.2, display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box sx={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)', color: 'primary.main', flex: 'none' }}><Icon name={x.level === 'js' ? 'code' : 'build'} size={17} /></Box>
                <Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{x.label}</Typography><Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{x.value}</Typography></Box>
                <Tag tone={x.level === 'js' ? 'primary' : 'neutral'}>{x.level === 'js' ? 'JS' : 'Engine'}</Tag>
              </Paper>
            ))}
          </Stack>
        )}

        {tab === 'network' && (
          <Stack spacing={2}>
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>Assigned proxy</Typography>
              <Select
                fullWidth
                size="small"
                displayEmpty
                value={p.proxyId ?? ''}
                onChange={(e) => {
                  const nextId = e.target.value || null;
                  s.updateProfile(p.id, { proxyId: nextId });
                  s.toast(nextId ? 'Proxy assigned' : 'Switched to direct connection');
                }}
              >
                <MenuItem value="">Direct connection</MenuItem>
                {s.proxies.map((x) => (
                  <MenuItem key={x.id} value={x.id}>{x.name} ({x.country}) · {x.protocol}://{x.host}:{x.port}</MenuItem>
                ))}
              </Select>
            </Box>

            {px && (
              <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.4 }}>
                <CountryFlag code={px.country} size={34} title={geo?.name} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.84rem' }}>{px.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{px.protocol} · {px.host}:{px.port}</Typography>
                </Box>
                <Tag tone={px.status === 'ok' ? 'primary' : 'neutral'}>{px.status}</Tag>
              </Paper>
            )}

            <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.84rem' }}>Proxy geo match</Typography>
                <Typography variant="caption" color="text.secondary">Align timezone, locale, and WebRTC to exit region.</Typography>
              </Box>
              <Btn size="small" icon="globe" onClick={() => s.geoMatch([p.id])} disabled={!px}>Match region</Btn>
            </Paper>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>WebRTC policy</Typography>
                <Select
                  fullWidth
                  size="small"
                  value={p.fingerprint.webrtcMode}
                  onChange={(e) => s.updateProfileIdentity(p.id, { webrtcMode: e.target.value as FingerprintSpec['webrtcMode'] })}
                >
                  <MenuItem value="replace">Replace (strip local/mDNS)</MenuItem>
                  <MenuItem value="proxy">Proxy IP only</MenuItem>
                  <MenuItem value="disabled">Disabled</MenuItem>
                </Select>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>Do Not Track</Typography>
                <Typography sx={{ fontSize: '0.84rem', pt: 1 }}>{p.fingerprint.doNotTrack ?? 'off'}</Typography>
              </Grid>
            </Grid>
          </Stack>
        )}

        {tab === 'data' && (
          <Stack spacing={2}>
            <Field label="Name" value={p.name} onChange={(v) => s.updateProfile(p.id, { name: v })} />
            <Field label="Start URL" value={p.startUrl} onChange={(v) => s.updateProfile(p.id, { startUrl: v })} placeholder="https://example.com" />
            <Field label="Notes" value={p.notes} onChange={(v) => s.updateProfile(p.id, { notes: v })} multiline rows={2} />
            <Field label="Cookies (JSON or name=value pairs)" value={p.cookies} onChange={(v) => s.updateProfile(p.id, { cookies: v })} multiline rows={3} />
            <Field label="Unpacked extensions (one path per line)" value={p.extensions.join('\n')} onChange={(v) => s.updateProfile(p.id, { extensions: v.split('\n').map((x) => x.trim()).filter(Boolean) })} multiline rows={2} />
            <Stack direction="row" spacing={1}><Btn icon="copy" onClick={() => s.duplicateProfiles([p.id])}>Duplicate</Btn><Btn icon="globe" onClick={() => s.geoMatch([p.id])}>Geo match</Btn></Stack>
          </Stack>
        )}

        {tab === 'tools' && (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 1.8 }}><PasteAsHuman profileName={p.name} profileId={p.id} /></Paper>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography sx={{ fontSize: '0.84rem', fontWeight: 600, mb: 0.4 }}>History for this profile</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                URLs and searches captured while this profile is open. Stored on this device only.
              </Typography>
              <Btn size="small" icon="history" onClick={() => { close(); s.setView('history'); }}>Open history</Btn>
            </Paper>
          </Stack>
        )}

        {tab === 'devices' && (
          <Stack spacing={1}>
            <Typography variant="body2" color="text.secondary">{FINGERPRINT_DATA_SOURCE}. Each entry is one coherent observed device.</Typography>
            {REAL_DEVICE_PRESETS.map((r) => (
              <Paper key={r.id} variant="outlined" sx={{ p: 1.2, display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box sx={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)', flex: 'none' }}><Official name={osMark(r.os)} size={17} color="#D81B60" /></Box>
                <Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{r.label}</Typography><Typography variant="caption" color="text.secondary">{r.mobile ? 'Mobile' : 'Desktop'} · {r.screen.width}×{r.screen.height}</Typography></Box>
                <Tooltip title={r.gpu.renderer}><span><Chip label={`${r.cores} cores`} size="small" variant="outlined" /></span></Tooltip>
                <Btn size="small" onClick={() => { s.applyPreset([p.id], r.id); s.toast('Observed device applied'); }}>Apply</Btn>
              </Paper>
            ))}
          </Stack>
        )}
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} width={380} title="Delete profile" actions={<><Btn onClick={() => setConfirmDelete(false)}>Cancel</Btn><Btn variant="danger" icon="trash" onClick={() => { s.deleteProfiles([p.id]); setConfirmDelete(false); close(); }}>Delete</Btn></>}>
        <Typography variant="body2">This removes the profile from this workspace.</Typography>
      </Modal>
    </>
  );
}
