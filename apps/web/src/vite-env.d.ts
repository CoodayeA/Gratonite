/// <reference types="vite/client" />

/** Injected by `apps/desktop/preload.js` when running in Electron */
interface GratoniteDesktopBridge {
  isDesktop: boolean;
  onGameDetected?: (cb: (data: { name: string; startedAt: number }) => void) => (() => void);
  onGameStopped?: (cb: () => void) => (() => void);
  getCurrentGame?: () => Promise<{ name: string; startedAt: number } | null>;
  setGameActivityEnabled?: (enabled: boolean) => void;
  onDeepLink?: (cb: (url: string) => void) => (() => void);
  onUpdateAvailable?: (cb: (info: { version: string; releaseNotes: string }) => void) => (() => void);
  onUpdateDownloadProgress?: (cb: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => (() => void);
  onUpdateDownloaded?: (cb: (info: { version: string; releaseNotes: string }) => void) => (() => void);
  onUpdateError?: (cb: (err: { message: string }) => void) => (() => void);
  downloadUpdate?: () => void;
  installUpdate?: () => void;
  checkForUpdates?: () => void;
  onSystemIdleChanged?: (cb: (data: { idle: boolean; idleSeconds: number }) => void) => (() => void);
  setIdleThreshold?: (minutes: number) => void;
  getIdleThreshold?: () => Promise<number>;
  toggleMiniMode?: () => void;
  exitMiniMode?: () => void;
  isMiniMode?: () => Promise<boolean>;
  onMiniModeChanged?: (cb: (active: boolean) => void) => (() => void);
  onNavigate?: (cb: (route: string) => void) => (() => void);
  showMessageNotification?: (data: { title: string; body: string; channelId: string; messageId?: string; guildId?: string }) => void;
  onNotificationClicked?: (cb: (data: { channelId: string; guildId?: string; focusInput?: boolean }) => void) => (() => void);
  onNotificationReply?: (cb: (data: { channelId: string; messageId?: string; reply: string }) => void) => (() => void);
  onNotificationMarkRead?: (cb: (data: { channelId: string }) => void) => (() => void);
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
  registerPushToTalk?: (key: string) => void;
  unregisterPushToTalk?: () => void;
  onPttToggle?: (cb: () => void) => (() => void);
  getScreenSources?: () => Promise<
    Array<{
      id: string;
      name: string;
      thumbnailDataUrl: string;
      displayId: string;
      appIconDataUrl: string | null;
    }>
  >;
}

interface Window {
  gratoniteDesktop?: GratoniteDesktopBridge;
  Sentry?: {
    addBreadcrumb?: (breadcrumb: {
      category?: string;
      message?: string;
      level?: string;
      data?: Record<string, unknown>;
    }) => void;
  };
}
