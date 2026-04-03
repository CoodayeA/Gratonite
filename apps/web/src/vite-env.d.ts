/// <reference types="vite/client" />

/** Injected by `apps/desktop/preload.js` when running in Electron */
interface GratoniteDesktopBridge {
  isDesktop: boolean;
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
