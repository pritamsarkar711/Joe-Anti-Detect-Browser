import { useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Paper, TextField, InputAdornment, Divider, Chip, ToggleButton,
  ToggleButtonGroup, useMediaQuery, useTheme,
} from '@mui/material';
import { EXTENSION_CATALOG, storeLink, FAMILY_LABEL, type BrowserFamily, type CatalogExtension } from '@joe/core';
import { useStore } from '@/state/store';
import { nativeExtensions, nativeCanInstallExtensions, type InstalledExtension } from '@/state/native';
import { Icon } from '../Icons';
import { Official } from '../Brand';
import { Btn, IconBtn, PageHead } from '../Primitives';

// `mark` is an official brand key from src/ui/brandPaths.ts. Edge is pinned from
// simple-icons v11 because v16 removed it.
const FAMILIES: Array<{ id: BrowserFamily; mark: string | null; label: string; short: string }> = [
  { id: 'chrome', mark: 'chrome', label: 'Chrome', short: 'Chrome' },
  { id: 'edge', mark: 'edge', label: 'Edge', short: 'Edge' },
  { id: 'firefox', mark: 'firefox', label: 'Firefox', short: 'Firefox' },
  { id: 'brave', mark: 'brave', label: 'Brave', short: 'Brave' },
];

const CATEGORIES = ['All', 'Privacy', 'Security', 'Developer', 'Automation', 'Productivity'] as const;

export function ExtensionsView() {
  const s = useStore();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [q, setQ] = useState('');
  const [family, setFamily] = useState<BrowserFamily>('chrome');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [installed, setInstalled] = useState<InstalledExtension[]>([]);
  const canInstall = nativeCanInstallExtensions();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return EXTENSION_CATALOG.filter((e) => (
      (!needle || `${e.name} ${e.publisher} ${e.description}`.toLowerCase().includes(needle))
      && (category === 'All' || e.category === category)
    ));
  }, [q, category]);

  const openStore = (ext: CatalogExtension, fam: BrowserFamily = family) => {
    window.open(storeLink(ext, fam), '_blank', 'noopener,noreferrer');
  };

  /**
   * Install into the app's own extensions folder.
   *
   * The desktop shell owns the filesystem, so it does the work. Everywhere else
   * there is nowhere to install to — the button becomes a store link and the UI
   * never reports a success that did not happen.
   */
  const install = async (ext: CatalogExtension) => {
    const bridge = nativeExtensions();
    if (!bridge) {
      openStore(ext);
      s.toast('The desktop build installs this for you. Opening the store listing.', 'info');
      return;
    }
    const packagePath = window.prompt(
      `Choose the .zip package for ${ext.name}\n\nPaste its full path. The app verifies it, unpacks it into its own folder and attaches it to the selected profile.`,
      '',
    );
    if (!packagePath) return;
    try {
      const installed = await bridge.install(packagePath.trim(), ext.id);
      setInstalled((prev) => [...prev.filter((e) => e.dir !== installed.dir), installed]);
      setAdded((prev) => new Set(prev).add(ext.id));
      s.toast(`${installed.name} ${installed.version} installed`);
    } catch (e) {
      s.toast(String((e as Error).message || 'Install failed'), 'err');
    }
  };


  return (
    <Box>
      <PageHead
        title="Extensions"
        hint="Add extensions to a profile, or open the listing for the browser you use."
        action={(
          <Btn icon="open" onClick={() => window.open(
            family === 'firefox' ? 'https://addons.mozilla.org/firefox/'
              : family === 'edge' ? 'https://microsoftedge.microsoft.com/addons/'
                : 'https://chromewebstore.google.com/',
            '_blank', 'noopener,noreferrer',
          )}>
            {FAMILY_LABEL[family]} store
          </Btn>
        )}
      />

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', p: 1.25 }}>
          <TextField
            size="small" placeholder="Search extensions" value={q} onChange={(e) => setQ(e.target.value)}
            sx={{ flex: { xs: '1 1 100%', sm: '1 1 220px' }, maxWidth: { sm: 300 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="search" size={18} /></InputAdornment> }}
          />
          <ToggleButtonGroup
            exclusive size="small" value={family} onChange={(_e, v) => v && setFamily(v)}
            sx={{ flexWrap: 'wrap', '& .MuiToggleButton-root': { px: 1.1, py: 0.45, gap: 0.6, fontSize: '0.76rem' } }}
          >
            {FAMILIES.map((f) => (
              <ToggleButton key={f.id} value={f.id} aria-label={f.label}>
                {/* Icon-only chips were indistinguishable as bare glyphs, so
                    the family name stays visible at every width and the chip
                    simply gets tighter on phones. */}
                {f.mark ? <Official name={f.mark} size={14} /> : <Icon name="web" size={14} />}
                <Box component="span" sx={{ ml: 0.5 }}>{f.short}</Box>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Box sx={{ flex: 1, display: { xs: 'none', lg: 'block' } }} />
          <ToggleButtonGroup
            exclusive size="small" value={category} onChange={(_e, v) => v && setCategory(v)}
            sx={{ flexWrap: 'wrap', '& .MuiToggleButton-root': { px: 1, py: 0.4, fontSize: '0.72rem' } }}
          >
            {CATEGORIES.map((c) => <ToggleButton key={c} value={c}>{c}</ToggleButton>)}
          </ToggleButtonGroup>
        </Box>
        <Divider />

        <Box sx={{ p: { xs: 1.25, md: 2 }, display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
          {rows.map((ext) => {
            const isAdded = added.has(ext.id);
            return (
              <Paper key={ext.id} variant="outlined" sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: 'rgba(216,27,96,0.08)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                    {ext.mark ? <Official name={ext.mark} size={16} /> : <Icon name="extension" size={16} color="#D81B60" />}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography noWrap sx={{ fontWeight: 600, fontSize: '0.84rem' }}>{ext.name}</Typography>
                    <Typography noWrap variant="caption" color="text.secondary">{ext.publisher}</Typography>
                  </Box>
                  <Chip
                    label={ext.category} size="small"
                    sx={{ height: 19, fontSize: '0.62rem', bgcolor: 'action.hover', color: 'text.secondary' }}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ minHeight: mobile ? 0 : 34 }}>
                  {ext.description}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 'auto', pt: 0.25 }}>
                  <Btn
                    size="small" variant={isAdded ? 'ghost' : 'primary'}
                    icon={isAdded ? 'check' : 'plus'}
                    onClick={() => { void install(ext); }}
                    disabled={isAdded}
                  >
                    {isAdded ? 'Installed' : canInstall ? 'Install' : 'Get'}
                  </Btn>
                  <Box sx={{ flex: 1 }} />
                  <Btn size="small" icon="open" onClick={() => openStore(ext)}>Store</Btn>
                </Stack>
              </Paper>
            );
          })}
          {rows.length === 0 && (
            <Box sx={{ gridColumn: '1 / -1', py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">No extensions match that search.</Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {installed.length > 0 && (
        <Paper variant="outlined" sx={{ mt: 1.5, p: 1.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Installed on this device</Typography>
          <Stack spacing={0.5}>
            {installed.map((e) => (
              <Stack key={e.dir} direction="row" alignItems="center" spacing={1}>
                <Icon name="extension" size={15} color="#D81B60" />
                <Typography variant="body2" noWrap sx={{ flex: 1 }}>{e.name}</Typography>
                <Typography variant="caption" color="text.secondary">{e.version}</Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
