import { useMemo, useState } from 'react';
import {
  Box, Stack, Grid, Typography, Paper, TextField, Select, MenuItem, Chip, Accordion,
  AccordionSummary, AccordionDetails, Divider, ToggleButton, ToggleButtonGroup, InputAdornment,
} from '@mui/material';
import { useStore } from '@/state/store';
import {
  DEVICE_TEMPLATES, TEMPLATE_GROUPS as GROUPS, REAL_DEVICE_PRESETS, DEFAULT_START_PAGE,
  generateProfiles, parseCookies, BROWSER_SUPPORT,
  type BrowserProfile, type BrowserFamily,
} from '@joe/core';
import { Icon } from '../Icons';
import { Official, CountryFlag } from '../Brand';
import { Btn, Field, Modal } from '../Primitives';

const osMark = (os: string) =>
  os === 'Windows' ? 'windows'
    : os === 'macOS' ? 'apple'
      : os === 'Android' ? 'android'
        : os === 'iOS' || os === 'iPadOS' ? 'apple'
          : 'linux';

/**
 * Browser identities, not engines.
 *
 * Only Chromium is bundled (Electron on Windows, WebView on Android). Chrome,
 * Edge and Brave are compatible identities on that engine; Firefox is a Gecko
 * browser and is not offered, because a Firefox UA on Chromium is a contradiction
 * rather than a feature. The list therefore comes from `BROWSER_SUPPORT`, which
 * also carries the reason shown to the user.
 */
const MARKS: Record<string, string | null> = { joe: null, chrome: 'chrome', chromium: 'chrome', edge: 'edge', brave: 'brave', firefox: 'firefox' };
const FAMILIES = BROWSER_SUPPORT.map((b) => ({ id: b.family, label: b.label, mark: MARKS[b.family] ?? null, available: b.available, note: b.note }));

