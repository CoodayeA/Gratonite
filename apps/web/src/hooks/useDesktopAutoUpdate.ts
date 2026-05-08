import { useEffect, useState } from 'react';

export type UpdateState =
  | { status: 'idle' }
  | { status: 'available'; version: string; releaseNotes: string }
  | { status: 'downloading'; percent: number; bytesPerSecond: number }
  | { status: 'ready'; version: string; releaseNotes: string }
  | { status: 'error'; message: string };

/**
 * Task #87: Tracks auto-update lifecycle from Electron and
 * exposes state + actions for the UI to render progress/notifications.
 */
export function useDesktopAutoUpdate() {
  const [updateState, setUpdateState] = useState<UpdateState>({ status: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const desktop = window.gratoniteDesktop;
    if (!desktop?.isDesktop) return;

    const cleanups: Array<() => void> = [];

    if (desktop.onUpdateAvailable) {
      cleanups.push(desktop.onUpdateAvailable((info) => {
        setUpdateState({ status: 'available', version: info.version, releaseNotes: info.releaseNotes });
        setDismissed(false);
      }));
    }

    if (desktop.onUpdateDownloadProgress) {
      cleanups.push(desktop.onUpdateDownloadProgress((progress) => {
        setUpdateState({ status: 'downloading', percent: progress.percent, bytesPerSecond: progress.bytesPerSecond });
      }));
    }

    if (desktop.onUpdateDownloaded) {
      cleanups.push(desktop.onUpdateDownloaded((info) => {
        setUpdateState({ status: 'ready', version: info.version, releaseNotes: info.releaseNotes });
        setDismissed(false);
      }));
    }

    if (desktop.onUpdateError) {
      cleanups.push(desktop.onUpdateError((err) => {
        setUpdateState({ status: 'error', message: err.message });
      }));
    }

    // 1.0.13: replay the most recent update event so we don't miss banners
    // when the renderer mounts after the main process has already fired
    // update-available / update-downloaded.
    if (desktop.getUpdateState) {
      desktop.getUpdateState().then((cached) => {
        if (!cached || !cached.payload) return;
        const p = cached.payload as Record<string, unknown>;
        switch (cached.status) {
          case 'update-available':
            setUpdateState({
              status: 'available',
              version: String(p.version ?? ''),
              releaseNotes: String(p.releaseNotes ?? ''),
            });
            break;
          case 'update-downloaded':
            setUpdateState({
              status: 'ready',
              version: String(p.version ?? ''),
              releaseNotes: String(p.releaseNotes ?? ''),
            });
            break;
          case 'update-download-progress':
            setUpdateState({
              status: 'downloading',
              percent: Number(p.percent ?? 0),
              bytesPerSecond: Number(p.bytesPerSecond ?? 0),
            });
            break;
          case 'update-error':
            setUpdateState({ status: 'error', message: String(p.message ?? 'Update failed') });
            break;
          default:
            break;
        }
      }).catch(() => {
        /* no-op — older desktop builds won't have getUpdateState */
      });
    }

    return () => cleanups.forEach(fn => fn());
  }, []);

  const downloadUpdate = () => {
    window.gratoniteDesktop?.downloadUpdate?.();
  };

  const installUpdate = () => {
    window.gratoniteDesktop?.installUpdate?.();
  };

  const dismiss = () => {
    setDismissed(true);
  };

  return { updateState, dismissed, downloadUpdate, installUpdate, dismiss };
}
