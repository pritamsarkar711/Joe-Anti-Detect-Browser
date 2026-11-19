import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AppBar, Toolbar, Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Stack, Badge, Avatar, BottomNavigation, BottomNavigationAction,
  Dialog, DialogContent, TextField, InputAdornment, Divider, Chip, useMediaQuery,
  useTheme, IconButton, Tooltip,
} from '@mui/material';
import { useStore, type View } from '@/state/store';
import { Icon, type IconName } from './Icons';
import { Logo } from './Brand';
import { Btn } from './Primitives';

const NAV: Array<{ id: View; label: string; icon: IconName }> = [
  { id: 'profiles', label: 'Profiles', icon: 'layers' },
  { id: 'proxies', label: 'Proxies', icon: 'globe' },
  { id: 'devices', label: 'Devices', icon: 'devices' },
  { id: 'fingerprints', label: 'Fingerprints', icon: 'fingerprints' },
  { id: 'tests', label: 'Leak check', icon: 'factcheck' },
  { id: 'activity', label: 'Activity', icon: 'activity' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const MOBILE_NAV: View[] = ['profiles', 'proxies', 'devices', 'fingerprints'];
const DRAWER_W = 232;

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const s = useStore();
  const [groupsOpen, setGroupsOpen] = useState(true);
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 2.5, py: 2.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Logo size={30} />
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.25, py: 1.5 }}>
        <Typography variant="overline" color="text.secondary" sx={{ px: 1.5, display: 'block', mb: 0.6 }}>Workspace</Typography>
        <List disablePadding>
          {NAV.map((n) => (
            <ListItemButton
              key={n.id} selected={s.view === n.id}
              onClick={() => { s.setView(n.id); onNavigate?.(); }}
              sx={{ mb: 0.35, '&.Mui-selected': { bgcolor: 'rgba(216,27,96,0.10)', color: 'primary.main' } }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}><Icon name={n.icon} size={22} /></ListItemIcon>
              <ListItemText primary={n.label} primaryTypographyProps={{ fontSize: '0.84rem', fontWeight: s.view === n.id ? 600 : 500 }} />
              {n.id === 'profiles' && <Chip label={s.profiles.length} size="small" sx={{ height: 19, fontSize: '0.66rem' }} />}
              {n.id === 'proxies' && <Chip label={s.proxies.length} size="small" sx={{ height: 19, fontSize: '0.66rem' }} />}
            </ListItemButton>
          ))}
        </List>

        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, mt: 2.5, mb: 0.5 }}>
          <Typography variant="overline" color="text.secondary">Groups</Typography>
          <Tooltip title="Toggle groups"><span>
            <IconButton size="small" onClick={() => setGroupsOpen((v) => !v)}>
              <Icon name={groupsOpen ? 'chevronDown' : 'chevronRight'} size={18} />
            </IconButton>
          </span></Tooltip>
        </Stack>
        {groupsOpen && (
          <List disablePadding>
            {s.groups.slice(0, 9).map((g) => (
              <ListItemButton key={g} sx={{ mb: 0.2, py: 0.45 }} onClick={() => { s.setView('profiles'); onNavigate?.(); }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: g === 'Default' ? 'primary.main' : 'text.disabled', mr: 1.5, flex: 'none' }} />
                <ListItemText primary={g} primaryTypographyProps={{ fontSize: '0.79rem' }} />
                <Typography variant="caption" color="text.secondary">{s.profiles.filter((p) => p.group === g).length}</Typography>
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
      <Box sx={{ px: 2.25, py: 1.6, borderTop: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />
          <Typography variant="caption" color="text.secondary">Sync active</Typography>
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary">v{s.appVersion}</Typography>
        </Stack>
      </Box>
    </Box>
  );
}

function Palette() {
  const s = useStore();
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const items: Array<{ label: string; hint: string; icon: IconName; run: () => void }> = [
      ...NAV.map((n) => ({ label: n.label, hint: 'Go to', icon: n.icon, run: () => s.setView(n.id) })),
      { label: 'New profile', hint: 'Create', icon: 'plus', run: () => s.setCreateOpen(true) },
      { label: 'Toggle theme', hint: 'Appearance', icon: s.settings.theme === 'dark' ? 'sun' : 'moon', run: () => s.setSetting('theme', s.settings.theme === 'dark' ? 'light' : 'dark') },
      { label: 'Export workspace', hint: 'Data', icon: 'download', run: () => { const d = s.exportData(); void d; s.toast('Workspace exported'); } },
    ];
    const needle = q.trim().toLowerCase();
    return needle ? items.filter((i) => i.label.toLowerCase().includes(needle)) : items;
  }, [q, s]);
  return (
    <Dialog open={s.paletteOpen} onClose={() => s.setPaletteOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { alignSelf: 'flex-start', mt: '10vh' } }}>
      <DialogContent sx={{ p: 0 }}>
        <TextField
          autoFocus fullWidth variant="standard" placeholder="Search profiles and actions"
          value={q} onChange={(e) => setQ(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Icon name="search" size={22} /></InputAdornment>, disableUnderline: true, sx: { px: 2, py: 1.5 } }}
        />
        <Divider />
        <List sx={{ p: 1, maxHeight: 340, overflowY: 'auto' }}>
          {results.map((r) => (
            <ListItemButton key={r.label} onClick={() => { r.run(); s.setPaletteOpen(false); setQ(''); }} sx={{ borderRadius: 1 }}>
              <ListItemIcon sx={{ minWidth: 38 }}><Icon name={r.icon} size={21} /></ListItemIcon>
              <ListItemText primary={r.label} primaryTypographyProps={{ fontSize: '0.86rem' }} />
              <Typography variant="caption" color="text.secondary">{r.hint}</Typography>
            </ListItemButton>
          ))}
        </List>
        <Box sx={{ px: 2, py: 1.2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">Enter to open · Esc to close</Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const s = useStore();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); s.setPaletteOpen(true);
      }
      if (e.key === 'Escape') { s.setPaletteOpen(false); setDrawer(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s]);

  const bottomValue = MOBILE_NAV.includes(s.view) ? s.view : 'profiles';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" color="inherit" sx={{ borderBottom: '1px solid', borderColor: 'divider', zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1, minHeight: { xs: 56, md: 62 }, px: { xs: 1, md: 2 } }}>
          {mobile && (
            <IconButton aria-label="Open navigation" onClick={() => setDrawer(true)} sx={{ mr: 0.25 }}>
              <Icon name="menu" size={24} />
            </IconButton>
          )}
          {!mobile && <Box sx={{ width: DRAWER_W - 16, flex: 'none' }} />}
          {mobile && <Logo size={26} compact />}

          <Box sx={{ flex: 1 }} />
          <Tooltip title="Search (Ctrl K)"><span>
            <IconButton aria-label="Search" onClick={() => s.setPaletteOpen(true)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.2, mr: 0.5 }}>
              <Icon name="search" size={21} />
            </IconButton>
          </span></Tooltip>
          <Tooltip title="Sync status"><span>
            <IconButton aria-label="Sync status" onClick={() => s.setView('devices')} size="small">
              <Badge color="primary" variant="dot" invisible={!s.settings.autoSync}><Icon name="sync" size={21} /></Badge>
            </IconButton>
          </span></Tooltip>
          <Tooltip title="Toggle theme"><span>
            <IconButton aria-label="Toggle theme" onClick={() => s.setSetting('theme', s.settings.theme === 'dark' ? 'light' : 'dark')} size="small">
              <Icon name={s.settings.theme === 'dark' ? 'sun' : 'moon'} size={21} />
            </IconButton>
          </span></Tooltip>
          <Btn variant="primary" icon="plus" size="small" onClick={() => s.setCreateOpen(true)}>New profile</Btn>
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 12, fontWeight: 700, ml: 0.5, display: { xs: 'none', sm: 'flex' } }}>JB</Avatar>
        </Toolbar>
      </AppBar>

      {!mobile && (
        <Drawer variant="permanent" sx={{ width: DRAWER_W, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_W, boxSizing: 'border-box', borderRight: '1px solid', borderColor: 'divider' } }}>
          <Toolbar sx={{ minHeight: 62 }} />
          <SidebarContent />
        </Drawer>
      )}
      {mobile && (
        <Drawer open={drawer} onClose={() => setDrawer(false)} PaperProps={{ sx: { width: 280 } }}>
          <SidebarContent onNavigate={() => setDrawer(false)} />
        </Drawer>
      )}

      <Box component="main" sx={{
        ml: { md: `${DRAWER_W}px` }, pt: { xs: '56px', md: '62px' },
        px: { xs: 1.5, sm: 2.5, md: 3 }, pb: { xs: 10, md: 4 },
        maxWidth: '100%', minWidth: 0, overflowX: 'hidden',
      }}>
        <Box sx={{ maxWidth: 1480, mx: 'auto', py: { xs: 2, md: 3 }, minWidth: 0, overflowX: 'hidden' }}>{children}</Box>
      </Box>

      {mobile && (
        <BottomNavigation
          value={bottomValue} showLabels
          onChange={(_, v) => {
            if (v === 'more') setDrawer(true);
            else s.setView(v as View);
          }}
          sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: (t) => t.zIndex.appBar - 1, bgcolor: 'background.paper' }}
        >
          {MOBILE_NAV.map((v) => {
            const n = NAV.find((x) => x.id === v)!;
            return <BottomNavigationAction key={v} value={v} label={n.label} icon={<Icon name={n.icon} size={22} />} />;
          })}
          <BottomNavigationAction value="more" label="More" icon={<Icon name="more" size={22} />} />
        </BottomNavigation>
      )}

      <Palette />
    </Box>
  );
}
