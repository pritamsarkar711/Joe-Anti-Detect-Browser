import { useRef, useState } from 'react';
import { useStore } from '@/state/store';
import { downloadFile } from '@joe/core';
import { Icon } from '@/ui/Icons';
import { Button, Badge, Toggle, Field, Segmented, Stat } from '@/ui/Primitives';

export function SettingsView() {
  const s = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const exportAll = () => { downloadFile('joe-browser-workspace.json', JSON.stringify(s.exportData(), null, 2)); s.toast('Workspace exported'); };
  const onFile = async (file: File) => {
    try { const n = s.importData(await file.text()); s.toast(`${n} profiles imported`); }
    catch (e) { s.toast((e as Error).message, 'err'); }
  };

  return (
    <div className="view">
      <div className="stat-row">
        <Stat label="Profiles" value={s.profiles.length} icon="layers" />
        <Stat label="Storage" value="local" icon="shield" tone="teal" />
        <Stat label="Sync" value={s.settings.autoSync ? 'on' : 'off'} icon="refresh" tone="blue" />
        <Stat label="Build" value={`v${s.appVersion}`} icon="cpu" tone="amber" />
      </div>

      <div className="settings-grid">
        <div className="panel settings-card">
          <div className="panel-head"><div className="panel-title"><Icon name="sliders" size={17} /><h2>Appearance</h2></div></div>
          <div className="setting-row"><div><strong>Theme</strong><span>Dark or light workspace</span></div><Segmented value={s.settings.theme} onChange={(v) => s.setSetting('theme', v)} options={[{ value: 'dark', label: 'Dark', icon: 'moon' }, { value: 'light', label: 'Light', icon: 'sun' }]} /></div>
          <div className="setting-row"><div><strong>Table density</strong><span>Row height in the profile table</span></div><Segmented value={s.settings.density} onChange={(v) => s.setSetting('density', v)} options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} /></div>
          <div className="setting-row"><div><strong>Default device</strong><span>Where profiles launch from this UI</span></div><select className="input compact" value={s.settings.defaultDevice} onChange={(e) => s.setSetting('defaultDevice', e.target.value as 'desktop-exe' | 'android-apk')}><option value="desktop-exe">Desktop EXE</option><option value="android-apk">Android APK</option></select></div>
        </div>

        <div className="panel settings-card">
          <div className="panel-head"><div className="panel-title"><Icon name="link" size={17} /><h2>Supabase sync</h2></div><Badge tone="ok" dot>connected</Badge></div>
          <Field label="Project URL"><input className="input" value={s.settings.supabaseUrl} onChange={(e) => s.setSetting('supabaseUrl', e.target.value)} /></Field>
          <Field label="Anon / publishable key" hint="Never store service-role keys in a client app"><input className="input" type="password" value={s.settings.anonKey} onChange={(e) => s.setSetting('anonKey', e.target.value)} placeholder="eyJ…" /></Field>
          <Field label="Workspace"><input className="input" value={s.settings.workspace} onChange={(e) => s.setSetting('workspace', e.target.value)} /></Field>
          <div className="setting-row"><div><strong>Auto sync</strong><span>Realtime channel joe-sync</span></div><Toggle checked={s.settings.autoSync} onChange={(v) => s.setSetting('autoSync', v)} label="Auto sync" /></div>
        </div>

        <div className="panel settings-card">
          <div className="panel-head"><div className="panel-title"><Icon name="shield" size={17} /><h2>Data</h2></div></div>
          <p className="card-hint">Profiles are stored locally in your browser. Export a workspace file to move them between the desktop app, Android app and this control plane.</p>
          <div className="button-row wrap">
            <Button icon="download" onClick={exportAll}>Export workspace</Button>
            <Button icon="upload" onClick={() => fileRef.current?.click()}>Import workspace</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }} />
            {confirmReset ? <Button icon="refresh" variant="danger" onClick={() => { s.reset(); setConfirmReset(false); }}>Confirm reset</Button> : <Button icon="trash" variant="ghost" onClick={() => setConfirmReset(true)}>Restore demo data</Button>}
          </div>
        </div>

        <div className="panel settings-card">
          <div className="panel-head"><div className="panel-title"><Icon name="info" size={17} /><h2>About & scope</h2></div></div>
          <div className="about-row"><span>Version</span><strong>v{s.appVersion}</strong></div>
          <div className="about-row"><span>Desktop</span><strong>Electron · Windows x64</strong></div>
          <div className="about-row"><span>Android</span><strong>WebView shell · minSdk 28</strong></div>
          <div className="about-row"><span>License</span><strong>MIT</strong></div>
          <div className="notice"><Icon name="shield" size={15} /><span>Built for legitimate privacy, QA and account-separation work. Profile isolation removes linkability between your own sessions; it is not a guarantee of invisibility to any detection system. No telemetry is collected.</span></div>
        </div>
      </div>
    </div>
  );
}
