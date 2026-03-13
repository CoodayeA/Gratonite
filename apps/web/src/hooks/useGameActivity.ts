import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

declare global {
  interface Window {
    gratoniteDesktop?: {
      isDesktop: boolean;
      onGameDetected?: (cb: (data: { name: string; startedAt: number }) => void) => (() => void);
      onGameStopped?: (cb: () => void) => (() => void);
      getCurrentGame?: () => Promise<{ name: string; startedAt: number } | null>;
      setGameActivityEnabled?: (enabled: boolean) => void;
      // Deep links (Task #86)
      onDeepLink?: (cb: (url: string) => void) => (() => void);
      // Auto-update (Task #87)
      onUpdateAvailable?: (cb: (info: { version: string; releaseNotes: string }) => void) => (() => void);
      onUpdateDownloadProgress?: (cb: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => (() => void);
      onUpdateDownloaded?: (cb: (info: { version: string; releaseNotes: string }) => void) => (() => void);
      onUpdateError?: (cb: (err: { message: string }) => void) => (() => void);
      downloadUpdate?: () => void;
      installUpdate?: () => void;
      checkForUpdates?: () => void;
      // Idle detection (Task #88)
      onSystemIdleChanged?: (cb: (data: { idle: boolean; idleSeconds: number }) => void) => (() => void);
      setIdleThreshold?: (minutes: number) => void;
      getIdleThreshold?: () => Promise<number>;
      // Mini mode (Task #89)
      toggleMiniMode?: () => void;
      exitMiniMode?: () => void;
      isMiniMode?: () => Promise<boolean>;
      onMiniModeChanged?: (cb: (active: boolean) => void) => (() => void);
      // App menu navigation (Task #90)
      onNavigate?: (cb: (route: string) => void) => (() => void);
      // Notification actions (Task #92)
      showMessageNotification?: (data: { title: string; body: string; channelId: string; messageId?: string; guildId?: string }) => void;
      onNotificationClicked?: (cb: (data: { channelId: string; guildId?: string; focusInput?: boolean }) => void) => (() => void);
      onNotificationReply?: (cb: (data: { channelId: string; messageId?: string; reply: string }) => void) => (() => void);
      onNotificationMarkRead?: (cb: (data: { channelId: string }) => void) => (() => void);
      // Existing
      sendNotification?: (title: string, body: string) => void;
      setBadgeCount?: (count: number) => void;
      getMuteState?: () => Promise<boolean>;
      setMuteState?: (muted: boolean) => void;
      onMuteToggled?: (cb: (isMuted: boolean) => void) => (() => void);
      getFullscreen?: () => Promise<boolean>;
      setFullscreen?: (fs: boolean) => void;
      toggleFullscreen?: () => void;
      onFullscreenChanged?: (cb: (isFullscreen: boolean) => void) => (() => void);
      getVersion?: () => Promise<string>;
      getPlatform?: () => Promise<string>;
    };
  }
}

export function useGameActivity() {
  const cleanupRef = useRef<Array<() => void>>([]);
  const [showGameActivity, setShowGameActivity] = useState(() => {
    return localStorage.getItem('gratonite_show_game_activity') !== 'false';
  });

  useEffect(() => {
    const desktop = window.gratoniteDesktop;
    if (!desktop?.isDesktop || !desktop.onGameDetected || !desktop.onGameStopped) return;

    // Task #104: Respect game activity toggle
    if (!showGameActivity) {
      desktop.setGameActivityEnabled?.(false);
      return;
    }

    desktop.setGameActivityEnabled?.(true);

    const unsub1 = desktop.onGameDetected((data) => {
      api.users.setActivity({ type: 'PLAYING', name: data.name }).catch(() => {});
    });

    const unsub2 = desktop.onGameStopped(() => {
      api.users.clearActivity().catch(() => {});
    });

    if (unsub1) cleanupRef.current.push(unsub1);
    if (unsub2) cleanupRef.current.push(unsub2);

    return () => {
      cleanupRef.current.forEach(fn => fn());
      cleanupRef.current = [];
    };
  }, [showGameActivity]);

  const toggleGameActivity = (enabled: boolean) => {
    setShowGameActivity(enabled);
    localStorage.setItem('gratonite_show_game_activity', String(enabled));
  };

  return { showGameActivity, toggleGameActivity };
}
