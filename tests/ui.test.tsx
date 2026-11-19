import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from '../src/App';

const html = renderToString(<App />).replace(/<!-- -->/g, '');

describe('control-plane UI (headless render smoke)', () => {
  it('renders the shell without crashing', () => {
    expect(html).toContain('Joe Browser');
    expect(html).toContain('Profiles');
    expect(html).toContain('Fingerprints');
    expect(html).toContain('Settings');
    expect(html).toContain('New profile');
  });

  it('renders seeded profiles, stats and the data table', () => {
    expect(html).toContain('Storefront · US');
    expect(html).toContain('Avg. consistency');
    expect(html).toContain('data-table');
    expect(html).toContain('ready');
  });

  it('shows real derived fingerprint values, not placeholders', () => {
    expect(html).toContain('Windows 11 · Intel');
    expect(html).toContain('Chrome 131');
    expect(html).toMatch(/\d{3,4}×\d{3,4}/);
  });
});
