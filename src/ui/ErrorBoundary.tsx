import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Last line of defence: a render error must never leave a blank window.
 * The fallback offers a safe reset (clear cached workspace state) and reload.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[joe] render failed', error, info.componentStack);
  }

  private reset = () => {
    try {
      window.localStorage.removeItem('joe-browser:v3');
        window.localStorage.removeItem('joe-browser:v2');
    } catch {
      /* storage may be unavailable in a locked-down profile */
    }
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeContent: 'center',
          gap: 12,
          padding: 24,
          background: dark ? '#0e1015' : '#f6f7f9',
          color: dark ? '#f2f3f7' : '#1d1f26',
          font: '14px/1.6 "IBM Plex Sans", system-ui, sans-serif',
        }}
      >
        <svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true">
          <path d="M39.75 13.38A19 19 0 1 1 31.73 6.64" fill="none" stroke="#D81B60" strokeWidth="3.6" strokeLinecap="round" />
          <circle cx="24" cy="24" r="10.2" fill="#D81B60" />
          <circle cx="24" cy="24" r="3.8" fill={dark ? '#0e1015' : '#fff'} />
        </svg>
        <h1 style={{ margin: 0, fontSize: 18 }}>Something went wrong</h1>
        <p style={{ margin: 0, maxWidth: 460, color: dark ? '#9aa1b0' : '#666c7a' }}>
          The workspace hit an unexpected error. Your profiles are stored on disk, so a reset only clears the
          cached browser view.
        </p>
        <pre
          style={{
            margin: 0,
            padding: 10,
            maxWidth: 520,
            maxHeight: 180,
            overflow: 'auto',
            fontSize: 11,
            background: dark ? '#161920' : '#fff',
            border: `1px solid ${dark ? 'rgba(255,255,255,.1)' : 'rgba(20,24,34,.12)'}`,
          }}
        >
          {error.message}
        </pre>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '8px 16px', border: 0, background: '#D81B60', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
          >
            Reload
          </button>
          <button
            type="button"
            onClick={this.reset}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              color: 'inherit',
              fontWeight: 600,
              cursor: 'pointer',
              border: `1px solid ${dark ? 'rgba(255,255,255,.2)' : 'rgba(20,24,34,.2)'}`,
            }}
          >
            Reset cached view
          </button>
        </div>
      </div>
    );
  }
}
