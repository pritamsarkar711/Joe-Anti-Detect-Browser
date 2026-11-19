import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AppBar, Toolbar, Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Stack, Avatar, BottomNavigation, BottomNavigationAction,
  Dialog, DialogContent, TextField, InputAdornment, Divider, useMediaQuery,
  useTheme, IconButton, Tooltip, Menu, MenuItem, Badge,
} from '@mui/material';
import { useStore, type View } from '@/state/store';
import { Icon, type IconName } from './Icons';
import { Logo, JoeMark } from './Brand';
import { Btn, IconBtn } from './Primitives';

/**
 * Information architecture
 * ------------------------
 * Four task groups instead of one flat list of seven, so every control sits
 * where a user expects it:
 *   Workspace  Profiles · Proxies · Groups
 *   Browsing   History · Extensions
 *   Quality    Fingerprints · Leak check
 *   System     Devices · Activity · Settings
 * Groups live in the sidebar as a real, clickable filter — not a decorative
 * stack icon repeated per row.
 */
const NAV: Array<{ section: string; items: Array<{ id: View; label: string; icon: IconName }> }> = [
  {
    section: 'Workspace',
    items: [
      { id: 'profiles', label: 'Profiles', icon: 'profiles' },
      { id: 'proxies', label: 'Proxies', icon: 'globe' },
    ],
  },
  {
    section: 'Browsing',
    items: [
      { id: 'history', label: 'History', icon: 'history' },
      { id: 'extensions', label: 'Extensions', icon: 'extension' },
    ],
  },
  {
    section: 'Quality',
    items: [
      { id: 'fingerprints', label: 'Fingerprints', icon: 'fingerprints' },
      { id: 'tests', label: 'Leak check', icon: 'factcheck' },
    ],
  },
  {
    section: 'System',
    items: [
      { id: 'devices', label: 'Devices', icon: 'devices' },
      { id: 'activity', label: 'Activity', icon: 'activity' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

const MOBILE_NAV: Array<{ id: View; label: string; icon: IconName }> = [
  { id: 'profiles', label: 'Profiles', icon: 'profiles' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'proxies', label: 'Proxies', icon: 'globe' },
  { id: 'tests', label: 'Check', icon: 'factcheck' },
];

const DRAWER_W = 236;

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const s = useStore();
  const activeGroup = s.groupFilter;
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of s.profiles) map.set(p.group, (map.get(p.group) ?? 0) + 1);
    return map;
  }, [s.profiles]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      <Box sx={{ px: 2, py: 1.75, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Logo size={28} />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1, py: 1.25 }}>
        {NAV.map((group) => (
          <Box key={group.section} sx={{ mb: 1.25 }}>
            <Typography variant="overline" color="text.secondary" sx={{ px: 1.25, display: 'block', mb: 0.25 }}>
              {group.section}
            </Typography>
            <List disablePadding>
              {group.items.map((n) => {
                const selected = s.view === n.id;
                return (
                  <ListItemButton
                    key={n.id} selected={selected} dense
                    onClick={() => { s.setView(n.id); onNavigate?.(); }}
                    sx={{
                      minHeight: 34, px: 1.25, mb: 0.1, color: selected ? 'primary.main' : 'text.secondary',
                      '&.Mui-selected': { bgcolor: 'rgba(216,27,96,0.09)' },
                      '&.Mui-selected:hover': { bgcolor: 'rgba(216,27,96,0.13)' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 30, color: 'inherit' }}><Icon name={n.icon} size={19} /></ListItemIcon>
                    <ListItemText primary={n.label} primaryTypographyProps={{ fontSize: '0.82rem', fontWeight: selected ? 600 : 500 }} />
                    {n.id === 'profiles' && s.profiles.length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{s.profiles.length}</Typography>
                    )}
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        ))}

        <Divider sx={{ my: 1 }} />
        <Typography variant="overline" color="text.secondary" sx={{ px: 1.25, display: 'block', mb: 0.25 }}>Groups</Typography>
        <List disablePadding>
          <ListItemButton
            dense selected={!activeGroup} onClick={() => { s.setGroupFilter(null); s.setView('profiles'); onNavigate?.(); }}
            sx={{ minHeight: 30, px: 1.25, borderRadius: 1, '&.Mui-selected': { bgcolor: 'rgba(216,27,96,0.09)', color: 'primary.main' } }}
          >
            <ListItemIcon sx={{ minWidth: 28, color: 'inherit' }}><Icon name="grid" size={16} /></ListItemIcon>
            <ListItemText primary="All profiles" primaryTypographyProps={{ fontSize: '0.78rem' }} />
            <Typography variant="caption" color="text.secondary">{s.profiles.length}</Typography>
          </ListItemButton>
          {s.groups.slice(0, 12).map((g) => (
            <ListItemButton
              key={g} dense selected={activeGroup === g}
              onClick={() => { s.setGroupFilter(g); s.setView('profiles'); onNavigate?.(); }}
              sx={{ minHeight: 30, px: 1.25, borderRadius: 1, '&.Mui-selected': { bgcolor: 'rgba(216,27,96,0.09)', color: 'primary.main' } }}
            >
              <ListItemIcon sx={{ minWidth: 28, color: 'inherit' }}><Icon name="folder" size={15} /></ListItemIcon>
              <ListItemText primary={g} primaryTypographyProps={{ fontSize: '0.78rem', noWrap: true }} />
              <Typography variant="caption" color="text.secondary">{counts.get(g) ?? 0}</Typography>
            </ListItemButton>
          ))}
        </List>
      </Box>

      <Box sx={{ px: 1.75, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main' }} />
          <Typography variant="caption" color="text.secondary">{s.nativeLabel}</Typography>
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
      ...NAV.flatMap((g) => g.items.map((n) => ({ label: n.label, hint: g.section, icon: n.icon, run: () => s.setView(n.id) }))),
      { label: 'New profile', hint: 'Create', icon: 'plus', run: () => s.setCreateOpen(true) },
      { label: 'Toggle theme', hint: 'Appearance', icon: s.settings.theme === 'dark' ? 'sun' : 'moon', run: () => s.setSetting('theme', s.settings.theme === 'dark' ? 'light' : 'dark') },
    ];
    const needle = q.trim().toLowerCase();
    return needle ? items.filter((i) => i.label.toLowerCase().includes(needle)) : items;
  }, [q, s]);
  return (
    <Dialog
      open={s.paletteOpen} onClose={() => s.setPaletteOpen(false)} maxWidth="sm" fullWidth
      PaperProps={{ sx: { alignSelf: 'flex-start', mt: { xs: '6vh', md: '12vh' }, mx: 2 } }}
    >
      <DialogContent sx={{ p: 0 }}>
        <TextField
          autoFocus fullWidth variant="standard" placeholder="Jump to a view or action"
          value={q} onChange={(e) => setQ(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Icon name="search" size={19} /></InputAdornment>,
            disableUnderline: true, sx: { px: 2, py: 1.4 },
          }}
        />
        <Divider />
        <List sx={{ p: 0.75, maxHeight: 320, overflowY: 'auto' }}>
          {results.map((r) => (
            <ListItemButton key={r.label} onClick={() => { r.run(); s.setPaletteOpen(false); setQ(''); }} sx={{ minHeight: 38 }}>
              <ListItemIcon sx={{ minWidth: 32 }}><Icon name={r.icon} size={18} /></ListItemIcon>
              <ListItemText primary={r.label} primaryTypographyProps={{ fontSize: '0.84rem' }} />
              <Typography variant="caption" color="text.secondary">{r.hint}</Typography>
            </ListItemButton>
          ))}
          {results.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>No matches.</Typography>
          )}
        </List>
      </DialogContent>
    </Dialog>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const s = useStore();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState<null | HTMLElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        s.setPaletteOpen(true);
      }
      if (e.key === 'Escape') s.setPaletteOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s]);

  useEffect(() => { if (!mobile) setDrawer(false); }, [mobile]);

  return (
    <Box sx={{ height: '100dvh', display: 'flex', overflow: 'hidden', bgcolor: 'background.default' }}>
      {!mobile && (
        <Box
          component="nav"
          sx={{ width: DRAWER_W, flex: 'none', borderRight: '1px solid', borderColor: 'divider', height: '100%' }}
        >
          <SidebarContent />
        </Box>
      )}

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <AppBar
          position="static" elevation={0} color="transparent"
          sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', flex: 'none' }}
        >
          <Toolbar variant="dense" sx={{ minHeight: { xs: 52, md: 56 }, gap: 0.5 }}>
            {mobile && (
              <IconButton edge="start" onClick={() => setDrawer(true)} aria-label="Open navigation" size="small" sx={{ mr: 0.5 }}>
                <Icon name="menu" size={22} />
              </IconButton>
            )}
            {mobile ? <JoeMark size={26} /> : <Box sx={{ flex: 1 }} />}
            {!mobile && <Box sx={{ flex: 1 }} />}
            <Tooltip title="Search (Ctrl K)" arrow>
              <IconButton size="small" onClick={() => s.setPaletteOpen(true)} aria-label="Search">
                <Icon name="search" size={20} />
              </IconButton>
            </Tooltip>
            <Tooltip title={s.settings.theme === 'dark' ? 'Light theme' : 'Dark theme'} arrow>
              <IconButton size="small" onClick={() => s.setSetting('theme', s.settings.theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
                <Icon name={s.settings.theme === 'dark' ? 'sun' : 'moon'} size={19} />
              </IconButton>
            </Tooltip>
            {!mobile && (
              <Box sx={{ ml: 0.75 }}>
                <Btn variant="primary" size="small" icon="plus" onClick={() => s.setCreateOpen(true)}>New profile</Btn>
              </Box>
            )}
            <IconButton size="small" onClick={(e) => setMenu(e.currentTarget)} aria-label="Account" sx={{ ml: 0.5 }}>
              <Avatar sx={{ width: 26, height: 26, bgcolor: 'rgba(216,27,96,0.12)', color: 'primary.main', fontSize: 12, fontWeight: 700 }}>
                {s.account?.email?.[0]?.toUpperCase() ?? 'JB'}
              </Avatar>
            </IconButton>
            <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
              <MenuItem disabled sx={{ fontSize: '0.78rem' }}>{s.account?.email ?? 'Local workspace'}</MenuItem>
              <MenuItem disabled sx={{ fontSize: '0.78rem' }}>{s.planLabel}</MenuItem>
              <Divider />
              <MenuItem onClick={() => { setMenu(null); s.setView('account'); }} sx={{ fontSize: '0.82rem' }}>Account & plan</MenuItem>
              <MenuItem onClick={() => { setMenu(null); s.setView('settings'); }} sx={{ fontSize: '0.82rem' }}>Settings</MenuItem>
              <MenuItem onClick={() => { setMenu(null); s.setView('history'); }} sx={{ fontSize: '0.82rem' }}>History</MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Single scroll container: the page body scrolls, chrome never does. */}
        <Box
          component="main"
          id="main-scroll"
          sx={{
            flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden',
            px: { xs: 1.5, sm: 2.5, lg: 3 }, py: { xs: 1.75, md: 2.25 },
            pb: { xs: mobile ? 9 : 3, md: 3 },
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Box sx={{ maxWidth: 1440, mx: 'auto', width: '100%' }}>{children}</Box>
        </Box>

        {mobile && (
          <BottomNavigation
            showLabels
            /* -1 for any view that is not one of the four bar destinations, so
               the "More" slot stays selected instead of no tab being lit. */
            value={(() => {
              const i = MOBILE_NAV.findIndex((n) => n.id === s.view);
              return i === -1 ? MOBILE_NAV.length : i;
            })()}
            onChange={(_e, i) => {
              if (i < MOBILE_NAV.length) { s.setView(MOBILE_NAV[i].id); return; }
              setDrawer(true);
            }}
            sx={{
              flex: 'none', height: 58, borderTop: '1px solid', borderColor: 'divider',
              bgcolor: 'background.paper', pb: 'env(safe-area-inset-bottom)',
            }}
          >
            {MOBILE_NAV.map((n) => (
              <BottomNavigationAction
                key={n.id} label={n.label} icon={<Icon name={n.icon} size={21} />}
                sx={{ minWidth: 0, '& .MuiBottomNavigationAction-label': { fontSize: '0.66rem' } }}
              />
            ))}
            <BottomNavigationAction
              label="More" icon={<Icon name="menu" size={21} />}
              sx={{ minWidth: 0, '& .MuiBottomNavigationAction-label': { fontSize: '0.66rem' } }}
            />
          </BottomNavigation>
        )}
      </Box>

      {mobile && (
        <Drawer open={drawer} onClose={() => setDrawer(false)} ModalProps={{ keepMounted: true }} PaperProps={{ sx: { width: DRAWER_W } }}>
          <SidebarContent onNavigate={() => setDrawer(false)} />
        </Drawer>
      )}

      <Palette />
    </Box>
  );
}
