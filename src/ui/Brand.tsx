/**
 * Joe Browser brand mark — the single source of truth.
 *
 * Geometry: an open shield-arc wrapping a solid "J" core with a light pupil.
 * It reads at 16px (favicon) and at 96px (installer icon) because it uses only
 * three shapes, one colour and generous negative space. Every placement in the
 * app, the favicon, the site, the Electron icon and the Android adaptive icon
 * derives from these same numbers.
 *
 * Flat, single pink (#D81B60), no gradients, no rounded-square container.
 */
import { BRAND_MARKS } from './brandPaths';
import { FLAG_DATA } from './flagData';

export const MARK_COLOR = '#D81B60';

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
export function JoeMark({ size = 32, tone = 'color', color = MARK_COLOR, title = 'Joe Browser' }: MarkProps) {
  const stroke = tone === 'mono' ? color : MARK_COLOR;
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
      {/* Outer arc — an open ring, the profile "container" */}
      <path
        d="M39.75 13.38A19 19 0 1 1 31.73 6.64"
        fill="none"
        stroke={stroke}
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      {/* Core disc — the isolated identity */}
      <circle cx="24" cy="24" r="10.2" fill={stroke} />
      {/* Pupil — keeps the mark legible as small as 16px */}
      <circle cx="24" cy="24" r="3.8" fill="#FFFFFF" />
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
