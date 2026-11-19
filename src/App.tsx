import { StoreProvider, useStore } from '@/state/store';
import { Shell, Toasts } from '@/ui/Shell';
import { ProfilesView } from '@/ui/views/ProfilesView';
import { ProxiesView } from '@/ui/views/ProxiesView';
import { DevicesView } from '@/ui/views/DevicesView';
import { FingerprintsView } from '@/ui/views/FingerprintsView';
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
    case 'activity': return <ActivityView />;
    case 'settings': return <SettingsView />;
    default: return <ProfilesView />;
  }
}

export default function App() {
  return (
    <StoreProvider>
      <Shell><Router /></Shell>
      <CreateProfile />
      <ProfileDetail />
      <Toasts />
    </StoreProvider>
  );
}