export function CreateProfile() {
  const s = useStore();
  const [name, setName] = useState('');
  const [qty, setQty] = useState(1);
  const [group, setGroup] = useState('Default');
  const [tags, setTags] = useState('');
  const [family, setFamily] = useState<BrowserFamily>('joe');
  const [preset, setPreset] = useState('win11-intel');
  const [mode, setMode] = useState<'template' | 'real'>('template');
  /** Which OS group of device classes is on screen. Keeps the dialog short. */
  const [osTab, setOsTab] = useState<string>('Windows');
  const [proxyId, setProxyId] = useState('');
  const [startUrl, setStartUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [cookies, setCookies] = useState('');
  const [timezone, setTimezone] = useState('');
  const [locale, setLocale] = useState('');
  const [cores, setCores] = useState('');
  const [memory, setMemory] = useState('');
  const [extensions, setExtensions] = useState('');

  const selectedReal = useMemo(() => REAL_DEVICE_PRESETS.find((r) => r.id === preset), [preset]);
  const cookieCount = useMemo(() => parseCookies(cookies).length, [cookies]);
  const extensionPaths = useMemo(() => extensions.split('\n').map((x) => x.trim()).filter(Boolean), [extensions]);

  const close = () => s.setCreateOpen(false);
  const submit = () => {
    const base = {
      seed: name || `joe::${Date.now()}`,
      group: group || 'Default',
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      proxyId: proxyId || null,
      notes,
      startUrl: startUrl.trim() || DEFAULT_START_PAGE,
      cookies,
      extensions: extensionPaths,
      browserFamily: family,
      ...(mode === 'real' ? { realPresetId: preset } : { templateId: preset }),
      overrides: {
        ...(timezone ? { timezone } : {}), ...(locale ? { locale } : {}),
        ...(cores ? { cores: Number(cores) } : {}), ...(memory ? { memoryGb: Number(memory) } : {}),
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
    setName(''); setQty(1); setCookies(''); setExtensions('');
    setTimezone(''); setLocale(''); setCores(''); setMemory(''); setNotes(''); setStartUrl('');
    close();
  };

  return (
    <Modal
      open={s.createOpen} onClose={close} width={680}
      title="New profile"
      actions={
        <>
          <Btn onClick={close}>Cancel</Btn>
          <Btn variant="primary" icon="plus" onClick={submit}>
            {qty > 1 ? `Create ${qty} profiles` : 'Create profile'}
          </Btn>
        </>
      }
    >
      <Stack spacing={2}>
        {/* 1 — identity */}
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={7}><Field label="Name" value={name} onChange={setName} placeholder="Storefront US" /></Grid>
          <Grid item xs={6} sm={2.5}><Field label="How many" value={String(qty)} onChange={(v) => setQty(Math.max(1, Math.min(2000, Number(v) || 1)))} type="number" /></Grid>
          <Grid item xs={6} sm={2.5}><Field label="Group" value={group} onChange={setGroup} /></Grid>
        </Grid>

        {/* 2 — browser */}
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.6 }}>Browser identity</Typography>
          <Grid container spacing={1}>
            {FAMILIES.filter((f) => f.available).map((f) => {
              const locked = s.lockedBrowser(f.id);
              return (
              <Grid item xs={6} sm={4} md={2.4} key={f.id}>
                <Paper
                  variant="outlined"
                  title={f.note}
                  onClick={() => (locked ? s.toast('Edge and Brave are Premium identities. Free keeps Chrome and Joe Browser.', 'warn') : setFamily(f.id))}
                  sx={{
                    p: 1, cursor: locked ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 0.75,
                    opacity: locked ? 0.55 : 1,
                    borderColor: family === f.id ? 'primary.main' : 'divider',
                    bgcolor: family === f.id ? 'rgba(216,27,96,0.05)' : 'transparent',
                  }}
                >
                  {f.mark ? <Official name={f.mark} size={17} /> : <Icon name="stealth" size={17} color="#D81B60" />}
                  <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 600, minWidth: 0, flex: 1 }}>{f.label}</Typography>
                  {locked && <Icon name="lock" size={13} />}
                </Paper>
              </Grid>
              );
            })}
          </Grid>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            Runs in an isolated session on the bundled engine.
          </Typography>
        </Box>

        {/* 3 — device */}
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
            <Typography variant="overline" color="text.secondary">Device</Typography>
            <ToggleButtonGroup
              size="small" exclusive value={mode}
              onChange={(_, v) => { if (!v) return; setMode(v); setPreset(v === 'real' ? REAL_DEVICE_PRESETS[0].id : DEVICE_TEMPLATES[0].id); }}
              sx={{ '& .MuiToggleButton-root': { px: 1.1, py: 0.25, fontSize: '0.7rem' } }}
            >
              <ToggleButton value="template">Classes</ToggleButton>
              <ToggleButton value="real">Observed</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {mode === 'template' ? (
            <Box>
              {/* One row of OS tabs instead of one long list: the previous
                  fixed-height box clipped cards mid-row and added a nested
                  scrollbar inside a scrolling dialog. */}
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                {GROUPS.map((g) => (
                  <Chip
                    key={g.os}
                    label={`${g.os} · ${g.items.length}`}
                    onClick={() => setOsTab(g.os)}
                    size="small"
                    variant={osTab === g.os ? 'filled' : 'outlined'}
                    sx={{
                      height: 24, fontSize: '0.7rem',
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
                        p: 0.9, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.9,
                        borderColor: preset === t.id ? 'primary.main' : 'divider',
                        bgcolor: preset === t.id ? 'rgba(216,27,96,0.05)' : 'transparent',
                      }}
                    >
                      <Official name={osMark(t.os)} size={16} color="#D81B60" />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography noWrap sx={{ fontSize: '0.76rem', fontWeight: 600 }}>{t.label}</Typography>
                        <Typography noWrap variant="caption" color="text.secondary" sx={{ fontSize: '0.64rem' }}>
                          {t.screens[0].width}×{t.screens[0].height} · {t.mobile ? 'Mobile' : 'Desktop'}
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
              <Select fullWidth size="small" value={preset} onChange={(e) => setPreset(e.target.value)} sx={{ mb: 1 }}>
                {REAL_DEVICE_PRESETS.map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.label} · {r.screen.width}×{r.screen.height}</MenuItem>
                ))}
              </Select>
              {selectedReal && (
                <Paper variant="outlined" sx={{ p: 1.1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <Official name={osMark(selectedReal.os)} size={16} color="#D81B60" />
                    <Typography sx={{ fontWeight: 600, fontSize: '0.8rem' }}>{selectedReal.label}</Typography>
                    <Chip label="Observed" size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: 'rgba(216,27,96,0.1)', color: 'primary.main' }} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {selectedReal.cores} cores · {selectedReal.memoryGb} GB · {selectedReal.fonts.length} fonts
                  </Typography>
                </Paper>
              )}
            </Box>
          )}
        </Box>

        <Divider />

        {/* 4 — network + start page */}
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={6}>
            {/* A shrunk floating label instead of a floating overline: the
                overline sat outside the control and read as a stray caption. */}
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
            <Typography variant="caption" color="text.secondary">Proxy for this profile</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Field label="Start page" value={startUrl} onChange={setStartUrl} placeholder={DEFAULT_START_PAGE} />
          </Grid>
        </Grid>

        <Accordion disableGutters elevation={0} sx={{ border: '1px solid', borderColor: 'divider', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<Icon name="chevronDown" size={18} />} sx={{ minHeight: 38 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>Advanced</Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            <Grid container spacing={1.5}>
              <Grid item xs={6} sm={3}><Field label="Timezone" value={timezone} onChange={setTimezone} placeholder="Europe/Berlin" /></Grid>
              <Grid item xs={6} sm={3}><Field label="Locale" value={locale} onChange={setLocale} placeholder="de-DE" /></Grid>
              <Grid item xs={6} sm={2}><Field label="Cores" value={cores} onChange={setCores} placeholder="8" /></Grid>
              <Grid item xs={6} sm={2}><Field label="RAM (GB)" value={memory} onChange={setMemory} placeholder="16" /></Grid>
              <Grid item xs={12} sm={2}><Field label="Tags" value={tags} onChange={setTags} placeholder="qa" /></Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth size="small" label={cookieCount ? `Cookies (${cookieCount})` : 'Cookies'}
                  value={cookies} onChange={(e) => setCookies(e.target.value)}
                  placeholder="Paste cookie JSON or name=value pairs" multiline rows={2}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="cookie" size={17} /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth size="small" label={extensionPaths.length ? `Extension paths (${extensionPaths.length})` : 'Extension paths'}
                  value={extensions} onChange={(e) => setExtensions(e.target.value)}
                  placeholder="One unpacked extension folder per line" multiline rows={2}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="extension" size={17} /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12}><Field label="Notes" value={notes} onChange={setNotes} multiline rows={2} /></Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

      </Stack>
    </Modal>
  );
}
