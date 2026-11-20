/**
 * Browsing-history capture.
 *
 * The history view has always been able to list, filter, search and clear
 * entries — but nothing ever *recorded* a visit: `addHistory` had no callers,
 * so the page showed three seeded demo rows forever. This module owns the
 * parts that must agree between the Electron shell, the Android WebView shell
 * and the web control plane:
 *
 *   - classify a navigation (direct visit vs search, sane title fallback),
 *   - a deterministic entry id, so shells that re-read the same visit from
 *     their own storage (Android re-reads a JSONL file) never duplicate it,
 *   - merging a shell's native history into the workspace list.
 */

export interface NavInfo {
  title: string;
  search: boolean;
}

const SEARCH_HOSTS = [
  /(^|\.)google\./i,
  /(^|\.)bing\.com$/i,
  /(^|\.)duckduckgo\.com$/i,
  /(^|\.)yahoo\./i,
  /(^|\.)yandex\./i,
  /(^|\.)baidu\.com$/i,
  /(^|\.)ecosia\.org$/i,
  /(^|\.)brave\.com$/i,
];

const SEARCH_PARAMS = ['q', 'query', 'p', 'text'];

/** A URL is a search when it is a results page of a known engine carrying a query. */
export function isSearchUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!SEARCH_HOSTS.some((re) => re.test(u.hostname))) return false;
    // The engine homepage is a visit, not a search.
    return SEARCH_PARAMS.some((p) => (u.searchParams.get(p) ?? '').trim().length > 0);
  } catch {
    return false;
  }
}

/**
 * Classify one navigation. The recorded title is the page title when the shell
 * reported one; for a search the query is a better fallback than the URL.
 */
export function classifyNavigation(url: string, title?: string | null): NavInfo {
  const clean = (title ?? '').trim();
  const search = isSearchUrl(url);
  if (search && !clean) {
    try {
      const u = new URL(url);
      for (const p of SEARCH_PARAMS) {
        const q = (u.searchParams.get(p) ?? '').trim();
        if (q) return { title: `${q} — search`, search: true };
      }
    } catch { /* fall through */ }
  }
  if (clean) return { title: clean, search };
  try {
    return { title: new URL(url).hostname || url, search };
  } catch {
    return { title: url, search };
  }
}

/**
 * Deterministic id for a visit. Two shells observing the same navigation (or
 * one shell re-reading its own log) must produce the same id so merges dedupe.
 */
export function historyEntryId(profileId: string, url: string, at: string): string {
  // FNV-1a over the triple: tiny, stable across runtimes, collision risk is
  // irrelevant for one user's local history.
  let h = 0x811c9dc5;
  const key = `${profileId}\u0000${url}\u0000${at}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `h_${(h >>> 0).toString(36)}`;
}

export interface MergeableEntry {
  id: string;
  at: string;
}

/**
 * Merge shell-reported entries into the stored list: dedupe by id, keep
 * newest-first, and cap the list so a long session cannot grow without bound.
 */
export function mergeHistory<T extends MergeableEntry>(existing: T[], incoming: T[], cap = 1500): T[] {
  const byId = new Map<string, T>();
  for (const e of existing) byId.set(e.id, e);
  for (const e of incoming) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, cap);
}
