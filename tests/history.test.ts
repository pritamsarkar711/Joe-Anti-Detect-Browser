import { describe, it, expect } from 'vitest';
import { classifyNavigation, isSearchUrl, historyEntryId, mergeHistory } from '@joe/core';

/**
 * Browsing-history capture.
 *
 * The history view has always been able to list and filter entries, but
 * nothing recorded a visit until the shells started emitting them. These
 * helpers must classify consistently and dedupe the same visit however many
 * times a shell re-reports it.
 */
describe('history classification', () => {
  it('recognises real search result pages and nothing else', () => {
    expect(isSearchUrl('https://www.google.com/search?q=browser+fingerprint')).toBe(true);
    expect(isSearchUrl('https://duckduckgo.com/?q=joe+browser')).toBe(true);
    expect(isSearchUrl('https://www.bing.com/search?q=proxy+test')).toBe(true);
    // The engine homepage is a visit, not a search.
    expect(isSearchUrl('https://www.google.com/')).toBe(false);
    expect(isSearchUrl('https://google.com/search')).toBe(false);
    // An unrelated site with a q= param is not a search engine.
    expect(isSearchUrl('https://example.com/?q=anything')).toBe(false);
    expect(isSearchUrl('not a url')).toBe(false);
  });

  it('prefers the page title and falls back to the query, then the host', () => {
    expect(classifyNavigation('https://example.com/a', 'Example page')).toEqual({
      title: 'Example page',
      search: false,
    });
    expect(classifyNavigation('https://www.google.com/search?q=camoufox', 'camoufox - Google Search').search).toBe(true);
    expect(classifyNavigation('https://www.google.com/search?q=camoufox')).toEqual({
      title: 'camoufox — search',
      search: true,
    });
    expect(classifyNavigation('https://example.com/page')).toEqual({
      title: 'example.com',
      search: false,
    });
  });
});

describe('history identity and merging', () => {
  it('gives the same visit the same id every time', () => {
    const a = historyEntryId('prf_1', 'https://example.com/', '2026-11-19T10:00:00.000Z');
    const b = historyEntryId('prf_1', 'https://example.com/', '2026-11-19T10:00:00.000Z');
    expect(a).toBe(b);
    expect(historyEntryId('prf_2', 'https://example.com/', '2026-11-19T10:00:00.000Z')).not.toBe(a);
    expect(historyEntryId('prf_1', 'https://example.com/other', '2026-11-19T10:00:00.000Z')).not.toBe(a);
  });

  it('merges re-reported visits instead of duplicating them, newest first', () => {
    const base = [
      { id: 'h_1', at: '2026-11-19T10:00:00.000Z', title: 'first' },
      { id: 'h_2', at: '2026-11-19T11:00:00.000Z', title: 'second' },
    ];
    // The same visit arrives again with its real page title attached.
    const merged = mergeHistory(base, [{ id: 'h_1', at: '2026-11-19T10:00:00.000Z', title: 'first, now titled' }]);
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe('h_2');
    expect(merged.find((e) => e.id === 'h_1')?.title).toBe('first, now titled');

    const withNew = mergeHistory(merged, [{ id: 'h_3', at: '2026-11-19T12:00:00.000Z', title: 'third' }]);
    expect(withNew.map((e) => e.id)).toEqual(['h_3', 'h_2', 'h_1']);
  });

  it('caps the stored history so long sessions cannot grow without bound', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: `h_${i}`,
      at: new Date(Date.UTC(2026, 10, 19, 0, 0, i)).toISOString(),
      title: `p${i}`,
    }));
    expect(mergeHistory(many, [], 10)).toHaveLength(10);
    // The newest survive.
    expect(mergeHistory(many, [], 10)[0].id).toBe('h_29');
  });
});
