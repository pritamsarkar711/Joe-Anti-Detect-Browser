import { useState } from 'react';
import {
  Box, Stack, Grid, Typography, Paper, Tabs, Tab, Chip, Select, MenuItem, Tooltip,
} from '@mui/material';
import { useStore } from '@/state/store';
import {
  checkProfile, profileQuality, profileBrowserLabel, REAL_DEVICE_PRESETS, geoForCountry,
  getRealPreset, downloadFile, BROWSER_SUPPORT, EXTENSION_CATALOG,
  type BrowserFamily, type FingerprintSpec,
} from '@joe/core';
import { surfaces } from '@joe/fingerprint';
import { Icon } from '../Icons';
import { Official, CountryFlag, ProfileAvatar } from '../Brand';
import { ExtensionLogo } from '../ExtensionLogo';
import { Btn, Tag, ScoreRing, Empty, Field, Modal } from '../Primitives';
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

  const exportProfile = () => { downloadFile(`${p.name.replace(/\s+/g, '_')}.json`, JSON.stringify(p, null, 2)); s.toast('Exported'); };

  const customPaths = p.extensions.filter((id) => !EXTENSION_CATALOG.some((c) => c.id === id));

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
          sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 1.75, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, fontSize: '0.78rem' } }}
        >
          <Tab value="overview" label="Overview" />
          <Tab value="fingerprint" label="Fingerprint" />
          <Tab value="network" label="Network" />
          <Tab value="data" label="Data" />
          <Tab value="devices" label="Presets" />
          <Tab value="tools" label="Tools" />
        </Tabs>

        {tab === 'overview' && (
          <Stack spacing={1.75}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <ProfileAvatar name={p.name} seed={p.fingerprint.noiseSeed} browserFamily={p.browserFamily} size={42} />
                <ScoreRing value={report.score} size={58} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="h4">Grade {report.grade}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {report.issues.filter((i) => i.severity !== 'info').length} issues · {report.checked} checks
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>Uniqueness</Typography>
                  <Typography variant="h4" color="primary.main">{quality.uniqueness}%</Typography>
                </Box>
              </Stack>
            </Paper>

            <Grid container spacing={1.5}>
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
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 500, wordBreak: 'break-word' }}>{v}</Typography>
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
                  if (s.lockedBrowser(fam)) { s.toast('Premium identity', 'warn'); return; }
                  s.updateProfileIdentity(p.id, { browserFamily: fam });
                  s.toast('Identity updated');
                }}
              >
                {BROWSER_SUPPORT.filter((b) => b.available).map((b) => (
                  <MenuItem key={b.family} value={b.family}>
                    {b.label}{s.lockedBrowser(b.family) ? ' (Premium)' : ''}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            {real && <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Official name={osMark(real.os)} size={18} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{real.label}</Typography>
              </Box>
              <Tag tone="primary">Observed</Tag>
            </Paper>}

            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>Checks</Typography>
              {report.issues.length === 0 ? <Empty icon="verified" title="No issues" /> : report.issues.map((i) => (
                <Paper key={i.id} variant="outlined" sx={{ p: 1.1, mb: 0.75, display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Icon name={i.severity === 'critical' ? 'err' : i.severity === 'warning' ? 'warn' : 'info'} size={18} color={i.severity === 'info' ? undefined : '#D81B60'} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{i.surface}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{i.message}</Typography>
                  </Box>
                  <Tag tone={i.severity === 'critical' ? 'err' : i.severity === 'warning' ? 'warn' : 'neutral'}>{i.severity}</Tag>
                </Paper>
              ))}
            </Box>
          </Stack>
        )}

        {tab === 'fingerprint' && (
          <Stack spacing={0.85}>
            {surfaces(p.fingerprint).map((x) => (
              <Paper key={x.key} variant="outlined" sx={{ p: 1.1, display: 'flex', alignItems: 'center', gap: 1.1 }}>
                <Icon name={x.level === 'js' ? 'code' : 'build'} size={16} color="#D81B60" />
                <Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ fontSize: '0.78rem', fontWeight: 600 }}>{x.label}</Typography><Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>{x.value}</Typography></Box>
                <Tag tone={x.level === 'js' ? 'primary' : 'neutral'}>{x.level === 'js' ? 'JS' : 'Engine'}</Tag>
              </Paper>
            ))}
          </Stack>
        )}

        {tab === 'network' && (
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Proxy</Typography>
              <Select
                fullWidth size="small" displayEmpty value={p.proxyId ?? ''}
                onChange={(e) => {
                  const nextId = e.target.value || null;
                  s.updateProfile(p.id, { proxyId: nextId });
                  s.toast(nextId ? 'Proxy assigned' : 'Direct connection');
                }}
              >
                <MenuItem value="">Direct connection</MenuItem>
                {s.proxies.map((x) => (
                  <MenuItem key={x.id} value={x.id}>{x.name} ({x.country}) · {x.protocol}://{x.host}:{x.port}</MenuItem>
                ))}
              </Select>
            </Box>

            {px && (
              <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <CountryFlag code={px.country} size={30} title={geo?.name} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.84rem' }}>{px.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{px.protocol} · {px.host}:{px.port}</Typography>
                </Box>
                <Tag tone={px.status === 'ok' ? 'primary' : 'neutral'}>{px.status}</Tag>
              </Paper>
            )}

            <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.82rem' }}>Proxy geo match</Typography>
              <Btn size="small" icon="globe" onClick={() => s.geoMatch([p.id])} disabled={!px}>Match region</Btn>
            </Paper>

            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}>
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>WebRTC</Typography>
                <Select
                  fullWidth size="small" value={p.fingerprint.webrtcMode}
                  onChange={(e) => s.updateProfileIdentity(p.id, { webrtcMode: e.target.value as FingerprintSpec['webrtcMode'] })}
                >
                  <MenuItem value="replace">Replace (strip local IP)</MenuItem>
                  <MenuItem value="proxy">Proxy IP only</MenuItem>
                  <MenuItem value="disabled">Disabled</MenuItem>
                </Select>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Do Not Track</Typography>
                <Typography sx={{ fontSize: '0.84rem', pt: 1 }}>{p.fingerprint.doNotTrack ?? 'off'}</Typography>
              </Grid>
            </Grid>
          </Stack>
        )}

        {tab === 'data' && (
          <Stack spacing={1.5}>
            <Field label="Name" value={p.name} onChange={(v) => s.updateProfile(p.id, { name: v })} />
            <Field label="Start URL" value={p.startUrl} onChange={(v) => s.updateProfile(p.id, { startUrl: v })} placeholder="https://browserscan.net/" />
            <Field label="Notes" value={p.notes} onChange={(v) => s.updateProfile(p.id, { notes: v })} multiline rows={2} />
            <Field label="Cookies (JSON or name=value)" value={p.cookies} onChange={(v) => s.updateProfile(p.id, { cookies: v })} multiline rows={3} />
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Extensions</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mb: 1 }}>
                {EXTENSION_CATALOG.slice(0, 7).map((ext) => {
                  const active = p.extensions.includes(ext.id);
                  return (
                    <Chip
                      key={ext.id}
                      size="small"
                      clickable
                      avatar={<Box sx={{ display: 'grid', placeItems: 'center', pl: 0.4 }}><ExtensionLogo mark={ext.mark} size={15} /></Box>}
                      label={ext.name}
                      variant={active ? 'filled' : 'outlined'}
                      onDelete={active ? () => s.toggleProfileExtension(p.id, ext.id) : undefined}
                      onClick={() => s.toggleProfileExtension(p.id, ext.id)}
                      sx={{
                        height: 26, fontSize: '0.7rem',
                        ...(active ? { bgcolor: 'rgba(216,27,96,0.10)', color: 'primary.main', fontWeight: 600 } : {}),
                      }}
                    />
                  );
                })}
              </Box>
              <Field
                label="Unpacked paths"
                value={customPaths.join('\n')}
                onChange={(v) => {
                  const builtIn = p.extensions.filter((id) => EXTENSION_CATALOG.some((c) => c.id === id));
                  const paths = v.split('\n').map((x) => x.trim()).filter(Boolean);
                  s.updateProfile(p.id, { extensions: [...builtIn, ...paths] });
                }}
                multiline rows={2}
              />
            </Box>
            <Stack direction="row" spacing={1}><Btn icon="copy" onClick={() => s.duplicateProfiles([p.id])}>Duplicate</Btn><Btn icon="globe" onClick={() => s.geoMatch([p.id])}>Geo match</Btn></Stack>
          </Stack>
        )}

        {tab === 'tools' && (
          <Stack spacing={1.5}>
            <Paper variant="outlined" sx={{ p: 1.5 }}><PasteAsHuman profileName={p.name} profileId={p.id} /></Paper>
            <Paper variant="outlined" sx={{ p: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>Profile history</Typography>
              <Btn size="small" icon="history" onClick={() => { close(); s.setView('history'); }}>Open history</Btn>
            </Paper>
          </Stack>
        )}

        {tab === 'devices' && (
          <Stack spacing={0.85}>
            {REAL_DEVICE_PRESETS.map((r) => (
              <Paper key={r.id} variant="outlined" sx={{ p: 1.1, display: 'flex', alignItems: 'center', gap: 1.1 }}>
                <Official name={osMark(r.os)} size={17} />
                <Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{r.label}</Typography><Typography variant="caption" color="text.secondary">{r.mobile ? 'Mobile' : 'Desktop'} · {r.screen.width}×{r.screen.height}</Typography></Box>
                <Tooltip title={r.gpu.renderer}><span><Chip label={`${r.cores}C / ${r.memoryGb}GB`} size="small" variant="outlined" /></span></Tooltip>
                <Btn size="small" onClick={() => { s.applyPreset([p.id], r.id); s.toast('Preset applied'); }}>Apply</Btn>
              </Paper>
            ))}
          </Stack>
        )}
      </Modal>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} width={360} title="Delete profile" actions={<><Btn onClick={() => setConfirmDelete(false)}>Cancel</Btn><Btn variant="danger" icon="trash" onClick={() => { s.deleteProfiles([p.id]); setConfirmDelete(false); close(); }}>Delete</Btn></>}>
        <Typography variant="body2">Remove this profile permanently?</Typography>
      </Modal>
    </>
  );
}
