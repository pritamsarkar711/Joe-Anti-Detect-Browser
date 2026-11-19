import type { BrowserProfile } from './profile';
import type { ProxyConfig } from './proxy';

export interface WorkspaceExport {
  format: 'joe-browser/workspace';
  version: 1;
  exportedAt: string;
  profiles: BrowserProfile[];
  proxies: ProxyConfig[];
  groups: string[];
}

export function exportWorkspace(profiles: BrowserProfile[], proxies: ProxyConfig[], groups: string[]): WorkspaceExport {
  return { format: 'joe-browser/workspace', version: 1, exportedAt: new Date().toISOString(), profiles, proxies, groups };
}

export function importWorkspace(json: string): WorkspaceExport {
  const parsed = JSON.parse(json) as Partial<WorkspaceExport>;
  if (parsed.format !== 'joe-browser/workspace' || !Array.isArray(parsed.profiles)) {
    throw new Error('Not a Joe Browser workspace file');
  }
  return {
    format: 'joe-browser/workspace',
    version: 1,
    exportedAt: parsed.exportedAt ?? new Date().toISOString(),
    profiles: parsed.profiles,
    proxies: Array.isArray(parsed.proxies) ? parsed.proxies : [],
    groups: Array.isArray(parsed.groups) ? parsed.groups : ['Default'],
  };
}

const CSV_COLS = ['name', 'group', 'tags', 'templateId', 'proxy', 'notes'] as const;

export function profilesToCsv(profiles: BrowserProfile[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = profiles.map((p) => [p.name, p.group, p.tags.join('|'), p.templateId, p.proxyId ?? '', p.notes].map(esc).join(','));
  return [CSV_COLS.join(','), ...rows].join('\n');
}

/** Minimal RFC 4180-ish parser for quoted fields. */
export function csvToRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/**
 * Cookie jar interchange. Accepts Netscape cookie files, JSON arrays and
 * `name=value; name2=value2` strings, so profiles can be seeded from a
 * previous tool (AdsPower / Dolphin Anty / GoLogin / a browser extension).
 */
export interface BrowserCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export function parseCookies(text: string): BrowserCookie[] {
  const raw = (text ?? '').trim();
  if (!raw) return [];
  if (raw.startsWith('[')) {
    try {
      const arr = JSON.parse(raw) as Array<Record<string, unknown>>;
      return arr.filter((c) => c && c.name).map((c) => ({
        name: String(c.name), value: String(c.value ?? ''),
        domain: String(c.domain ?? ''), path: String(c.path ?? '/'),
        expires: c.expirationDate ? Number(c.expirationDate) : c.expires ? Number(c.expires) : undefined,
        httpOnly: !!c.httpOnly, secure: !!c.secure,
      }));
    } catch { return []; }
  }
  if (raw.startsWith('{')) {
    try {
      const obj = JSON.parse(raw) as Record<string, string>;
      return Object.entries(obj).map(([name, value]) => ({ name, value: String(value), domain: '', path: '/' }));
    } catch { return []; }
  }
  if (raw.includes('\t')) {
    return raw.split(/\r?\n/).filter((l) => l && !l.startsWith('#')).map((l) => {
      const f = l.split('\t');
      return { domain: f[0] ?? '', path: f[2] ?? '/', secure: f[3] === 'TRUE', name: f[5] ?? '', value: f[6] ?? '', expires: f[4] ? Number(f[4]) : undefined, httpOnly: String(f[1]).includes('HttpOnly') };
    }).filter((c) => c.name);
  }
  return raw.split(';').map((part) => {
    const i = part.indexOf('=');
    return i > 0 ? { name: part.slice(0, i).trim(), value: part.slice(i + 1).trim(), domain: '', path: '/' } : null;
  }).filter((c): c is BrowserCookie => !!c);
}

export function cookiesToText(cookies: BrowserCookie[]): string {
  return JSON.stringify(cookies, null, 2);
}

/** Import profiles exported as CSV by other profile managers. */
export function profilesFromCsv(csv: string): Array<{ name: string; group: string; notes: string; proxy: string }> {
  const rows = csvToRows(csv);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (names: string[]) => names.map((n) => head.indexOf(n)).find((i) => i >= 0) ?? -1;
  const nameI = col(['name', 'profile name', 'profile']);
  const groupI = col(['group', 'folder', 'tag']);
  const notesI = col(['notes', 'note', 'comment']);
  const proxyI = col(['proxy', 'proxy url', 'proxyurl']);
  if (nameI < 0) return [];
  return rows.slice(1).filter((r) => r[nameI]?.trim()).map((r) => ({
    name: r[nameI].trim(),
    group: groupI >= 0 ? (r[groupI] || 'Imported').trim() : 'Imported',
    notes: notesI >= 0 ? (r[notesI] || '').trim() : '',
    proxy: proxyI >= 0 ? (r[proxyI] || '').trim() : '',
  }));
}

export function downloadFile(name: string, content: string, type = 'application/json'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
