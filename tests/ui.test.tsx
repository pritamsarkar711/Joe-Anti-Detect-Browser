import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from '../src/App';

const html = renderToString(<App />).replace(/<!-- -->/g, '');
const text = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('control-plane UI (headless render smoke)', () => {
  it('renders the shell without crashing', () => {
    expect(text).toContain('Joe Browser');
    expect(text).toContain('Profiles');
    expect(text).toContain('Fingerprints');
    expect(text).toContain('Settings');
    expect(text).toContain('New profile');
  });

  it('renders seeded profiles, stats and the data table', () => {
    expect(text).toContain('Storefront US');
    expect(text).toContain('Avg. consistency');
    expect(html).toContain('data-table');
    expect(text).toContain('ready');
  });

  it('shows real derived fingerprint values, not placeholders', () => {
    expect(text).toMatch(/Chrome \d{3}/);
    expect(text).toMatch(/\d{3,4}×\d{3,4}/);
    expect(text).toContain('Windows');
    expect(text).toContain('macOS');
    expect(text).toContain('Android');
  });

  it('uses the v2 MUI theme and local IBM Plex Sans family', () => {
    expect(html).toContain('IBM Plex Sans');
    expect(html).toContain('#D81B60');
    expect(html).toContain('Leak check');
  });
});
