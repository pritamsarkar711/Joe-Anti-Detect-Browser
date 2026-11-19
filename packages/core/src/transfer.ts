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

export function downloadFile(name: string, content: string, type = 'application/json'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
