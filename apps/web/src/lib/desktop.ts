type DesktopApi = {
  platform: string;
  versions: Record<string, string>;
  updateUrl: string | null;
  notify: (payload: { title: string; body?: string; route?: string }) => Promise<void> | void;
  setBadge: (count: number) => Promise<void> | void;
  openExternal: (url: string) => Promise<void> | void;
  checkForUpdates: () => Promise<void> | void;
  onDeepLink?: (callback: (url: string) => void) => () => void;
  onNavigate?: (callback: (route: string) => void) => () => void;
};

export function getDesktopApi(): DesktopApi | null {
  const api = (window as any).gratonite as DesktopApi | undefined;
  return api ?? null;
}

export function isDesktop(): boolean {
  return Boolean(getDesktopApi());
}

export function notifyDesktop(payload: { title: string; body?: string; route?: string }) {
  const api = getDesktopApi();
  if (!api) return;
  api.notify(payload);
}

export function onNavigate(callback: (route: string) => void) {
  const api = getDesktopApi();
  if (!api?.onNavigate) return () => {};
  return api.onNavigate(callback);
}

export function setDesktopBadge(count: number) {
  const api = getDesktopApi();
  if (!api) return;
  api.setBadge(count);
}

export function openExternal(url: string) {
  const api = getDesktopApi();
  if (!api) return window.open(url, '_blank', 'noopener');
  api.openExternal(url);
}

export function onDeepLink(callback: (url: string) => void) {
  const api = getDesktopApi();
  if (!api?.onDeepLink) return () => {};
  return api.onDeepLink(callback);
}
