import { useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Paper, TextField, InputAdornment, Divider, Chip, ToggleButton,
  ToggleButtonGroup, useMediaQuery, useTheme,
} from '@mui/material';
import { EXTENSION_CATALOG, storeLink, FAMILY_LABEL, type BrowserFamily, type CatalogExtension } from '@joe/core';
import { useStore } from '@/state/store';
import { Icon } from '../Icons';
import { Official } from '../Brand';
import { Btn, IconBtn, PageHead } from '../Primitives';

// `mark` is an official simple-icons key; Edge has no free official glyph, so it
// falls back to the app's neutral globe icon instead of an invented logo.
const FAMILIES: Array<{ id: BrowserFamily; mark: string | null; label: string; short: string }> = [
  { id: 'chrome', mark: 'chrome', label: 'Chrome', short: 'Chrome' },
  { id: 'edge', mark: null, label: 'Edge', short: 'Edge' },
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

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return EXTENSION_CATALOG.filter((e) => (
      (!needle || `${e.name} ${e.publisher} ${e.description}`.toLowerCase().includes(needle))
      && (category === 'All' || e.category === category)
    ));
  }, [q, category]);

  const add = (ext: CatalogExtension) => {
    setAdded((prev) => new Set(prev).add(ext.id));
    s.toast(`${ext.name} added to your library`);
  };

  const openStore = (ext: CatalogExtension, fam: BrowserFamily = family) => {
    window.open(storeLink(ext, fam), '_blank', 'noopener,noreferrer');
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
                    onClick={() => add(ext)}
                    disabled={isAdded}
                  >
                    {isAdded ? 'Added' : 'Add'}
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

      <Box sx={{ mt: 1.25, px: 0.25 }}>
        <Typography variant="caption" color="text.secondary">
          Install steps: open the listing for the browser family above, then add the package to the profile.
          Extensions run inside the isolated session, so their storage stays with that profile.
        </Typography>
      </Box>
    </Box>
  );
}
