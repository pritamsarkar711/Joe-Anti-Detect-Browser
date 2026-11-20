/**
 * Dedicated vector brand marks for every built-in extension in EXTENSION_CATALOG.
 * Flat geometric paths (zero gradients) so every card displays a distinct logo.
 */
export function ExtensionLogo({ mark, size = 22 }: { mark: string; size?: number }) {
  switch (mark) {
    case 'httptracker':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="HTTP Tracker" style={{ display: 'block', flex: 'none' }}>
          <rect width="24" height="24" rx="4" fill="#0F766E" />
          <path d="M5 8h9l-2.2-2.2M19 16h-9l2.2 2.2" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="17.5" cy="8" r="2.2" fill="#5EEAD4" />
          <circle cx="6.5" cy="16" r="2.2" fill="#5EEAD4" />
        </svg>
      );
    case 'rightclick':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Absolute Right Click" style={{ display: 'block', flex: 'none' }}>
          <rect width="24" height="24" rx="4" fill="#2563EB" />
          <path d="M8 5.5L16.5 13l-4.2.5 2 4.3-2 .9-2-4.3L7.5 17z" fill="#FFFFFF" />
          <circle cx="17" cy="7" r="2.5" fill="#4ADE80" />
        </svg>
      );
    case 'ublock':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="uBlock Origin" style={{ display: 'block', flex: 'none' }}>
          <path d="M12 2.5L4.5 5.5v6.2c0 4.6 3.2 8.7 7.5 9.8 4.3-1.1 7.5-5.2 7.5-9.8V5.5L12 2.5z" fill="#800000" />
          <path d="M12 4.2l5.8 2.3v5.1c0 3.7-2.5 7.1-5.8 8.1-3.3-1-5.8-4.4-5.8-8.1V6.5L12 4.2z" fill="#C80000" />
          <path d="M8.5 9.2v3.6a3.5 3.5 0 0 0 7 0V9.2h-2.1v3.6a1.4 1.4 0 0 1-2.8 0V9.2H8.5z" fill="#FFFFFF" />
        </svg>
      );
    case 'bitwarden':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Bitwarden" style={{ display: 'block', flex: 'none' }}>
          <path d="M4.5 3.5h15v8.8c0 4.6-3.2 8.4-7.5 9.7-4.3-1.3-7.5-5.1-7.5-9.7V3.5z" fill="#175DDC" />
          <path d="M12 5.7v14c2.9-1 5.2-3.9 5.2-7.4V5.7H12z" fill="#FFFFFF" />
        </svg>
      );
    case 'clearurls':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="ClearURLs" style={{ display: 'block', flex: 'none' }}>
          <rect width="24" height="24" rx="4" fill="#F97316" />
          <path d="M9.5 14.5l5-5m-6.2 1.8a3 3 0 0 1 0-4.2l1.8-1.8a3 3 0 0 1 4.2 4.2m-3.6 3.6a3 3 0 0 1 0 4.2l-1.8 1.8a3 3 0 0 1-4.2-4.2" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'cookieeditor':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Cookie-Editor" style={{ display: 'block', flex: 'none' }}>
          <circle cx="12" cy="12" r="9.5" fill="#D97706" />
          <circle cx="16.5" cy="7.5" r="3" fill="#FEF3C7" />
          <circle cx="9" cy="9" r="1.4" fill="#78350F" />
          <circle cx="14.5" cy="13.5" r="1.5" fill="#78350F" />
          <circle cx="8.5" cy="15" r="1.3" fill="#78350F" />
        </svg>
      );
    case 'darkreader':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Dark Reader" style={{ display: 'block', flex: 'none' }}>
          <rect width="24" height="24" rx="4" fill="#1E293B" />
          <path d="M4.5 11.5h6a2.5 2.5 0 0 1-5 0zm9 0h6a2.5 2.5 0 0 1-5 0z" fill="#F43F5E" />
          <path d="M4 11h16M10.5 11.5h3" stroke="#E2E8F0" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'canvasblocker':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Canvas Blocker" style={{ display: 'block', flex: 'none' }}>
          <rect width="24" height="24" rx="4" fill="#7C3AED" />
          <rect x="5" y="6" width="14" height="10" rx="1.5" fill="#FFFFFF" />
          <path d="M7 14l3-4 2.5 3 2-2.2 2.5 3.2z" fill="#A78BFA" />
          <path d="M5 19l14-14" stroke="#F43F5E" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'requestly':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Requestly" style={{ display: 'block', flex: 'none' }}>
          <rect width="24" height="24" rx="4" fill="#4F46E5" />
          <path d="M7 7h5.5a3 3 0 0 1 0 6H9.5l5 5" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="17" cy="7" r="2" fill="#38BDF8" />
        </svg>
      );
    case 'json':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="JSON Viewer" style={{ display: 'block', flex: 'none' }}>
          <rect width="24" height="24" rx="4" fill="#0284C7" />
          <path d="M9.5 6.5c-1.5 0-2 .8-2 2v1.8c0 .9-.7 1.7-1.5 1.7.8 0 1.5.8 1.5 1.7v1.8c0 1.2.5 2 2 2M14.5 6.5c1.5 0 2 .8 2 2v1.8c0 .9.7 1.7 1.5 1.7-.8 0-1.5.8-1.5 1.7v1.8c0 1.2-.5 2-2 2" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'wappalyzer':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Wappalyzer" style={{ display: 'block', flex: 'none' }}>
          <rect width="24" height="24" rx="4" fill="#4608AD" />
          <path d="M12 5l7 3.5-7 3.5-7-3.5L12 5z" fill="#A78BFA" />
          <path d="M5 12l7 3.5 7-3.5M5 15.5l7 3.5 7-3.5" fill="none" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'singlefile':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="SingleFile" style={{ display: 'block', flex: 'none' }}>
          <path d="M6 3.5h8.5L19 8v12.5H6z" fill="#059669" />
          <path d="M14.5 3.5V8H19z" fill="#6EE7B7" />
          <path d="M9 12.5h6M9 15.8h6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'lighthouse':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="Lighthouse" style={{ display: 'block', flex: 'none' }}>
          <circle cx="12" cy="12" r="10" fill="#F4511E" />
          <path d="M9.5 19l1-9.5h3l1 9.5z" fill="#FFFFFF" />
          <rect x="10" y="6.5" width="4" height="2.6" fill="#FDE047" />
          <path d="M4.5 9l5.5-1.5M19.5 9L14 7.5" stroke="#FEF08A" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'react':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label="React Developer Tools" style={{ display: 'block', flex: 'none' }}>
          <rect width="24" height="24" rx="4" fill="#0F172A" />
          <circle cx="12" cy="12" r="1.8" fill="#61DAFB" />
          <ellipse cx="12" cy="12" rx="8" ry="3.2" fill="none" stroke="#61DAFB" strokeWidth="1.4" />
          <ellipse cx="12" cy="12" rx="8" ry="3.2" transform="rotate(60 12 12)" fill="none" stroke="#61DAFB" strokeWidth="1.4" />
          <ellipse cx="12" cy="12" rx="8" ry="3.2" transform="rotate(-60 12 12)" fill="none" stroke="#61DAFB" strokeWidth="1.4" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={mark} style={{ display: 'block', flex: 'none' }}>
          <rect width="24" height="24" rx="4" fill="#D81B60" />
          <circle cx="12" cy="12" r="4.5" fill="#FFFFFF" />
        </svg>
      );
  }
}
