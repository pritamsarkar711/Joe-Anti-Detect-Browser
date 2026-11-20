import { useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Grid, Typography, Paper, TextField, Select, MenuItem, Chip, Accordion,
  AccordionSummary, AccordionDetails, Divider, ToggleButton, ToggleButtonGroup, InputAdornment,
} from '@mui/material';
import { useStore } from '@/state/store';
import {
  DEVICE_TEMPLATES, TEMPLATE_GROUPS as GROUPS, REAL_DEVICE_PRESETS, DEFAULT_START_PAGE,
  generateProfiles, parseCookies, BROWSER_SUPPORT, EXTENSION_CATALOG, defaultExtensionsForFamily,
  createProfile, GEO, GEO_COUNTRIES,
  type BrowserFamily, type FingerprintSpec,
} from '@joe/core';
import { Icon } from '../Icons';
import { JoeMark, Official, ProfileAvatar } from '../Brand';
import { ExtensionLogo } from '../ExtensionLogo';
import { Btn, Field, Modal } from '../Primitives';

const osMark = (os: string) =>
  os === 'Windows' ? 'windows'
    : os === 'macOS' || os === 'iOS' || os === 'iPadOS' ? 'apple'
      : os === 'Android' ? 'android'
        : 'linux';

const MARKS: Record<string, string | null> = { joe: null, chrome: 'chrome', chromium: 'chromium', edge: 'edge', brave: 'brave', firefox: 'firefox' };
const FAMILIES = BROWSER_SUPPORT.map((b) => ({ id: b.family, label: b.label, mark: MARKS[b.family] ?? null, available: b.available, note: b.note }));

const CHROME_VERSIONS = [156, 155, 154, 152, 150, 146, 142, 138];
const SCREEN_PRESETS = ['Auto', '1920x1080', '2560x1440', '1440x900', '1366x768', '412x915', '393x852', '834x1194'];
const TIMEZONES = [...new Set(GEO_COUNTRIES.map((c) => GEO[c].timezone))];
const LOCALES = [...new Set(GEO_COUNTRIES.map((c) => GEO[c].locale))];

