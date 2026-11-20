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
 * A precision architectural "J" inside a chamfered stealth-aperture octagon.
 * Two geometric paths, zero gradients, legible from 16px favicon to 512px icon.
 */
export const MARK_GEOMETRY = {
  /** corner radius of the squircle, 48-grid */
  radius: 11.5,
  /** stem and hook geometry */
  stem: { x: 29.4, top: 14.5 },
  hook: { r: 8 },
  stroke: 4.6,
} as const;

const J_PATH = 'M21.2 14.5h8.2v13.8a8 8 0 0 1-16 0';
const FRAME_PATH = 'M15 9.5h18l5.5 5.5v18L33 38.5H15L9.5 33V15L15 9.5z';

export interface MarkProps {
  size?: number;
  tone?: 'color' | 'mono';
  color?: string;
  title?: string;
}

export function JoeMark({
  size = 32,
  tone = 'color',
  color = MARK_COLOR,
  title = 'Joe Browser',
  tile = false,
}: MarkProps & { tile?: boolean }) {
  const ink = tone === 'mono' ? color : MARK_COLOR;
  const fg = tile ? '#FFFFFF' : ink;
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
        d={FRAME_PATH}
        fill="none"
        stroke={fg}
        strokeOpacity={tile ? 0.34 : 0.28}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d={J_PATH}
        fill="none"
        stroke={fg}
        strokeWidth={MARK_GEOMETRY.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mark + wordmark lockup. */
export function Logo({ size = 28, withText = true, compact = false }: { size?: number; withText?: boolean; compact?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <JoeMark size={size} tile />
      {withText && (
        <span style={{ display: 'grid', lineHeight: 1.1, minWidth: 0 }}>
          <strong style={{ fontSize: compact ? 13.5 : 15, fontWeight: 600, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
            Joe Browser
          </strong>
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
