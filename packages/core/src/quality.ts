/**
 * Fingerprint quality metrics.
 *
 * "Unique" and "consistent" are different goals. A random mash-up is 100%
 * unique and 0% plausible; a single real device reused 200 times is 100%
 * consistent and 0% unique. These metrics measure BOTH, honestly.
 */
import type { BrowserProfile } from './profile';
import { checkConsistency } from './consistency';

export interface QualityReport {
  /** internal coherence of one fingerprint, 0..100 */
  consistency: number;
  grade: 'A' | 'B' | 'C' | 'D';
  /** how rare this exact bundle is inside the workspace, 0..100 */
  uniqueness: number;
  /** number of profiles sharing the same UA + screen + GPU + timezone bundle */
  duplicates: number;
  /** estimated bits of entropy across the workspace */
  entropyBits: number;
  /** surfaces that vary across the workspace */
  varyingSurfaces: string[];
  /** surfaces that are identical for every profile */
  staticSurfaces: string[];
  realBacked: boolean;
}

function bundle(p: BrowserProfile): string {
  const f = p.fingerprint;
  return [f.userAgent, f.screen.width, f.screen.height, f.screen.dpr, f.gpu.renderer, f.timezone, f.locale].join('|');
}

export function profileQuality(p: BrowserProfile, all: BrowserProfile[]): QualityReport {
  const report = checkConsistency(p.fingerprint);
  const key = bundle(p);
  const duplicates = all.filter((x) => bundle(x) === key).length;
  // A workspace with N distinct bundles has log2(N) bits of separation.
  const distinct = new Set(all.map(bundle)).size;
  const entropyBits = Math.log2(Math.max(1, distinct));
  const uniqueness = all.length <= 1 || duplicates <= 1
    ? 100
    : Math.max(0, Math.min(100, Math.round(100 * (1 - (duplicates - 1) / Math.max(1, all.length - 1)))));

  const surfaces: Array<[string, (p: BrowserProfile) => string]> = [
    ['User agent', (x) => x.fingerprint.userAgent],
    ['Screen', (x) => `${x.fingerprint.screen.width}x${x.fingerprint.screen.height}`],
    ['GPU', (x) => x.fingerprint.gpu.renderer],
    ['Timezone', (x) => x.fingerprint.timezone],
    ['Locale', (x) => x.fingerprint.locale],
    ['CPU', (x) => String(x.fingerprint.cores)],
    ['Memory', (x) => String(x.fingerprint.memoryGb)],
    ['Noise seed', (x) => String(x.fingerprint.noiseSeed)],
  ];
  const varyingSurfaces = surfaces.filter(([, get]) => new Set(all.map(get)).size > 1).map(([n]) => n);
  const staticSurfaces = surfaces.filter(([, get]) => new Set(all.map(get)).size <= 1).map(([n]) => n);

  return {
    consistency: report.score,
    grade: report.grade,
    uniqueness,
    duplicates,
    entropyBits: Math.round(entropyBits * 10) / 10,
    varyingSurfaces,
    staticSurfaces,
    realBacked: !!p.fingerprint.realId || !!p.realId,
  };
}

export function workspaceQuality(all: BrowserProfile[]) {
  if (!all.length) return { averageConsistency: 0, averageUniqueness: 0, distinctBundles: 0, entropyBits: 0, grade: 'D' as const };
  const reports = all.map((p) => profileQuality(p, all));
  const avg = (fn: (r: QualityReport) => number) => Math.round(reports.reduce((a, r) => a + fn(r), 0) / reports.length);
  const score = (avg((r) => r.consistency) + avg((r) => r.uniqueness)) / 2;
  return {
    averageConsistency: avg((r) => r.consistency),
    averageUniqueness: avg((r) => r.uniqueness),
    distinctBundles: new Set(all.map(bundle)).size,
    entropyBits: reports[0].entropyBits,
    grade: (score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 55 ? 'C' : 'D') as 'A' | 'B' | 'C' | 'D',
  };
}
