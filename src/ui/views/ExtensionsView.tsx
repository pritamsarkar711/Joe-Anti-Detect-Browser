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
import { Btn, Field, Modal, PageHead } from '../Primitives';

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
  const [installTarget, setInstallTarget] = useState<CatalogExtension | null>(null);
  const [zipPath, setZipPath] = useState('');
  const [installing, setInstalling] = useState(false);
  const canInstall = nativeCanInstallExtensions();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return EXTENSION_CATALOG.filter((e) => (
      (!needle || `${e.name} ${e.publisher} ${e.description}`.toLowerCase().includes(needle))
      && (category === 'All' || e.category === category)
    ));
  }, [q, category]);

  const familyStoreUrl = family === 'firefox'
    ? 'https://addons.mozilla.org/firefox/'
    : family === 'edge'
      ? 'https://microsoftedge.microsoft.com/addons/'
      : 'https://chromewebstore.google.com/';

  const submitInstall = async () => {
    const bridge = nativeExtensions();
    if (!bridge || !installTarget || !zipPath.trim()) return;
    setInstalling(true);
    try {
      const ext = await bridge.install(zipPath.trim(), installTarget.id);
      setInstalled((prev) => [...prev.filter((e) => e.dir !== ext.dir), ext]);
      setAdded((prev) => new Set(prev).add(installTarget.id));
      s.toast(`${ext.name} ${ext.version} installed`);
      setInstallTarget(null);
      setZipPath('');
    } catch (e) {
      s.toast(String((e as Error).message || 'Install failed'), 'err');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Box>
      <PageHead
        title="Extensions"
        hint="Attach extensions to profiles or open browser store listings."
        action={(
          <Btn icon="open" href={familyStoreUrl} target="_blank" rel="noreferrer">
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
            const listingUrl = storeLink(ext, family);
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
                  {canInstall ? (
                    <Btn
                      size="small" variant={isAdded ? 'ghost' : 'primary'}
                      icon={isAdded ? 'check' : 'plus'}
                      onClick={() => { setInstallTarget(ext); setZipPath(''); }}
                      disabled={isAdded}
                    >
                      {isAdded ? 'Installed' : 'Install'}
                    </Btn>
                  ) : (
                    <Btn
                      size="small" variant="primary" icon="open"
                      href={listingUrl} target="_blank" rel="noreferrer"
                      onClick={() => s.toast(`Opening ${ext.name} in ${FAMILY_LABEL[family]} store`, 'info')}
                    >
                      Get
                    </Btn>
                  )}
                  <Box sx={{ flex: 1 }} />
                  <Btn size="small" icon="open" href={listingUrl} target="_blank" rel="noreferrer">Store</Btn>
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

      <Modal
        open={!!installTarget}
        onClose={() => { if (!installing) setInstallTarget(null); }}
        title={installTarget ? `Install ${installTarget.name}` : 'Install extension'}
        subtitle="Provide a verified unpacked .zip archive path for the desktop shell."
        actions={(
          <>
            <Btn onClick={() => setInstallTarget(null)} disabled={installing}>Cancel</Btn>
            <Btn variant="primary" icon="plus" onClick={() => { void submitInstall(); }} disabled={!zipPath.trim() || installing}>
              {installing ? 'Installing…' : 'Install package'}
            </Btn>
          </>
        )}
      >
        <Field
          label="Extension archive (.zip)"
          value={zipPath}
          onChange={setZipPath}
          placeholder="C:\\Downloads\\extension.zip"
        />
      </Modal>
    </Box>
  );
}
