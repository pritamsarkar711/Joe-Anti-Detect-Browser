/**
 * Built-in extension catalogue with Chrome/Edge/Brave/Firefox store bindings
 * and default starter extensions for Chromium-family profiles.
 */
export type BrowserFamily = 'chrome' | 'edge' | 'firefox' | 'brave' | 'chromium' | 'joe';

export interface CatalogExtension {
  id: string;
  name: string;
  publisher: string;
  category: 'Privacy' | 'Automation' | 'Developer' | 'Productivity' | 'Security';
  description: string;
  rating?: number;
  users?: string;
  /** Crx / Edge id (32 chars) when published on Chromium stores. */
  chromiumId?: string;
  firefoxSlug?: string;
  /** Brand/extension mark id (see src/ui/ExtensionLogo.tsx). */
  mark: string;
  /** Default = auto-attached to new Chrome, Chromium, Brave & Joe profiles. */
  defaultForChromium?: boolean;
  recommended?: boolean;
  autoInstall?: boolean;
}

export const DEFAULT_PROFILE_EXTENSION_IDS = ['http-tracker', 'absolute-right-click'] as const;

export function defaultExtensionsForFamily(family: BrowserFamily): string[] {
  if (family === 'chrome' || family === 'chromium' || family === 'brave' || family === 'joe') {
    return [...DEFAULT_PROFILE_EXTENSION_IDS];
  }
  return [];
}

export const EXTENSION_CATALOG: CatalogExtension[] = [
  {
    id: 'http-tracker',
    mark: 'httptracker',
    name: 'HTTP Tracker',
    publisher: 'Venu Madhav',
    category: 'Developer',
    description: 'Inspect HTTP requests, headers and redirects per tab.',
    rating: 4.5,
    users: '40K+',
    chromiumId: 'fklakbbaaknbgcedidhblbnhclijnhbi',
    defaultForChromium: true,
    recommended: true,
    autoInstall: true,
  },
  {
    id: 'absolute-right-click',
    mark: 'rightclick',
    name: 'Absolute Enable Right Click & Copy',
    publisher: 'Absolute',
    category: 'Productivity',
    description: 'Re-enables right-click context menus and text selection.',
    rating: 4.6,
    users: '1M+',
    chromiumId: 'jdocbkpgdakpekjlhemmfcncgdjeiika',
    firefoxSlug: 'absolute-enable-right-click',
    defaultForChromium: true,
    recommended: true,
    autoInstall: true,
  },
  {
    id: 'ublock-origin',
    mark: 'ublock',
    name: 'uBlock Origin',
    publisher: 'Raymond Hill',
    category: 'Privacy',
    description: 'Fast content and tracker blocker.',
    rating: 4.8,
    users: '30M+',
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
    description: 'Open-source per-profile password vault.',
    rating: 4.7,
    users: '4M+',
    chromiumId: 'nngceckbapebfimnlniiiahkandclblb',
    firefoxSlug: 'bitwarden-password-manager',
    recommended: true,
  },
  {
    id: 'clearurls',
    mark: 'clearurls',
    name: 'ClearURLs',
    publisher: 'Kevin R.',
    category: 'Privacy',
    description: 'Strips UTM and tracking parameters from URLs.',
    rating: 4.7,
    users: '700K+',
    chromiumId: 'lckanjgmijmafbedllaakclkaicjfmnk',
    firefoxSlug: 'clearurls',
    recommended: true,
  },
  {
    id: 'cookie-editor',
    mark: 'cookieeditor',
    name: 'Cookie-Editor',
    publisher: 'Moustachauve',
    category: 'Automation',
    description: 'Edit, import and export profile cookies.',
    rating: 4.7,
    users: '2M+',
    chromiumId: 'hlkenndednhfkekhgcdicdfddnkalmdm',
    firefoxSlug: 'cookie-editor',
  },
  {
    id: 'darkreader',
    mark: 'darkreader',
    name: 'Dark Reader',
    publisher: 'Dark Reader Ltd.',
    category: 'Productivity',
    description: 'Adaptive dark theme for websites.',
    rating: 4.7,
    users: '6M+',
    chromiumId: 'eimadpbcbfnmbkopoojfekhnkhdbieeh',
    firefoxSlug: 'darkreader',
  },
  {
    id: 'canvas-blocker',
    mark: 'canvasblocker',
    name: 'Canvas Blocker',
    publisher: 'kkapsner',
    category: 'Privacy',
    description: 'Firefox canvas and audio readout noise.',
    rating: 4.6,
    users: '250K+',
    firefoxSlug: 'canvasblocker',
  },
  {
    id: 'requestly',
    mark: 'requestly',
    name: 'Requestly',
    publisher: 'Requestly',
    category: 'Developer',
    description: 'Modify headers, redirects and mock rules.',
    rating: 4.6,
    users: '300K+',
    chromiumId: 'mdnleldcmiljblolnjhpnblkcekpdkpa',
  },
  {
    id: 'json-viewer',
    mark: 'json',
    name: 'JSON Viewer',
    publisher: 'tulios',
    category: 'Developer',
    description: 'Syntax-highlighted JSON inspector.',
    rating: 4.5,
    users: '1M+',
    chromiumId: 'gmegofaiokndkeajhipgnhjkmihnaoab',
  },
  {
    id: 'wappalyzer',
    mark: 'wappalyzer',
    name: 'Wappalyzer',
    publisher: 'Wappalyzer',
    category: 'Developer',
    description: 'Identifies site frameworks and analytics.',
    rating: 4.6,
    users: '2M+',
    chromiumId: 'gppongmhjkpfnbhagpmjfkannfbllamg',
    firefoxSlug: 'wappalyzer',
  },
  {
    id: 'singlefile',
    mark: 'singlefile',
    name: 'SingleFile',
    publisher: 'Gildas Lormeau',
    category: 'Productivity',
    description: 'Archives full pages to one HTML file.',
    rating: 4.8,
    users: '900K+',
    chromiumId: 'mpiodijhokgodhhofbcjdecpffjipkle',
    firefoxSlug: 'single-file',
  },
  {
    id: 'lighthouse',
    mark: 'lighthouse',
    name: 'Lighthouse',
    publisher: 'Google',
    category: 'Developer',
    description: 'Page performance and SEO audits.',
    rating: 4.4,
    users: '1M+',
    chromiumId: 'blipmdconlkpinefehnmjammfjpmpbjk',
  },
  {
    id: 'react-devtools',
    mark: 'react',
    name: 'React Developer Tools',
    publisher: 'Meta',
    category: 'Developer',
    description: 'Inspect React component trees.',
    rating: 4.5,
    users: '4M+',
    chromiumId: 'fmkadmapgofadopljbjfkapdkoienihi',
    firefoxSlug: 'react-devtools',
  },
];

export interface StoreLinks {
  chrome: string;
  edge: string;
  firefox: string;
  brave: string;
  chromium: string;
  joe: string;
}

/** Deep link to the listing for one extension in a given browser store. */
export function storeLink(ext: CatalogExtension, family: BrowserFamily): string {
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
  const store = family === 'edge'
    ? 'https://microsoftedge.microsoft.com/addons/search/'
    : 'https://chromewebstore.google.com/search/';
  return `${store}${encodeURIComponent(ext.name)}`;
}

export const FAMILY_LABEL: Record<BrowserFamily, string> = {
  chrome: 'Chrome',
  edge: 'Edge',
  firefox: 'Firefox',
  brave: 'Brave',
  chromium: 'Chromium',
  joe: 'Joe Browser',
};
