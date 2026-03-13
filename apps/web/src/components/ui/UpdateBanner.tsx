import { useDesktopAutoUpdate } from '../../hooks/useDesktopAutoUpdate';

/**
 * Task #87: Desktop auto-update progress UI.
 * Shows a banner when an update is available, downloading, or ready to install.
 */
export default function UpdateBanner() {
  const { updateState, dismissed, downloadUpdate, installUpdate, dismiss } = useDesktopAutoUpdate();

  if (dismissed || updateState.status === 'idle' || updateState.status === 'error') return null;

  const bannerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 20,
    right: 20,
    zIndex: 10000,
    background: 'var(--bg-primary, #2a2a4a)',
    border: '1px solid var(--border-color, #3a3a5c)',
    borderRadius: 12,
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 280,
    maxWidth: 360,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    color: 'var(--text-primary, #fff)',
    fontSize: 13,
  };

  const buttonStyle: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 12,
  };

  if (updateState.status === 'available') {
    return (
      <div style={bannerStyle} role="alert">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>Update Available</span>
          <button onClick={dismiss} style={{ ...buttonStyle, background: 'transparent', color: 'var(--text-secondary)' }}
            aria-label="Dismiss update notification">X</button>
        </div>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
          Gratonite v{updateState.version} is ready to download.
        </span>
        <button onClick={downloadUpdate}
          style={{ ...buttonStyle, background: 'var(--accent-color, #5865f2)', color: '#fff' }}>
          Download Update
        </button>
      </div>
    );
  }

  if (updateState.status === 'downloading') {
    return (
      <div style={bannerStyle} role="status" aria-live="polite">
        <span style={{ fontWeight: 600 }}>Downloading Update...</span>
        <div style={{ background: 'var(--bg-secondary, #1a1a2e)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
          <div style={{
            width: `${Math.round(updateState.percent)}%`,
            height: '100%',
            background: 'var(--accent-color, #5865f2)',
            borderRadius: 4,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
          {Math.round(updateState.percent)}% ({formatBytes(updateState.bytesPerSecond)}/s)
        </span>
      </div>
    );
  }

  if (updateState.status === 'ready') {
    return (
      <div style={bannerStyle} role="alert">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>Update Ready</span>
          <button onClick={dismiss} style={{ ...buttonStyle, background: 'transparent', color: 'var(--text-secondary)' }}
            aria-label="Dismiss update notification">X</button>
        </div>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
          Gratonite v{updateState.version} is ready to install. Restart to apply.
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={installUpdate}
            style={{ ...buttonStyle, background: 'var(--accent-color, #5865f2)', color: '#fff', flex: 1 }}>
            Restart Now
          </button>
          <button onClick={dismiss}
            style={{ ...buttonStyle, background: 'var(--bg-secondary, #1a1a2e)', color: 'var(--text-primary)', flex: 1 }}>
            Later
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
