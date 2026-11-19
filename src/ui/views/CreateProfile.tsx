import { useMemo, useState } from 'react';
import {
  Box, Stack, Grid, Typography, Paper, TextField, Select, MenuItem, Chip, Accordion,
  AccordionSummary, AccordionDetails, Divider, ToggleButton, ToggleButtonGroup, InputAdornment,
} from '@mui/material';
import { useStore } from '@/state/store';
import {
  DEVICE_TEMPLATES, TEMPLATE_GROUPS as GROUPS, REAL_DEVICE_PRESETS,
  generateProfiles, parseCookies, FINGERPRINT_DATA_SOURCE, type BrowserProfile,
} from '@joe/core';
import { Icon } from '../Icons';
import { Official, CountryFlag } from '../Brand';
import { Btn, Field, Modal } from '../Primitives';

function osMark(os: string): string {
  return os === 'Windows' ? 'windows' : os === 'macOS' ? 'apple' : os === 'Android' ? 'android' : 'linux';
}

export function CreateProfile() {
  const s = useStore();
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [group, setGroup] = useState('Default');
  const [tags, setTags] = useState('');
  const [preset, setPreset] = useState('win11-intel');
  const [mode, setMode] = useState<'template' | 'real'>('template');
  const [proxyId, setProxyId] = useState('');
  const [startUrl, setStartUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [cookies, setCookies] = useState('');
  const [extensions, setExtensions] = useState('');
  const [timezone, setTimezone] = useState('');
  const [locale, setLocale] = useState('');
  const [cores, setCores] = useState('');
  const [memory, setMemory] = useState('');

  const selectedReal = useMemo(() => REAL_DEVICE_PRESETS.find((r) => r.id === preset), [preset]);
  const cookieCount = useMemo(() => parseCookies(cookies).length, [cookies]);
  const extensionPaths = useMemo(() => extensions.split('\n').map((x) => x.trim()).filter(Boolean), [extensions]);

  const close = () => s.setCreateOpen(false);
  const submit = () => {
    const base = {
      seed: name || `joe::${Date.now()}`,
      group, tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      proxyId: proxyId || null, notes, startUrl, cookies,
      extensions: extensionPaths,
      ...(mode === 'real' ? { realPresetId: preset } : { templateId: preset }),
      overrides: {
        ...(timezone ? { timezone } : {}), ...(locale ? { locale } : {}),
        ...(cores ? { cores: Number(cores) } : {}), ...(memory ? { memoryGb: Number(memory) } : {}),
      },
    };
    const created: BrowserProfile[] = qty > 1
      ? generateProfiles(qty, base, name || 'Profile')
      : [s.createOne({ ...base, name: name || 'New profile' })];
    if (qty > 1) s.addProfiles(created);
    s.toast(`${created.length} profiles created`);
    setName(''); setQty(1); setCookies(''); setExtensions(''); setTimezone(''); setLocale(''); setCores(''); setMemory('');
    close();
  };

  return (
    <Modal
      open={s.createOpen} onClose={close} width={720}
      title="New profile" subtitle="One coherent device per profile. No limits."
      actions={<><Btn onClick={close}>Cancel</Btn><Btn variant="primary" icon="plus" onClick={submit}>Create profile</Btn></>}
    >
      <Stack spacing={2}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={8}><Field label="Name" value={name} onChange={setName} placeholder="Storefront US" /></Grid>
          <Grid item xs={12} sm={4}><Field label="Quantity" value={String(qty)} onChange={(v) => setQty(Math.max(1, Math.min(2000, Number(v) || 1)))} type="number" helper="No limit" /></Grid>
          <Grid item xs={12} sm={6}><Field label="Group" value={group} onChange={setGroup} /></Grid>
          <Grid item xs={12} sm={6}><Field label="Tags" value={tags} onChange={setTags} placeholder="priority, review" /></Grid>
        </Grid>

        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="h6">Device</Typography>
            <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => { if (!v) return; setMode(v); setPreset(v === 'real' ? REAL_DEVICE_PRESETS[0].id : DEVICE_TEMPLATES[0].id); }}>
              <ToggleButton value="template" sx={{ px: 1.4, fontSize: '0.75rem' }}>Templates</ToggleButton>
              <ToggleButton value="real" sx={{ px: 1.4, fontSize: '0.75rem' }}>Observed devices</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {mode === 'template' ? (
            <Stack spacing={1.4}>
              {GROUPS.map((g) => (
                <Box key={g.os}>
                  <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>{g.os}</Typography>
                  <Grid container spacing={1}>
                    {g.items.map((t) => (
                      <Grid item xs={12} sm={6} key={t.id}>
                        <Paper
                          variant="outlined" onClick={() => setPreset(t.id)}
                          sx={{ p: 1.3, cursor: 'pointer', borderColor: preset === t.id ? 'primary.main' : 'divider', bgcolor: preset === t.id ? 'rgba(216,27,96,0.06)' : 'transparent', display: 'flex', alignItems: 'center', gap: 1.2 }}
                        >
                          <Box sx={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)', flex: 'none' }}>
                            <Official name={osMark(t.os)} size={19} color="#D81B60" />
                          </Box>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{t.label}</Typography>
                            <Typography variant="caption" color="text.secondary">Chrome {t.chromeMajor} · {t.screens[0].width}×{t.screens[0].height}</Typography>
                          </Box>
                          {preset === t.id && <Icon name="check" size={20} color="#D81B60" />}
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ))}
              <Typography variant="caption" color="text.secondary">{FINGERPRINT_DATA_SOURCE}</Typography>
            </Stack>
          ) : (
            <Box>
              <Select fullWidth size="small" value={preset} onChange={(e) => setPreset(e.target.value)} sx={{ mb: 1.2 }}>
                {REAL_DEVICE_PRESETS.map((r) => <MenuItem key={r.id} value={r.id}>{r.label} · Chrome {r.chromeMajor} · {r.screen.width}×{r.screen.height}</MenuItem>)}
              </Select>
              {selectedReal && (
                <Paper variant="outlined" sx={{ p: 1.4 }}>
                  <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1 }}>
                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: 'rgba(216,27,96,0.10)' }}><Official name={osMark(selectedReal.os)} size={18} color="#D81B60" /></Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.84rem' }}>{selectedReal.label}</Typography>
                    <Chip label="Observed" size="small" color="primary" />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all' }}>{selectedReal.userAgent}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all' }}>{selectedReal.gpu.renderer}</Typography>
                  <Typography variant="caption" color="text.secondary">{selectedReal.fonts.length} fonts · {selectedReal.cores} cores · {selectedReal.memoryGb} GB</Typography>
                </Paper>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.8 }}>{FINGERPRINT_DATA_SOURCE}</Typography>
            </Box>
          )}
        </Box>

        <Divider />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>Network</Typography>
            <Select fullWidth size="small" value={proxyId} onChange={(e) => setProxyId(e.target.value)}>
              <MenuItem value="">Direct connection</MenuItem>
              {s.proxies.map((p) => <MenuItem key={p.id} value={p.id}>{p.name} · {p.host}:{p.port}</MenuItem>)}
            </Select>
            {proxyId && <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mt: 0.8 }}><CountryFlag code={s.proxies.find((p) => p.id === proxyId)?.country ?? 'XX'} size={17} /><Typography variant="caption" color="text.secondary">Geo match available after creation</Typography></Stack>}
          </Grid>
          <Grid item xs={12} sm={6}><Field label="Start URL" value={startUrl} onChange={setStartUrl} placeholder="https://example.com" /></Grid>
        </Grid>

        <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<Icon name="chevronDown" size={20} />} sx={{ minHeight: 40 }}>
            <Stack direction="row" alignItems="center" spacing={1}><Icon name="tune" size={20} /><Typography sx={{ fontSize: '0.84rem', fontWeight: 600 }}>Advanced</Typography></Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><Field label="Timezone" value={timezone} onChange={setTimezone} placeholder="Europe/Berlin" /></Grid>
              <Grid item xs={12} sm={6}><Field label="Locale" value={locale} onChange={setLocale} placeholder="de-DE" /></Grid>
              <Grid item xs={6} sm={3}><Field label="Cores" value={cores} onChange={setCores} placeholder="8" /></Grid>
              <Grid item xs={6} sm={3}><Field label="Memory GB" value={memory} onChange={setMemory} placeholder="16" /></Grid>
              <Grid item xs={12}><Field label="Notes" value={notes} onChange={setNotes} placeholder="Optional note" multiline rows={2} /></Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label={`Cookies${cookieCount ? ` (${cookieCount})` : ''}`} value={cookies} onChange={(e) => setCookies(e.target.value)} placeholder="Paste JSON or name=value pairs" multiline rows={2} InputLabelProps={{ shrink: true }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="cookie" size={19} /></InputAdornment> }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth size="small" label={`Extensions${extensionPaths.length ? ` (${extensionPaths.length})` : ''}`} value={extensions} onChange={(e) => setExtensions(e.target.value)} placeholder="One unpacked extension path per line" multiline rows={2} InputLabelProps={{ shrink: true }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="extension" size={19} /></InputAdornment> }} />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Stack>
    </Modal>
  );
}
