import { useMemo } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { StoreProvider, useStore } from '@/state/store';
import { Shell } from '@/ui/Shell';
import { makeTheme } from './theme';
import { Toasts } from '@/ui/Primitives';
import { ProfilesView } from '@/ui/views/ProfilesView';
import { ProxiesView } from '@/ui/views/ProxiesView';
import { DevicesView } from '@/ui/views/DevicesView';
import { FingerprintsView } from '@/ui/views/FingerprintsView';
import { TestsView } from '@/ui/views/TestsView';
import { ActivityView } from '@/ui/views/ActivityView';
import { SettingsView } from '@/ui/views/SettingsView';
import { CreateProfile } from '@/ui/views/CreateProfile';
import { ProfileDetail } from '@/ui/views/ProfileDetail';

function Router() {
  const s = useStore();
  switch (s.view) {
    case 'proxies': return <ProxiesView />;
    case 'devices': return <DevicesView />;
    case 'fingerprints': return <FingerprintsView />;
    case 'tests': return <TestsView />;
    case 'activity': return <ActivityView />;
    case 'settings': return <SettingsView />;
    default: return <ProfilesView />;
  }
}

function ThemedApp() {
  const s = useStore();
  const theme = useMemo(() => makeTheme(s.settings.theme), [s.settings.theme]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Shell><Router /></Shell>
      <CreateProfile />
      <ProfileDetail />
      <Toasts />
    </ThemeProvider>
  );
}

export default function App() {
  return <StoreProvider><ThemedApp /></StoreProvider>;
}