export function CreateProfile() {
  const s = useStore();
  const [name, setName] = useState('');
  const [seed, setSeed] = useState(() => `joe::${Date.now()}`);
  const [qty, setQty] = useState(1);
  const [group, setGroup] = useState('Default');
  const [tags, setTags] = useState('');
  const [family, setFamily] = useState<BrowserFamily>('joe');
  const [chromeMajor, setChromeMajor] = useState<string>('Auto');
  const [preset, setPreset] = useState('win11-intel');
  const [mode, setMode] = useState<'template' | 'real'>('template');
  const [osTab, setOsTab] = useState<string>('Windows');
  const [proxyId, setProxyId] = useState('');
  const [startUrl, setStartUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [cookies, setCookies] = useState('');
  const [screenChoice, setScreenChoice] = useState('Auto');
  const [timezone, setTimezone] = useState('');
  const [locale, setLocale] = useState('');
  const [cores, setCores] = useState('');
  const [memory, setMemory] = useState('');
  const [webrtcMode, setWebrtcMode] = useState<FingerprintSpec['webrtcMode']>('replace');
  const [doNotTrack, setDoNotTrack] = useState<'null' | '1' | '0'>('null');
  const [customUa, setCustomUa] = useState('');
  const [selectedExts, setSelectedExts] = useState<string[]>(() => defaultExtensionsForFamily('joe'));
  const [extPaths, setExtPaths] = useState('');

  useEffect(() => {
    setSelectedExts(defaultExtensionsForFamily(family));
  }, [family]);

  const selectedReal = useMemo(() => REAL_DEVICE_PRESETS.find((r) => r.id === preset), [preset]);
  const cookieCount = useMemo(() => parseCookies(cookies).length, [cookies]);
  const extensionPaths = useMemo(() => extPaths.split('\n').map((x) => x.trim()).filter(Boolean), [extPaths]);

  const screenOverride = useMemo(() => {
    if (screenChoice === 'Auto') return undefined;
    const [w, h] = screenChoice.split('x').map(Number);
    if (!w || !h) return undefined;
    return { width: w, height: h, dpr: w <= 500 ? 3 : w <= 900 ? 2 : 1 };
  }, [screenChoice]);

  const previewSpec = useMemo(() => createProfile({
    name: name || 'Storefront US',
    seed: name ? `${name}::${seed}` : seed,
    browserFamily: family,
    ...(mode === 'real' ? { realPresetId: preset } : { templateId: preset }),
    overrides: {
      ...(chromeMajor !== 'Auto' ? { chromeMajor: Number(chromeMajor) } : {}),
      ...(screenOverride ? { screen: screenOverride } : {}),
      ...(timezone ? { timezone } : {}),
      ...(locale ? { locale } : {}),
      ...(cores ? { cores: Number(cores) } : {}),
      ...(memory ? { memoryGb: Number(memory) } : {}),
      webrtcMode,
      doNotTrack: doNotTrack === 'null' ? null : doNotTrack,
      ...(customUa.trim() ? { userAgent: customUa.trim() } : {}),
    },
  }).fingerprint, [name, seed, family, mode, preset, chromeMajor, screenOverride, timezone, locale, cores, memory, webrtcMode, doNotTrack, customUa]);

  const toggleExt = (id: string) => {
    setSelectedExts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const close = () => s.setCreateOpen(false);
  const submit = () => {
    const mergedExtensions = [...new Set([...selectedExts, ...extensionPaths])];
    const base = {
      seed: name ? `${name}::${seed}` : seed,
      group: group || 'Default',
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      proxyId: proxyId || null,
      notes,
      startUrl: startUrl.trim() || DEFAULT_START_PAGE,
      cookies,
      extensions: mergedExtensions,
      browserFamily: family,
      ...(mode === 'real' ? { realPresetId: preset } : { templateId: preset }),
      overrides: {
        ...(chromeMajor !== 'Auto' ? { chromeMajor: Number(chromeMajor) } : {}),
        ...(screenOverride ? { screen: screenOverride } : {}),
        ...(timezone ? { timezone } : {}),
        ...(locale ? { locale } : {}),
        ...(cores ? { cores: Number(cores) } : {}),
        ...(memory ? { memoryGb: Number(memory) } : {}),
        webrtcMode,
        doNotTrack: doNotTrack === 'null' ? null : doNotTrack,
        ...(customUa.trim() ? { userAgent: customUa.trim() } : {}),
      },
    };
    if (!s.entitlement.allowed) { s.toast(s.entitlement.reason, 'warn'); return; }
    if (qty > 1) {
      s.addProfiles(generateProfiles(qty, base, name || 'Profile'));
      s.toast(`${qty} profiles created`);
    } else {
      const one = s.createOne({ ...base, name: name || 'New profile' });
      if (!one) return;
      s.toast('Profile created');
    }
    setName(''); setQty(1); setCookies(''); setExtPaths(''); setCustomUa('');
    setTimezone(''); setLocale(''); setCores(''); setMemory(''); setNotes(''); setStartUrl('');
    setChromeMajor('Auto'); setScreenChoice('Auto');
    close();
  };

  return (
    <Modal
      open={s.createOpen} onClose={close} width={720}
      title="New profile"
      actions={
        <>
          <Btn onClick={close}>Cancel</Btn>
          <Btn icon="shuffle" onClick={() => setSeed(`joe::${Date.now()}::${Math.random().toString(36).slice(2, 6)}`)}>Randomize</Btn>
          <Btn variant="primary" icon="plus" onClick={submit}>
            {qty > 1 ? `Create ${qty} profiles` : 'Create profile'}
          </Btn>
        </>
      }
    >
      <Stack spacing={1.75}>
        <Paper variant="outlined" sx={{ p: 1.1, display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <ProfileAvatar name={name || 'New profile'} seed={seed} browserFamily={family} size={36} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{name || 'New profile'}</Typography>
            <Typography noWrap variant="caption" color="text.secondary">
              {previewSpec.uaClientHints.platform} · {previewSpec.screen.width}×{previewSpec.screen.height} · {previewSpec.cores}C/{previewSpec.memoryGb}GB · {previewSpec.timezone}
            </Typography>
          </Box>
          <Chip label={`v${previewSpec.chromeMajor}`} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.68rem' }} />
        </Paper>

        <Grid container spacing={1.25}>
          <Grid item xs={12} sm={6}><Field label="Name" value={name} onChange={setName} placeholder="Storefront US" /></Grid>
          <Grid item xs={5} sm={2}><Field label="Count" value={String(qty)} onChange={(v) => setQty(Math.max(1, Math.min(2000, Number(v) || 1)))} type="number" /></Grid>
          <Grid item xs={7} sm={4}><Field label="Group" value={group} onChange={setGroup} /></Grid>
        </Grid>

        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.6 }}>
            <Typography variant="overline" color="text.secondary">Browser identity</Typography>
            <Select
              size="small" value={chromeMajor} onChange={(e) => setChromeMajor(e.target.value)}
              sx={{ height: 26, fontSize: '0.72rem', minWidth: 112 }}
            >
              <MenuItem value="Auto">Version: Auto</MenuItem>
              {CHROME_VERSIONS.map((v) => <MenuItem key={v} value={String(v)}>Version {v}</MenuItem>)}
            </Select>
          </Stack>
          <Grid container spacing={0.85}>
            {FAMILIES.map((f) => {
              const locked = f.available && s.lockedBrowser(f.id);
              const disabled = !f.available || locked;
              return (
                <Grid item xs={6} sm={4} key={f.id}>
                  <Paper
                    variant="outlined"
                    title={f.note}
                    onClick={() => {
                      if (!f.available) { s.toast('Firefox is not available (requires Gecko)', 'info'); return; }
                      if (locked) { s.toast('Premium identity', 'warn'); return; }
                      setFamily(f.id);
                    }}
                    sx={{
                      p: 0.9, cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 0.8,
                      opacity: !f.available ? 0.48 : locked ? 0.6 : 1,
                      borderColor: family === f.id && !disabled ? 'primary.main' : 'divider',
                      bgcolor: family === f.id && !disabled ? 'rgba(216,27,96,0.06)' : 'transparent',
                    }}
                  >
                    {f.mark ? <Official name={f.mark} size={17} /> : <JoeMark size={17} tile />}
                    <Typography noWrap sx={{ fontSize: '0.76rem', fontWeight: 600, minWidth: 0, flex: 1 }}>{f.label}</Typography>
                    {locked && <Icon name="lock" size={13} />}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Firefox is not available on this Chromium build.
          </Typography>
        </Box>

        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.6 }}>
            <Typography variant="overline" color="text.secondary">Device</Typography>
            <ToggleButtonGroup
              size="small" exclusive value={mode}
              onChange={(_, v) => { if (!v) return; setMode(v); setPreset(v === 'real' ? REAL_DEVICE_PRESETS[0].id : DEVICE_TEMPLATES[0].id); }}
              sx={{ '& .MuiToggleButton-root': { px: 1.1, py: 0.2, fontSize: '0.7rem' } }}
            >
              <ToggleButton value="template">Devices</ToggleButton>
              <ToggleButton value="real">Observed</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {mode === 'template' ? (
            <Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.9 }}>
                {GROUPS.map((g) => (
                  <Chip
                    key={g.os}
                    icon={<Official name={osMark(g.os)} size={13} />}
                    label={`${g.os} · ${g.items.length}`}
                    onClick={() => { setOsTab(g.os); if (g.items[0]) setPreset(g.items[0].id); }}
                    size="small"
                    variant={osTab === g.os ? 'filled' : 'outlined'}
                    sx={{
                      height: 24, fontSize: '0.7rem', pl: 0.4,
                      ...(osTab === g.os ? { bgcolor: 'rgba(216,27,96,0.12)', color: 'primary.main', fontWeight: 600 } : {}),
                    }}
                  />
                ))}
              </Box>
              <Grid container spacing={0.75}>
                {(GROUPS.find((g) => g.os === osTab) ?? GROUPS[0]).items.map((t) => (
                  <Grid item xs={12} sm={6} key={t.id}>
                    <Paper
                      variant="outlined" onClick={() => setPreset(t.id)}
                      sx={{
                        p: 0.85, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.85,
                        borderColor: preset === t.id ? 'primary.main' : 'divider',
                        bgcolor: preset === t.id ? 'rgba(216,27,96,0.05)' : 'transparent',
                      }}
                    >
                      <Official name={osMark(t.os)} size={16} />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography noWrap sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{t.label}</Typography>
                        <Typography noWrap variant="caption" color="text.secondary" sx={{ fontSize: '0.64rem' }}>
                          {t.screens[0].width}×{t.screens[0].height} · {t.hardware[0].cores}C/{t.hardware[0].memoryGb}GB
                        </Typography>
                      </Box>
                      {preset === t.id && <Icon name="check" size={16} color="#D81B60" />}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          ) : (
            <Box>
              <Select fullWidth size="small" value={preset} onChange={(e) => setPreset(e.target.value)} sx={{ mb: 0.75 }}>
                {REAL_DEVICE_PRESETS.map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.label} · {r.screen.width}×{r.screen.height}</MenuItem>
                ))}
              </Select>
              {selectedReal && (
                <Paper variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Official name={osMark(selectedReal.os)} size={16} />
                  <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                    {selectedReal.cores} cores · {selectedReal.memoryGb} GB · {selectedReal.fonts.length} fonts
                  </Typography>
                  <Chip label="Observed" size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: 'rgba(216,27,96,0.1)', color: 'primary.main' }} />
                </Paper>
              )}
            </Box>
          )}
        </Box>

        <Grid container spacing={1.25}>
          <Grid item xs={12} sm={6}>
            <Select
              fullWidth size="small" displayEmpty value={proxyId}
              onChange={(e) => setProxyId(e.target.value)}
              renderValue={(v) => {
                const px = s.proxies.find((x) => x.id === v);
                return px ? `${px.name} · ${px.country}` : 'Direct connection';
              }}
            >
              <MenuItem value="">Direct connection</MenuItem>
              {s.proxies.map((p) => <MenuItem key={p.id} value={p.id}>{p.name} · {p.country}</MenuItem>)}
            </Select>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Field label="Start URL" value={startUrl} onChange={setStartUrl} placeholder={DEFAULT_START_PAGE} />
          </Grid>
        </Grid>

        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Extensions ({selectedExts.length})
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
            {EXTENSION_CATALOG.slice(0, 7).map((ext) => {
              const active = selectedExts.includes(ext.id);
              return (
                <Chip
                  key={ext.id}
                  size="small"
                  clickable
                  avatar={<Box sx={{ display: 'grid', placeItems: 'center', pl: 0.4 }}><ExtensionLogo mark={ext.mark} size={15} /></Box>}
                  label={ext.name}
                  variant={active ? 'filled' : 'outlined'}
                  onDelete={active ? () => toggleExt(ext.id) : undefined}
                  onClick={() => toggleExt(ext.id)}
                  sx={{
                    height: 26, fontSize: '0.7rem',
                    ...(active ? { bgcolor: 'rgba(216,27,96,0.10)', color: 'primary.main', fontWeight: 600 } : {}),
                  }}
                />
              );
            })}
          </Box>
        </Box>

        <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<Icon name="chevronDown" size={18} />} sx={{ minHeight: 38 }}>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600 }}>Fingerprint & Data</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Grid container spacing={1.25}>
              <Grid item xs={6} sm={4}>
                <Select fullWidth size="small" value={screenChoice} onChange={(e) => setScreenChoice(e.target.value)} displayEmpty>
                  {SCREEN_PRESETS.map((sc) => <MenuItem key={sc} value={sc}>Screen: {sc}</MenuItem>)}
                </Select>
              </Grid>
              <Grid item xs={6} sm={4}>
                <Select fullWidth size="small" value={timezone} onChange={(e) => setTimezone(e.target.value)} displayEmpty>
                  <MenuItem value="">Timezone: Auto</MenuItem>
                  {TIMEZONES.map((tz) => <MenuItem key={tz} value={tz}>{tz}</MenuItem>)}
                </Select>
              </Grid>
              <Grid item xs={6} sm={4}>
                <Select fullWidth size="small" value={locale} onChange={(e) => setLocale(e.target.value)} displayEmpty>
                  <MenuItem value="">Locale: Auto</MenuItem>
                  {LOCALES.map((loc) => <MenuItem key={loc} value={loc}>{loc}</MenuItem>)}
                </Select>
              </Grid>
              <Grid item xs={4} sm={3}><Field label="Cores" value={cores} onChange={setCores} placeholder="Auto" /></Grid>
              <Grid item xs={4} sm={3}><Field label="RAM (GB)" value={memory} onChange={setMemory} placeholder="Auto" /></Grid>
              <Grid item xs={4} sm={3}>
                <Select fullWidth size="small" value={webrtcMode} onChange={(e) => setWebrtcMode(e.target.value as FingerprintSpec['webrtcMode'])}>
                  <MenuItem value="replace">WebRTC: Replace</MenuItem>
                  <MenuItem value="proxy">WebRTC: Proxy</MenuItem>
                  <MenuItem value="disabled">WebRTC: Off</MenuItem>
                </Select>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Select fullWidth size="small" value={doNotTrack} onChange={(e) => setDoNotTrack(e.target.value as 'null' | '1' | '0')}>
                  <MenuItem value="null">DNT: Unset</MenuItem>
                  <MenuItem value="1">DNT: 1</MenuItem>
                  <MenuItem value="0">DNT: 0</MenuItem>
                </Select>
              </Grid>
              <Grid item xs={12} sm={8}>
                <Field label="User-Agent" value={customUa} onChange={setCustomUa} placeholder={previewSpec.userAgent} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Field label="Tags" value={tags} onChange={setTags} placeholder="ads, us" />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth size="small" label={cookieCount ? `Cookies (${cookieCount})` : 'Cookies'}
                  value={cookies} onChange={(e) => setCookies(e.target.value)}
                  placeholder="JSON or name=value pairs" multiline rows={2}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="cookie" size={16} /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth size="small" label={extensionPaths.length ? `Unpacked extensions (${extensionPaths.length})` : 'Unpacked extension paths'}
                  value={extPaths} onChange={(e) => setExtPaths(e.target.value)}
                  placeholder="Folder paths, one per line" multiline rows={2}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="extension" size={16} /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12}><Field label="Notes" value={notes} onChange={setNotes} /></Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Stack>
    </Modal>
  );
}
