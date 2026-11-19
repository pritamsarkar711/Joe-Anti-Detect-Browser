import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from './App';

/**
 * Headless UI smoke test. There is no Chrome/X server in this sandbox, so we
 * server-render the React tree to catch render-time crashes and verify the
 * control plane shows the seeded profiles and the three peer cards.
 */
describe('control plane UI', () => {
  // React SSR separates adjacent text nodes with <!-- --> markers; strip them
  // so assertions see the same contiguous text a browser would render.
  const html = renderToString(<App />).replace(/<!-- -->/g, '');

  it('renders without throwing and shows the product shell', () => {
    expect(html).toContain('Joe Browser');
    expect(html).toContain('Profiles');
    expect(html).toContain('Fingerprint spec');
    expect(html).toContain('Realtime event log');
  });

  it('renders all seeded profiles and both native peers', () => {
    expect(html).toContain('QA · Account A');
    expect(html).toContain('QA · Account B');
    expect(html).toContain('Mobile · Smoke');
    expect(html).toContain('Staging · EU');
    expect(html).toContain('Desktop · EXE');
    expect(html).toContain('Android · APK');
  });

  it('renders a deterministic fingerprint spec, not a placeholder', () => {
    expect(html).toContain('Noise seed');
    expect(html).toMatch(/0x[0-9a-f]{6,8}/);
    expect(html).toContain('Mozilla/5.0');
  });
});
