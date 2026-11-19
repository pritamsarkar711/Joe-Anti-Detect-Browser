import { BRAND_MARKS } from './brandPaths';

/** Flat, circular Joe Browser mark. One colour, no gradient, no rounded square. */
export function Logo({ size = 30, withText = true, compact = false }: { size?: number; withText?: boolean; compact?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Joe Browser" style={{ flex: 'none' }}>
        <circle cx="24" cy="24" r="21" fill="none" stroke="#D81B60" strokeWidth="3" />
        <circle cx="24" cy="24" r="11.5" fill="#D81B60" />
        <circle cx="24" cy="24" r="4" fill="#fff" />
      </svg>
      {withText && (
        <span style={{ display: 'grid', lineHeight: 1.12, minWidth: 0 }}>
          <strong style={{ fontSize: compact ? 13 : 14.5, fontWeight: 600, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>Joe Browser</strong>
          {!compact && <span style={{ fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--muted)', fontWeight: 600 }}>WORKSPACE</span>}
        </span>
      )}
    </span>
  );
}

/** Official brand mark (simple-icons, CC0). Used wherever a platform is named. */
export function Official({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  const m = BRAND_MARKS[name];
  if (!m) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size}
      fill={color ?? `#${m.hex}`} role="img" aria-label={m.title} style={{ flex: 'none', display: 'block' }}
    >
      <path d={m.path} />
    </svg>
  );
}

/** Circular national flag (flag-icons SVGs, no emoji font dependency). */
export function CountryFlag({ code, size = 20, title }: { code: string; size?: number; title?: string }) {
  const cc = (code || 'xx').toLowerCase();
  return (
    <span
      className={`fi fi-${cc} fis flag-round`}
      title={title ?? cc.toUpperCase()}
      role="img"
      aria-label={title ?? cc.toUpperCase()}
      style={{ width: size, height: size, flex: 'none' }}
    />
  );
}
