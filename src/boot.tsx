import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import './styles.css';

const rootEl = document.getElementById('root');
const boot = document.getElementById('joe-boot');

function fail(message: string, detail?: unknown) {
  if (!rootEl) return;
  // Never leave a silent white window: show what broke, in plain language.
  rootEl.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.setAttribute('role', 'alert');
  wrap.style.cssText =
    'max-width:520px;margin:12vh auto;padding:24px;font:14px/1.6 "IBM Plex Sans",system-ui,sans-serif;' +
    'color:#1d1f26;background:#fff;border:1px solid rgba(20,24,34,.12);border-radius:2px';
  wrap.innerHTML =
    '<strong style="display:block;font-size:16px;margin-bottom:8px">Joe Browser could not start</strong>' +
    '<span style="color:#666c7a"></span>';
  wrap.querySelector('span')!.textContent = message;
  if (detail) {
    const pre = document.createElement('pre');
    pre.style.cssText = 'margin-top:12px;padding:10px;overflow:auto;max-height:200px;font-size:11px;background:#f6f7f9';
    pre.textContent = String(detail);
    wrap.appendChild(pre);
  }
  rootEl.appendChild(wrap);
  boot?.classList.add('hidden');
}

async function bootApp() {
  try {
    if (!rootEl) throw new Error('Missing #root element');
    // Loaded lazily so any module-level crash lands in the handler below
    // instead of failing as an unhandled error on a blank page.
    const [{ default: App }, { AppErrorBoundary }] = await Promise.all([
      import('./App'),
      import('./ui/ErrorBoundary'),
    ]);
    createRoot(rootEl).render(
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>,
    );
    // Remove the boot shell once React has painted its first frame.
    requestAnimationFrame(() => requestAnimationFrame(() => boot?.classList.add('hidden')));
  } catch (error) {
    console.error('[joe] boot failed', error);
    fail(
      'The application bundle failed to load. Reinstall the app, or run the latest installer from the releases page.',
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
  }
}

void bootApp();
