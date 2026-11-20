import { useRef, useState } from 'react';
import {
  Box, Stack, Grid, Typography, Paper, Switch, ToggleButton, ToggleButtonGroup,
  Select, MenuItem, Divider, Alert, Avatar,
} from '@mui/material';
import { useStore } from '@/state/store';
import { downloadFile, planFor, PLANS } from '@joe/core';
import { Icon } from '../Icons';
import { Official } from '../Brand';
import { Btn, Field, MetricStrip, PageHead, Panel, Tag } from '../Primitives';

export function SettingsView() {
  const s = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const exportAll = () => { downloadFile('joe-browser-workspace.json', JSON.stringify(s.exportData(), null, 2)); s.toast('Workspace exported'); };
  const onFile = async (file: File) => {
    try { const n = s.importData(await file.text()); s.toast(`${n} profiles imported`); }
    catch (e) { s.toast((e as Error).message, 'err'); }
  };

  return (
    <Box>
      <PageHead title="Settings" hint="Appearance, sync, data and scope." />

      <MetricStrip
        items={[
          { label: 'Profiles', value: s.profiles.length },
          { label: 'Storage', value: 'Local' },
          { label: 'Sync', value: s.settings.autoSync ? 'On' : 'Off' },
          { label: 'Build', value: `v${s.appVersion}` },
        ]}
      />

      <Box sx={{ mt: 1.75, mb: 2 }}>
        <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Panel title="Account and plan">
            <Stack spacing={1.25}>
              <Stack direction="row" alignItems="center" spacing={1.25}>
                <Avatar sx={{ width: 34, height: 34, bgcolor: 'rgba(216,27,96,0.12)', color: 'primary.main', fontSize: 14, fontWeight: 700 }}>
                  {s.account.email[0]?.toUpperCase() ?? 'J'}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography noWrap sx={{ fontSize: '0.84rem', fontWeight: 600 }}>{s.account.email}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.planLabel}</Typography>
                </Box>
                {s.account.role === 'owner' && <Tag tone="primary">Owner</Tag>}
              </Stack>
              <Divider />
              <Typography variant="caption" color="text.secondary">{s.entitlement.reason}</Typography>
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                {s.cloudEmail ? (
                  <>
                    <Btn size="small" icon="refresh" onClick={() => { void s.refreshEntitlement(); }}>Refresh plan</Btn>
                    <Btn size="small" icon="restart" onClick={() => s.signOut()}>Sign out</Btn>
                  </>
                ) : (
                  <Btn size="small" variant="primary" icon="person" onClick={() => s.setView('account')}>Sign in</Btn>
                )}
              </Stack>
              <Alert severity={s.entitlementSource === 'server' ? 'success' : 'info'} variant="outlined" sx={{ py: 0.5, fontSize: '0.76rem' }}>
                {s.planNotice}
              </Alert>
              <Typography variant="caption" color="text.secondary">
                Plan status is synced from your account service. Use Refresh plan after an update.
              </Typography>
            </Stack>
          </Panel>
        </Grid>
        <Grid item xs={12} md={6}>
          <Panel title="Plan comparison">
            <Stack spacing={0.6}>
              {(['free', 'premium'] as const).map((id) => {
                const p = PLANS[id];
                const active = planFor(s.account).id === id;
                return (
                  <Paper key={id} variant="outlined" sx={{ p: 1.1, borderColor: active ? 'primary.main' : 'divider', bgcolor: active ? 'rgba(216,27,96,0.04)' : 'transparent' }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{p.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{p.price}</Typography>
                      <Box sx={{ flex: 1 }} />
                      {active && <Tag tone="primary">Current</Tag>}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{p.summary}</Typography>
                  </Paper>
                );
              })}
            </Stack>
          </Panel>
        </Grid>
        </Grid>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Panel title="Appearance">
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <Box><Typography sx={{ fontSize: '0.84rem', fontWeight: 600 }}>Theme</Typography><Typography variant="caption" color="text.secondary">Light or dark workspace</Typography></Box>
                <ToggleButtonGroup size="small" exclusive value={s.settings.theme} onChange={(_, v) => v && s.setSetting('theme', v)}>
                  <ToggleButton value="light" sx={{ px: 1.2 }}><Icon name="sun" size={19} /></ToggleButton>
                  <ToggleButton value="dark" sx={{ px: 1.2 }}><Icon name="moon" size={19} /></ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              <Divider />
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <Box><Typography sx={{ fontSize: '0.84rem', fontWeight: 600 }}>Density</Typography><Typography variant="caption" color="text.secondary">Row height in tables</Typography></Box>
                <ToggleButtonGroup size="small" exclusive value={s.settings.density} onChange={(_, v) => v && s.setSetting('density', v)}>
                  <ToggleButton value="comfortable" sx={{ px: 1.2, fontSize: '0.74rem' }}>Comfortable</ToggleButton>
                  <ToggleButton value="compact" sx={{ px: 1.2, fontSize: '0.74rem' }}>Compact</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
              <Divider />
              <Box>
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>Default device</Typography>
                {/* Plain labels, not icon+text stacks: MUI renders the selected
                    MenuItem's children inside the input, and an inline SVG
                    there overlaps the value at small sizes. */}
                <Select
                  fullWidth size="small" value={s.settings.defaultDevice}
                  onChange={(e) => s.setSetting('defaultDevice', e.target.value as 'desktop-exe' | 'android-apk')}
                  renderValue={(v) => (v === 'android-apk' ? 'Android app (APK)' : 'Windows desktop (EXE)')}
                >
                  <MenuItem value="desktop-exe">Windows desktop (EXE)</MenuItem>
                  <MenuItem value="android-apk">Android app (APK)</MenuItem>
                </Select>
              </Box>
              <Field label="Start page" value={s.settings.startPage} onChange={(v) => s.setSetting('startPage', v)} placeholder="https://example.com" />
            </Stack>
          </Panel>
        </Grid>

        <Grid item xs={12} md={6}>
          <Panel title="Notifications">
            <Stack spacing={1.1}>
              {([
                ['proxyAlerts', 'Proxy offline alerts', 'One notification when a proxy drops, one when it recovers'],
                ['rotationAlerts', 'Rotation alerts', 'Confirm when profiles move to a new exit'],
              ] as const).map(([key, label, help]) => (
                <Stack key={key} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.84rem', fontWeight: 600 }}>{label}</Typography>
                    <Typography variant="caption" color="text.secondary">{help}</Typography>
                  </Box>
                  <Switch checked={s.settings[key]} onChange={(e) => s.setSetting(key, e.target.checked)} inputProps={{ 'aria-label': label }} />
                </Stack>
              ))}
              <Typography variant="caption" color="text.secondary">
                Alerts appear in-app and in activity. Nothing leaves the device.
              </Typography>
            </Stack>
          </Panel>
        </Grid>

        <Grid item xs={12} md={6}>
          <Panel title="Supabase sync" action={<Tag tone="primary">ready</Tag>}>
            <Stack spacing={1.6}>
              <Stack direction="row" alignItems="center" spacing={0.9}><Official name="supabase" size={20} color="#D81B60" /><Typography variant="caption" color="text.secondary">Realtime and Postgres</Typography></Stack>
              <Field label="Project URL" value={s.settings.supabaseUrl} onChange={(v) => s.setSetting('supabaseUrl', v)} />
              <Field label="Publishable key" value={s.settings.anonKey} onChange={(v) => s.setSetting('anonKey', v)} type="password" helper="Never store service keys in a client app" />
              <Field label="Workspace" value={s.settings.workspace} onChange={(v) => s.setSetting('workspace', v)} />
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Box><Typography sx={{ fontSize: '0.84rem', fontWeight: 600 }}>Auto sync</Typography><Typography variant="caption" color="text.secondary">Realtime channel Joe sync</Typography></Box>
                <Switch checked={s.settings.autoSync} onChange={(e) => s.setSetting('autoSync', e.target.checked)} inputProps={{ 'aria-label': 'Auto sync' }} />
              </Stack>
            </Stack>
          </Panel>
        </Grid>

        <Grid item xs={12} md={6}>
          <Panel title="Data">
            <Stack spacing={1.6}>
              <Typography variant="body2" color="text.secondary">Profiles are stored locally. Export a workspace file to move them between desktop, Android and the control plane.</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.8 }}>
                <Btn icon="download" onClick={exportAll}>Export workspace</Btn>
                <Btn icon="upload" onClick={() => fileRef.current?.click()}>Import workspace</Btn>
                <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }} />
                {confirmReset
                  ? <Btn icon="refresh" variant="danger" onClick={() => { s.reset(); setConfirmReset(false); }}>Confirm reset</Btn>
                  : <Btn icon="restart" onClick={() => setConfirmReset(true)}>Restore demo data</Btn>}
              </Stack>
            </Stack>
          </Panel>
        </Grid>

        <Grid item xs={12} md={6}>
          <Panel title="About and scope">
            <Stack spacing={1.2}>
              {[
                ['Version', `v${s.appVersion}`],
                ['Desktop', 'Electron · Windows x64'],
                ['Android', 'WebView · minSdk 28'],
                ['License', 'MIT with additional notices'],
              ].map(([k, v]) => <Stack key={k} direction="row" justifyContent="space-between"><Typography variant="caption" color="text.secondary">{k}</Typography><Typography variant="caption" sx={{ fontWeight: 600 }}>{v}</Typography></Stack>)}
              <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap', gap: 0.6 }}>
                {['react', 'typescript', 'mui', 'github', 'vercel'].map((n) => <Paper key={n} variant="outlined" sx={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center' }}><Official name={n} size={16} color="#D81B60" /></Paper>)}
              </Stack>
              <Alert severity="info" variant="outlined" icon={<Icon name="shield" size={21} />}>
                Isolated local profiles with zero telemetry.
              </Alert>
            </Stack>
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
}
