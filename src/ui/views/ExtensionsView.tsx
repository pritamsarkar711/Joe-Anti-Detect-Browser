import { useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Paper, TextField, InputAdornment, Divider, Chip, ToggleButton,
  ToggleButtonGroup, Select, MenuItem,
} from '@mui/material';
import { EXTENSION_CATALOG, storeLink, FAMILY_LABEL, type BrowserFamily, type CatalogExtension } from '@joe/core';
import { useStore } from '@/state/store';
import { nativeExtensions, nativeCanInstallExtensions, type InstalledExtension } from '@/state/native';
import { Icon } from '../Icons';
import { Official } from '../Brand';
import { ExtensionLogo } from '../ExtensionLogo';
import { Btn, Field, Modal, PageHead, Tag } from '../Primitives';

const FAMILIES: Array<{ id: BrowserFamily; mark: string; label: string }> = [
  { id: 'chrome', mark: 'chrome', label: 'Chrome' },
  { id: 'edge', mark: 'edge', label: 'Edge' },
  { id: 'firefox', mark: 'firefox', label: 'Firefox' },
  { id: 'brave', mark: 'brave', label: 'Brave' },
  { id: 'chromium', mark: 'chromium', label: 'Chromium' },
];

const CATEGORIES = ['All', 'Privacy', 'Security', 'Developer', 'Automation', 'Productivity'] as const;

export function ExtensionsView() {
  const s = useStore();
  const [q, setQ] = useState('');
  const [family, setFamily] = useState<BrowserFamily>('chrome');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [targetProfileId, setTargetProfileId] = useState<string>(s.profiles[0]?.id ?? '');
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [installed, setInstalled] = useState<InstalledExtension[]>([]);
  const [installTarget, setInstallTarget] = useState<CatalogExtension | null>(null);
  const [zipPath, setZipPath] = useState('');
  const [installing, setInstalling] = useState(false);
  const canInstall = nativeCanInstallExtensions();

  const targetProfile = s.profiles.find((p) => p.id === targetProfileId) ?? s.profiles[0];

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
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            {targetProfile && (
              <Select
                size="small"
                value={targetProfile.id}
                onChange={(e) => setTargetProfileId(e.target.value)}
                sx={{ minWidth: 160, fontSize: '0.78rem' }}
              >
                {s.profiles.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              </Select>
            )}
            <Btn icon="open" href={familyStoreUrl} target="_blank" rel="noreferrer">
              {FAMILY_LABEL[family]} store
            </Btn>
          </Stack>
        }
      />

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', p: 1.25 }}>
          <TextField
            size="small" placeholder="Search extensions" value={q} onChange={(e) => setQ(e.target.value)}
            sx={{ flex: { xs: '1 1 100%', sm: '1 1 200px' }, maxWidth: { sm: 260 } }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="search" size={18} /></InputAdornment> }}
          />
          <ToggleButtonGroup
            exclusive size="small" value={family} onChange={(_e, v) => v && setFamily(v)}
            sx={{ flexWrap: 'wrap', '& .MuiToggleButton-root': { px: 1.1, py: 0.45, gap: 0.6, fontSize: '0.74rem' } }}
          >
            {FAMILIES.map((f) => (
              <ToggleButton key={f.id} value={f.id} aria-label={f.label}>
                <Official name={f.mark} size={14} />
                <Box component="span" sx={{ ml: 0.4 }}>{f.label}</Box>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Box sx={{ flex: 1, display: { xs: 'none', lg: 'block' } }} />
          <ToggleButtonGroup
            exclusive size="small" value={category} onChange={(_e, v) => v && setCategory(v)}
            sx={{ flexWrap: 'wrap', '& .MuiToggleButton-root': { px: 0.9, py: 0.4, fontSize: '0.72rem' } }}
          >
            {CATEGORIES.map((c) => <ToggleButton key={c} value={c}>{c}</ToggleButton>)}
          </ToggleButtonGroup>
        </Box>
        <Divider />

        <Box sx={{ p: { xs: 1.25, md: 1.75 }, display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
          {rows.map((ext) => {
            const isAdded = added.has(ext.id);
            const attached = !!targetProfile?.extensions.includes(ext.id);
            const listingUrl = storeLink(ext, family);
            return (
              <Paper key={ext.id} variant="outlined" sx={{ p: 1.35, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Stack direction="row" alignItems="center" spacing={1.1}>
                  <ExtensionLogo mark={ext.mark} size={30} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography noWrap sx={{ fontWeight: 600, fontSize: '0.84rem' }}>{ext.name}</Typography>
                    <Typography noWrap variant="caption" color="text.secondary">
                      {ext.publisher}{ext.rating ? ` · ${ext.rating.toFixed(1)}★` : ''}{ext.users ? ` · ${ext.users}` : ''}
                    </Typography>
                  </Box>
                  {ext.defaultForChromium ? <Tag tone="primary">Default</Tag> : <Chip label={ext.category} size="small" sx={{ height: 19, fontSize: '0.62rem' }} />}
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ minHeight: 28 }}>
                  {ext.description}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 'auto', pt: 0.25 }}>
                  {targetProfile && (
                    <Btn
                      size="small"
                      variant={attached ? 'subtle' : 'primary'}
                      icon={attached ? 'close' : 'plus'}
                      aria-label={attached ? `Remove ${ext.name}` : `Add ${ext.name}`}
                      onClick={() => {
                        s.toggleProfileExtension(targetProfile.id, ext.id);
                        s.toast(attached ? `Removed from ${targetProfile.name}` : `Added to ${targetProfile.name}`, attached ? 'info' : 'ok');
                      }}
                    >
                      {attached ? 'Remove' : 'Add'}
                    </Btn>
                  )}
                  {canInstall && (
                    <Btn
                      size="small" variant="ghost"
                      icon={isAdded ? 'check' : 'download'}
                      onClick={() => { setInstallTarget(ext); setZipPath(''); }}
                      disabled={isAdded}
                    >
                      {isAdded ? 'Unpacked' : 'Install'}
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
              <Typography variant="body2" color="text.secondary">No matching extensions.</Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {installed.length > 0 && (
        <Paper variant="outlined" sx={{ mt: 1.5, p: 1.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Installed on device</Typography>
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
        actions={(
          <>
            <Btn onClick={() => setInstallTarget(null)} disabled={installing}>Cancel</Btn>
            <Btn variant="primary" icon="plus" onClick={() => { void submitInstall(); }} disabled={!zipPath.trim() || installing}>
              {installing ? 'Installing…' : 'Install'}
            </Btn>
          </>
        )}
      >
        <Field label="Extension archive (.zip)" value={zipPath} onChange={setZipPath} placeholder="C:\Downloads\extension.zip" />
      </Modal>
    </Box>
  );
}
