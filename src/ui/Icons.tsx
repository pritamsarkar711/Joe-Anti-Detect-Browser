import type { SVGProps } from 'react';

const P: Record<string, string> = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c-2.5 2.4-3.8 5.4-3.8 9s1.3 6.6 3.8 9c2.5-2.4 3.8-5.4 3.8-9S14.5 5.4 12 3z',
  devices: 'M3 4h13v10H3zM8 18h5M9.5 14v4M18 8h3v10h-3zM19.5 18v2',
  fingerprint: 'M12 4a8 8 0 018 8M4 12a8 8 0 0116 0M7 12a5 5 0 0110 0M12 12v5M9 18c.6 1.4 1.7 2 3 2M6 16c0 2 .7 3.4 1.6 4.3M18 16c0 2-.7 3.4-1.6 4.3',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1-2.1 2.1-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5v.2h-3v-.2a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1-2.1-2.1.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3.5v-3h.2a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1 2.1-2.1.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3.5h3v.2a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1 2.1 2.1-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1h.2v3h-.2a1.6 1.6 0 00-1.5 1z',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  play: 'M8 5l11 7-11 7z',
  stop: 'M6 6h12v12H6z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3',
  download: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3',
  upload: 'M12 21V9m0 0L8 13m4-4l4 4M4 6V3h16v3',
  check: 'M4 12l5 5L20 6',
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  refresh: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7',
  link: 'M10 13a5 5 0 007.5.5l2-2A5 5 0 0012.5 4.5l-1 1M14 11a5 5 0 00-7.5-.5l-2 2A5 5 0 0011.5 19.5l1-1',
  shield: 'M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6zM9 12l2 2 4-4',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  cpu: 'M6 6h12v12H6zM9 9h6v6H9zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
  edit: 'M4 20h4l11-11-4-4L4 16zM14 6l4 4',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 7h.01',
  warn: 'M12 3l10 18H2zM12 9v5M12 17h.01',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  sun: 'M12 5V2M12 22v-3M5 12H2M22 12h-3M5.6 5.6L3.5 3.5M20.5 20.5l-2.1-2.1M5.6 18.4l-2.1 2.1M20.5 3.5l-2.1 2.1M12 8a4 4 0 100 8 4 4 0 000-8z',
  moon: 'M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z',
  panel: 'M3 4h18v16H3zM9 4v16',
  arrowLeft: 'M20 12H4M10 6l-6 6 6 6',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
  phone: 'M7 2h10v20H7zM11 18h2',
  key: 'M15 7a5 5 0 10-4 4.9L13 14h3v3h3v-3h-2l-2-2',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  sliders: 'M4 6h16M4 12h16M4 18h16M9 4v4M15 10v4M11 16v4',
  folder: 'M3 6h6l2 2h10v12H3z',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
};

export type IconName = keyof typeof P | string;

export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  const d = P[name] ?? P.grid;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={d} />
    </svg>
  );
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs><linearGradient id="joe-g" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#8b93ff" /><stop offset="1" stopColor="#4ad9b6" /></linearGradient></defs>
      <rect width="64" height="64" rx="16" fill="#151b2b" />
      <path d="M32 10 52 21v22L32 54 12 43V21z" fill="none" stroke="url(#joe-g)" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="8" fill="url(#joe-g)" />
    </svg>
  );
}
