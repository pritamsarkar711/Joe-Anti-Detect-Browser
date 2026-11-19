import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import './styles.css';

const rootEl = document.getElementById('root');
const boot = document.getElementById('joe-boot');

function Ready() {
  useEffect(() => { boot?.classList.add('hidden'); }, []);
  return null;
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
      <>
        <Ready />
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </>,
    );
  } catch {
    console.error('[joe] startup.bundle_failed');
    const message = boot?.querySelector('span');
    if (message) message.textContent = 'The workspace could not load. Retry, or reinstall if the problem persists.';
    const retry = boot?.querySelector('button');
    if (retry) retry.hidden = false;
  }
}

void bootApp();
