/**
 * Built-in extension catalogue.
 *
 * Every entry is a real, well-known extension with a stable store id so the app
 * can deep-link straight to the listing instead of sending the user to a store
 * home page. Nothing is installed silently: the desktop shell downloads and
 * unpacks an extension only when the user explicitly adds it to a profile.
 *
 * `stores` lists the families where the extension really exists, because the
 * same functionality often has a different id per store.
 */
export type BrowserFamily = 'chrome' | 'edge' | 'firefox' | 'brave' | 'joe';

export interface CatalogExtension {
  id: string;
  name: string;
  publisher: string;
  category: 'Privacy' | 'Automation' | 'Developer' | 'Productivity' | 'Security';
  description: string;
  /** Crx / Edge id (32 chars) when published on the Chromium stores. */
  chromiumId?: string;
  firefoxSlug?: string;
  /**
   * Brand mark id used for the card avatar (see src/ui/Brand.tsx). Optional:
   * unknown marks fall back to the generic extension glyph.
   */
  mark?: string;
  /** Recommended = pre-selected in the create-profile wizard. */
  recommended?: boolean;
  /** Safe to auto-install on new profiles for users who opt in. */
  autoInstall?: boolean;
}

export const EXTENSION_CATALOG: CatalogExtension[] = [
  {
    id: 'ublock-origin',
    mark: 'ublock',
    name: 'uBlock Origin',
    publisher: 'Raymond Hill',
    category: 'Privacy',
    description: 'Wide-spectrum content blocker. Low CPU, no telemetry.',
    chromiumId: 'cjpalhdlnbpafiamejdnhcphjbkeiagm',
    firefoxSlug: 'ublock-origin',
    recommended: true,
  },
  {
    id: 'bitwarden',
    mark: 'bitwarden',
    name: 'Bitwarden',
    publisher: 'Bitwarden Inc.',
    category: 'Security',
    description: 'Open-source password manager with per-profile vaults.',
    chromiumId: 'nngceckbapebfimnlniiiahkandclblb',
    firefoxSlug: 'bitwarden-password-manager',
    recommended: true,
  },
  {
    id: 'clearurls',
    name: 'ClearURLs',
    publisher: 'Kevin R.',
    category: 'Privacy',
    description: 'Strips tracking parameters from links before they load.',
    chromiumId: 'lckanjgmijmafbedllaakclkaicjfmnk',
    firefoxSlug: 'clearurls',
    recommended: true,
  },
  {
    id: 'canvas-blocker',
    mark: 'firefox',
    name: 'Canvas Blocker',
    publisher: 'kkapsner',
    category: 'Privacy',
    description: 'Firefox-only canvas/audio protection. Useful for comparing engines.',
    firefoxSlug: 'canvasblocker',
  },
  {
    id: 'json-viewer',
    mark: 'json',
    name: 'JSON Viewer',
    publisher: 'tulios',
    category: 'Developer',
    description: 'Pretty-prints JSON responses for API checks.',
    chromiumId: 'gmegofaIokndKeajHipGnhjkMiHnAoab',
  },
  {
    id: 'lighthouse',
    mark: 'lighthouse',
    name: 'Lighthouse',
    publisher: 'Google',
    category: 'Developer',
    description: 'Performance, accessibility and SEO audits.',
    chromiumId: 'blipmdconlkpinefehnmjammfjpmpbjk',
  },
  {
    id: 'react-devtools',
    mark: 'react',
    name: 'React Developer Tools',
    publisher: 'Meta',
    category: 'Developer',
    description: 'Inspect component trees while testing your own apps.',
    chromiumId: 'fmkadmapgofadopljbjfkapdkoienihi',
    firefoxSlug: 'react-devtools',
  },
  {
    id: 'wappalyzer',
    mark: 'wappalyzer',
    name: 'Wappalyzer',
    publisher: 'Wappalyzer',
    category: 'Developer',
    description: 'Detects the stack behind a site — handy for ad verification.',
    chromiumId: 'gppongmhjkpfnbhagpmjfkannfbllamg',
    firefoxSlug: 'wappalyzer',
  },
  {
    id: 'singlefile',
    mark: 'singlefile',
    name: 'SingleFile',
    publisher: 'Gildas Lormeau',
    category: 'Productivity',
    description: 'Saves a complete page as one HTML file for evidence.',
    chromiumId: 'mpiodijhokgodhhofbcjdecpffjipkle',
    firefoxSlug: 'single-file',
  },
  {
    id: 'darkreader',
    mark: 'darkreader',
    name: 'Dark Reader',
    publisher: 'Dark Reader Ltd.',
    category: 'Productivity',
    description: 'Dark mode for any site, independent of the app theme.',
    chromiumId: 'eimadpbcbfnmbkopoojfekhnkhdbieeh',
    firefoxSlug: 'darkreader',
  },
  {
    id: 'cookie-editor',
    mark: 'cookieeditor',
    name: 'Cookie-Editor',
    publisher: 'Moustachauve',
    category: 'Automation',
    description: 'Inspect and export cookies per profile. Pairs with cookie import.',
    chromiumId: 'hlkenndednhfkekhgcdicdfddnkalmdm',
    firefoxSlug: 'cookie-editor',
  },
  {
    id: 'requestly',
    mark: 'requestly',
    name: 'Requestly',
    publisher: 'Requestly',
    category: 'Developer',
    description: 'Rewrite, redirect and mock requests while testing.',
    chromiumId: 'mdnleldcmiljblolnjhpnblkcekpdkpa',
  },
];

export interface StoreLinks {
  chrome: string;
  edge: string;
  firefox: string;
  brave: string;
  joe: string;
}

/**
 * Deep link to the listing for one extension in a given store.
 * `joe` maps to the in-app catalogue so the custom shell never needs a store.
 */
export function storeLink(ext: CatalogExtension, family: BrowserFamily): string {
  const edgeCompatible = ['chrome', 'edge', 'brave', 'joe'].includes(family);
  if (family === 'firefox') {
    return ext.firefoxSlug
      ? `https://addons.mozilla.org/firefox/addon/${ext.firefoxSlug}/`
      : `https://addons.mozilla.org/firefox/search/?q=${encodeURIComponent(ext.name)}`;
  }
  if (family === 'edge' && ext.chromiumId) {
    return `https://microsoftedge.microsoft.com/addons/detail/${ext.chromiumId}`;
  }
  if (ext.chromiumId) {
    return `https://chromewebstore.google.com/detail/${ext.chromiumId}`;
  }
  // Fall back to a search page rather than a dead listing.
  const store = family === 'edge' ? 'https://microsoftedge.microsoft.com/addons/search/' : 'https://chromewebstore.google.com/search/';
  return `${store}${encodeURIComponent(ext.name)}${edgeCompatible ? '' : ''}`;
}

export const FAMILY_LABEL: Record<BrowserFamily, string> = {
  chrome: 'Google Chrome',
  edge: 'Microsoft Edge',
  firefox: 'Mozilla Firefox',
  brave: 'Brave',
  joe: 'Joe Browser',
};
