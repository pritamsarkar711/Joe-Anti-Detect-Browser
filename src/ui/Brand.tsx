/**
 * Joe Browser brand mark — the single source of truth.
 * Keeps exact MARK_COLOR, MARK_GEOMETRY, and J_PATH verified by scripts/check-icons.mjs.
 */
import { BRAND_MARKS } from './brandPaths';
import { FLAG_DATA } from './flagData';

export const MARK_COLOR = '#D81B60';

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
        strokeOpacity={tile ? 0.36 : 0.28}
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

/**
 * Official multi-color SVG marks for browsers and platforms (flat shapes, zero gradients).
 * Respects monochrome `color` override when explicitly supplied.
 */
export function Official({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  if (!color) {
    if (name === 'chrome') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Google Chrome" style={{ flex: 'none', display: 'block' }}>
          <circle cx="12" cy="12" r="10.5" fill="#FFFFFF" />
          {/* Top Red */}
          <path d="M12 1.5a10.5 10.5 0 0 1 9.09 5.25H12a5.25 5.25 0 0 0-4.55 2.62L2.91 6.75A10.49 10.49 0 0 1 12 1.5z" fill="#EA4335" />
          {/* Left Green */}
          <path d="M2.91 6.75l4.54 7.87A5.25 5.25 0 0 0 12 17.25l-4.55 7.87A10.5 10.5 0 0 1 2.91 6.75z" transform="translate(0 -3.2)" fill="none" />
          <path d="M2.91 6.75A10.5 10.5 0 0 0 11.4 22.48l4.55-7.86A5.25 5.25 0 0 1 7.45 9.37z" fill="#34A853" />
          {/* Right Yellow */}
          <path d="M12 6.75h9.09A10.5 10.5 0 0 1 11.4 22.48l4.55-7.86A5.25 5.25 0 0 0 12 6.75z" fill="#FBBC05" />
          <circle cx="12" cy="12" r="5.1" fill="#FFFFFF" />
          <circle cx="12" cy="12" r="4" fill="#4285F4" />
        </svg>
      );
    }
    if (name === 'chromium') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Chromium" style={{ flex: 'none', display: 'block' }}>
          <path d="M12 1.5a10.5 10.5 0 0 1 9.09 5.25H12a5.25 5.25 0 0 0-4.55 2.62L2.91 6.75A10.49 10.49 0 0 1 12 1.5z" fill="#396CD4" />
          <path d="M2.91 6.75A10.5 10.5 0 0 0 11.4 22.48l4.55-7.86A5.25 5.25 0 0 1 7.45 9.37z" fill="#77A7F7" />
          <path d="M12 6.75h9.09A10.5 10.5 0 0 1 11.4 22.48l4.55-7.86A5.25 5.25 0 0 0 12 6.75z" fill="#A7C7FC" />
          <circle cx="12" cy="12" r="5.1" fill="#FFFFFF" />
          <circle cx="12" cy="12" r="4" fill="#2A65D5" />
        </svg>
      );
    }
    if (name === 'edge') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Microsoft Edge" style={{ flex: 'none', display: 'block' }}>
          {/* Lower deep blue wave */}
          <path d="M20.9 14.7c-.8 4.4-4.7 7.8-9.4 7.8-5.2 0-9.5-4.3-9.5-9.5 0-4.2 2.8-7.8 6.6-9-1.2 1.4-1.8 3.2-1.8 5.1 0 4.2 3.3 7.6 7.5 7.8 2.6.1 4.9-.9 6.6-2.2z" fill="#0C59A4" />
          {/* Inner mid-blue curl */}
          <path d="M16.2 15.8c-1.8.8-4.1.6-5.7-.9-1.4-1.3-1.8-3.4-1.1-5.2.6-1.4 1.9-2.4 3.4-2.5 1.9-.1 3.7 1.1 4.2 2.9H11.8c.2 1.8 1.8 3.1 3.6 3.1 1.1 0 2.1-.4 2.8-1.1-.4 1.6-1.1 2.9-2 3.7z" fill="#1490DF" />
          {/* Top bright teal/green wave */}
          <path d="M21.8 11.3c-.4-5.1-4.7-9.1-9.8-9.1-4.2 0-7.8 2.6-9.2 6.3 1.9-1.6 4.4-2.4 7-2 3.3.5 5.8 3.1 6.1 6.3.1.9.7 1.6 1.6 1.8 2.2.4 4.1-1.1 4.3-3.3z" fill="#2DD4BF" />
        </svg>
      );
    }
    if (name === 'firefox') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Firefox" style={{ flex: 'none', display: 'block' }}>
          <circle cx="12" cy="12.5" r="9.5" fill="#592ACB" />
          <circle cx="12.4" cy="12.8" r="5.6" fill="#3B82F6" />
          <path d="M21.2 9.2c-.9-2.7-3-4.9-5.6-6-1.1-.5-2.3-.7-3.5-.7-2 0-3.9.7-5.4 1.9.9-.1 1.9.1 2.7.5-1.9.9-3.1 2.8-3 5-1.1-.8-1.8-2-1.9-3.4C2.9 8.2 2 10.4 2 12.8c0 5.4 4.5 9.7 10 9.7 5.7 0 10.2-4.6 10-10.3-.1-1-.3-2-.8-3z" fill="#FF7139" />
          <path d="M19.8 8.3c-.7-1.9-2-3.4-3.7-4.4.8 1.2 1 2.8.4 4.2-.8 2-2.9 3-4.9 2.5-1.1-.3-2-.9-2.6-1.8-.3 1.7.4 3.5 1.8 4.5 1.6 1.2 3.8 1.2 5.5.2 2.4-1.3 3.9-3.6 3.5-5.2z" fill="#FFBD4F" />
        </svg>
      );
    }
    if (name === 'brave') {
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Brave" style={{ flex: 'none', display: 'block' }}>
          <path d="M19.2 4.4l-2-1.9H6.8l-2 1.9L2.5 8l1.6 7.5 4.8 5.2L12 22.5l3.1-1.8 4.8-5.2L21.5 8l-2.3-3.6z" fill="#FB542B" />
          <path d="M12 2.5h5.2l2 1.9L21.5 8l-1.6 7.5-4.8 5.2L12 22.5V2.5z" fill="#F03D16" />
          <path d="M12 6.8l-4.2 1.7.7 3.8 1.6 1-1.3 2.5 3.2 2.9 3.2-2.9-1.3-2.5 1.6-1 .7-3.8L12 6.8z" fill="#FFFFFF" />
          <path d="M12 10.2l1.6 1-.7 1.8h-1.8l-.7-1.8 1.6-1z" fill="#FB542B" />
        </svg>
      );
    }
  }

  const m = BRAND_MARKS[name];
  if (!m) return null;
  const fallbackColor = name === 'windows' ? '#0078D4'
    : name === 'android' ? '#3DDC84'
      : name === 'linux' ? '#E95420'
        : name === 'apple' ? 'currentColor'
          : `#${m.hex}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={color ?? fallbackColor}
      role="img"
      aria-label={m.title}
      style={{ flex: 'none', display: 'block' }}
    >
      <path d={m.path} />
    </svg>
  );
}

const AVATAR_TONES = [
  { bg: 'rgba(216, 27, 96, 0.12)', fg: '#C2185B', border: 'rgba(216, 27, 96, 0.28)' },
  { bg: 'rgba(37, 99, 235, 0.12)', fg: '#1D4ED8', border: 'rgba(37, 99, 235, 0.28)' },
  { bg: 'rgba(13, 148, 136, 0.12)', fg: '#0F766E', border: 'rgba(13, 148, 136, 0.28)' },
  { bg: 'rgba(217, 119, 6, 0.13)', fg: '#B45309', border: 'rgba(217, 119, 6, 0.28)' },
  { bg: 'rgba(124, 58, 237, 0.12)', fg: '#6D28D9', border: 'rgba(124, 58, 237, 0.28)' },
  { bg: 'rgba(22, 163, 74, 0.12)', fg: '#15803D', border: 'rgba(22, 163, 74, 0.28)' },
  { bg: 'rgba(234, 88, 12, 0.12)', fg: '#C2410C', border: 'rgba(234, 88, 12, 0.28)' },
  { bg: 'rgba(2, 132, 199, 0.12)', fg: '#0369A1', border: 'rgba(2, 132, 199, 0.28)' },
];

function avatarHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function initialsFrom(name: string): string {
  const words = name.trim().split(/[\s\-_]+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return 'JB';
}

/** Deterministic unique flat avatar tile for every browser profile. */
export function ProfileAvatar({
  name,
  seed,
  browserFamily,
  size = 32,
}: {
  name: string;
  seed?: string | number;
  browserFamily?: string;
  size?: number;
}) {
  const h = avatarHash(`${seed ?? name}`);
  const tone = AVATAR_TONES[h % AVATAR_TONES.length];
  const letters = initialsFrom(name);
  const badgeSize = Math.max(12, Math.round(size * 0.42));
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-grid',
        placeItems: 'center',
        width: size,
        height: size,
        borderRadius: 2,
        backgroundColor: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.border}`,
        fontSize: Math.round(size * 0.36),
        fontWeight: 700,
        letterSpacing: '-0.02em',
        lineHeight: 1,
        flex: 'none',
        userSelect: 'none',
      }}
    >
      {letters}
      {browserFamily && (
        <span
          style={{
            position: 'absolute',
            right: -3,
            bottom: -3,
            width: badgeSize,
            height: badgeSize,
            borderRadius: 2,
            backgroundColor: 'var(--surface, #fff)',
            border: '1px solid var(--line, rgba(20,24,34,0.12))',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {browserFamily === 'joe'
            ? <JoeMark size={badgeSize - 3} />
            : <Official name={browserFamily} size={badgeSize - 3} />}
        </span>
      )}
    </span>
  );
}

/** Circular national flag rendered as local data URI. */
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
