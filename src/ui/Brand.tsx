/**
 * Joe Browser brand mark — the single source of truth.
 *
 * The mark is a monogram: a rounded "J" inside a squircle. It replaced the
 * earlier ring-and-dot, which read as a router or record glyph at small sizes.
 *
 * Why this shape:
 * - One glyph, two colours, no gradients — legible at 16px (favicon) and 512px
 *   (store icon) from the same geometry.
 * - The squircle and the letterform share an optical weight, so it holds on a
 *   white tile, a dark tile and the Android adaptive-icon mask.
 * - Nothing about it depends on text, so it survives translation and scaling.
 *
 * Every placement (app chrome, favicon, site, Electron icon, Android adaptive
 * icon, splash) derives from MARK_GEOMETRY below. Never redraw it elsewhere.
 */
import { BRAND_MARKS } from './brandPaths';
import { FLAG_DATA } from './flagData';

export const MARK_COLOR = '#D81B60';

/**
 * Canonical geometry on a 48-unit grid.
 *
 * `tile` is the squircle; `j` is the stroke path; the stroke width is tuned so
 * the glyph's counter (the hook) stays open at 16px.
 */
export const MARK_GEOMETRY = {
  /** corner radius of the squircle, 48-grid */
  radius: 11.5,
  /** vertical stem start, and the baseline the hook curves from */
  stem: { x: 29.4, top: 12.5 },
  /** hook radius */
  hook: { r: 8.4 },
  stroke: 5,
} as const;

const J_PATH = 'M29.4 12.5v15.4a8.4 8.4 0 0 1-16.8 0';

export interface MarkProps {
  size?: number;
  /** Outline-only rendering for favicons/tray where a solid block would smear. */
  tone?: 'color' | 'mono';
  color?: string;
  title?: string;
}

/**
 * The canonical mark. `id` suffixes keep gradient-free SVG ids unique when the
 * mark appears several times on one page (no <defs> collisions).
 */
export function JoeMark({
  size = 32,
  tone = 'color',
  color = MARK_COLOR,
  title = 'Joe Browser',
  tile = false,
}: MarkProps & { tile?: boolean }) {
  // `tile` draws the filled squircle behind the glyph (favicon, launcher,
  // installer). `tile: false` is the transparent glyph for app chrome, where
  // the surrounding surface already provides the background.
  const ink = tone === 'mono' ? color : MARK_COLOR;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      style={{ flex: 'none', display: 'block' }}
    >
      <title>{title}</title>
      {tile && <rect width="48" height="48" rx={MARK_GEOMETRY.radius} fill={ink} />}
      <path
        d={J_PATH}
        fill="none"
        stroke={tile ? '#FFFFFF' : ink}
        strokeWidth={MARK_GEOMETRY.stroke}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Mark + wordmark lockup. `compact` drops the sub-label for tight headers. */
export function Logo({ size = 30, withText = true, compact = false }: { size?: number; withText?: boolean; compact?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
      <JoeMark size={size} />
      {withText && (
        <span style={{ display: 'grid', lineHeight: 1.1, minWidth: 0 }}>
          <strong style={{ fontSize: compact ? 13.5 : 15, fontWeight: 600, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
            Joe Browser
          </strong>
          {!compact && (
            <span
              style={{
                fontSize: 9,
                letterSpacing: '0.14em',
                color: 'var(--muted, #666c7a)',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              Profiles
            </span>
          )}
        </span>
      )}
    </span>
  );
}

/** Official brand mark (simple-icons, CC0) — platform identification only. */
export function Official({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  const m = BRAND_MARKS[name];
  if (!m) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={color ?? `#${m.hex}`}
      role="img"
      aria-label={m.title}
      style={{ flex: 'none', display: 'block' }}
    >
      <path d={m.path} />
    </svg>
  );
}

/**
 * Circular national flag.
 *
 * Renders a local, inlined SVG (data URI) instead of a CSS background request:
 * the packaged app runs over file://, where relative flag assets fail and the
 * flag would otherwise appear as an empty grey circle.
 */
export function CountryFlag({ code, size = 20, title }: { code: string; size?: number; title?: string }) {
  const cc = (code || 'xx').toLowerCase();
  const src = FLAG_DATA[cc] ?? FLAG_DATA.xx;
  const label = title ?? cc.toUpperCase();
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={label}
      title={label}
      loading="lazy"
      decoding="async"
      className="country-flag"
      style={{
        width: size, height: size, flex: 'none', borderRadius: '50%',
        objectFit: 'cover', display: 'block',
        boxShadow: 'inset 0 0 0 1px var(--line-soft, rgba(20,24,34,.08))',
      }}
    />
  );
}
