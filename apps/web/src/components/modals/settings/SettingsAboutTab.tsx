import { useEffect, useRef, useState } from 'react';
import { useDesktopAutoUpdate } from '../../../hooks/useDesktopAutoUpdate';
import type { SettingsTabProps } from './types';

type LocalCheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'up-to-date' }
  | { status: 'error'; message: string };

const formatBytes = (bps: number) => {
  if (!bps || !Number.isFinite(bps)) return '0 KB/s';
  if (bps < 1024 * 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
};

export default function SettingsAboutTab({ addToast }: SettingsTabProps) {
  const desktop = (window as any).gratoniteDesktop as
    | { isDesktop?: boolean; getVersion?: () => Promise<string>; getPlatform?: () => Promise<string>; checkForUpdates?: () => void; onUpdateChecking?: (cb: () => void) => () => void; onUpdateNotAvailable?: (cb: (info: { version: string }) => void) => () => void }
    | undefined;

  const isDesktop = !!desktop?.isDesktop;
  const [version, setVersion] = useState<string>('—');
  const [platform, setPlatform] = useState<string>('');
  const [local, setLocal] = useState<LocalCheckState>({ status: 'idle' });
  const checkingTimeoutRef = useRef<number | null>(null);

  const { updateState, downloadUpdate, installUpdate } = useDesktopAutoUpdate();

  useEffect(() => {
    if (!isDesktop) return;
    desktop?.getVersion?.().then(v => setVersion(v || '—')).catch(() => {});
    desktop?.getPlatform?.().then(p => setPlatform(p || '')).catch(() => {});
  }, [isDesktop, desktop]);

  useEffect(() => {
    if (!isDesktop) return;
    const cleanups: Array<() => void> = [];
    if (desktop?.onUpdateChecking) {
      cleanups.push(desktop.onUpdateChecking(() => {
        if (local.status !== 'checking') return;
      }));
    }
    if (desktop?.onUpdateNotAvailable) {
      cleanups.push(desktop.onUpdateNotAvailable(() => {
        setLocal(prev => prev.status === 'checking' ? { status: 'up-to-date' } : prev);
        if (checkingTimeoutRef.current) {
          window.clearTimeout(checkingTimeoutRef.current);
          checkingTimeoutRef.current = null;
        }
      }));
    }
    return () => cleanups.forEach(fn => fn());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, desktop]);

  useEffect(() => {
    if (local.status !== 'checking') return;
    if (updateState.status === 'available' || updateState.status === 'downloading' || updateState.status === 'ready') {
      setLocal({ status: 'idle' });
      if (checkingTimeoutRef.current) {
        window.clearTimeout(checkingTimeoutRef.current);
        checkingTimeoutRef.current = null;
      }
    } else if (updateState.status === 'error') {
      setLocal({ status: 'error', message: updateState.message });
      if (checkingTimeoutRef.current) {
        window.clearTimeout(checkingTimeoutRef.current);
        checkingTimeoutRef.current = null;
      }
    }
  }, [updateState, local.status]);

  useEffect(() => () => {
    if (checkingTimeoutRef.current) window.clearTimeout(checkingTimeoutRef.current);
  }, []);

  const handleCheck = () => {
    if (!desktop?.checkForUpdates) {
      addToast({ title: 'Updates not available', description: 'Auto-updater is only available in the desktop app.', variant: 'info' });
      return;
    }
    setLocal({ status: 'checking' });
    desktop.checkForUpdates();
    if (checkingTimeoutRef.current) window.clearTimeout(checkingTimeoutRef.current);
    checkingTimeoutRef.current = window.setTimeout(() => {
      setLocal(prev => prev.status === 'checking' ? { status: 'up-to-date' } : prev);
      checkingTimeoutRef.current = null;
    }, 12000);
  };

  const renderStatus = () => {
    if (updateState.status === 'available') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>
            Update available — version {updateState.version}
          </div>
          {updateState.releaseNotes && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 160, overflowY: 'auto', padding: 8, background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: 6 }}>
              {String(updateState.releaseNotes).replace(/<[^>]+>/g, '').trim() || 'No release notes provided.'}
            </div>
          )}
          <button
            onClick={downloadUpdate}
            style={{ padding: '8px 14px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}
          >
            Download update
          </button>
        </div>
      );
    }
    if (updateState.status === 'downloading') {
      const pct = Math.max(0, Math.min(100, Math.round(updateState.percent || 0)));
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>
            Downloading update… {pct}% ({formatBytes(updateState.bytesPerSecond)})
          </div>
          <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-primary)', transition: 'width 200ms ease' }} />
          </div>
        </div>
      );
    }
    if (updateState.status === 'ready') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>
            Update {updateState.version} ready to install
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            Restart Gratonite to finish installing.
          </div>
          <button
            onClick={installUpdate}
            style={{ padding: '8px 14px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}
          >
            Restart &amp; install
          </button>
        </div>
      );
    }
    if (local.status === 'checking') {
      return <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Checking for updates…</div>;
    }
    if (local.status === 'up-to-date') {
      return <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>You're on the latest version.</div>;
    }
    if (local.status === 'error' || updateState.status === 'error') {
      const msg = local.status === 'error' ? local.message : (updateState as { status: 'error'; message: string }).message;
      return <div style={{ color: 'var(--accent-danger, #ef4444)', fontSize: 13 }}>Update check failed: {msg}</div>;
    }
    return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Click "Check for updates" to look for a newer version.</div>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
      <div>
        <h2 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, margin: 0 }}>About Gratonite</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          Version information and update controls for the desktop app.
        </p>
      </div>

      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--stroke)', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>App version</div>
            <div style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {version}
            </div>
          </div>
          {platform && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platform</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>{platform}</div>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--stroke)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {renderStatus()}
          <button
            onClick={handleCheck}
            disabled={local.status === 'checking' || updateState.status === 'downloading'}
            style={{
              padding: '8px 14px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--stroke)',
              borderRadius: 6,
              fontWeight: 600,
              cursor: (local.status === 'checking' || updateState.status === 'downloading') ? 'not-allowed' : 'pointer',
              opacity: (local.status === 'checking' || updateState.status === 'downloading') ? 0.6 : 1,
              alignSelf: 'flex-start',
            }}
          >
            {local.status === 'checking' ? 'Checking…' : 'Check for updates'}
          </button>
        </div>
      </div>

      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
        Updates are delivered automatically in the background. You'll see a banner when a new version is available; this page lets you check on demand.
      </div>
    </div>
  );
}
