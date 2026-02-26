const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gratonite', {
  platform: process.platform,
  versions: process.versions,
  updateUrl: process.env.GRATONITE_UPDATE_URL ?? null,
  notify: (payload) => ipcRenderer.invoke('gratonite:notify', payload),
  setBadge: (count) => ipcRenderer.invoke('gratonite:badge', count),
  openExternal: (url) => ipcRenderer.invoke('gratonite:open-external', url),
  checkForUpdates: () => ipcRenderer.invoke('gratonite:check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('gratonite:download-update'),
  installUpdate: () => ipcRenderer.invoke('gratonite:install-update'),
  retryConnection: () => ipcRenderer.invoke('gratonite:retry-connection'),
  onUpdateAvailable: (callback) => {
    const handler = (_event, info) => callback(info);
    ipcRenderer.on('gratonite:update-available', handler);
    return () => ipcRenderer.removeListener('gratonite:update-available', handler);
  },
  onUpdateProgress: (callback) => {
    const handler = (_event, progress) => callback(progress);
    ipcRenderer.on('gratonite:update-progress', handler);
    return () => ipcRenderer.removeListener('gratonite:update-progress', handler);
  },
  onUpdateReady: (callback) => {
    const handler = (_event, info) => callback(info);
    ipcRenderer.on('gratonite:update-ready', handler);
    return () => ipcRenderer.removeListener('gratonite:update-ready', handler);
  },
  onDeepLink: (callback) => {
    const handler = (_event, url) => callback(url);
    ipcRenderer.on('gratonite:deeplink', handler);
    return () => ipcRenderer.removeListener('gratonite:deeplink', handler);
  },
  onNavigate: (callback) => {
    const handler = (_event, route) => callback(route);
    ipcRenderer.on('gratonite:navigate', handler);
    return () => ipcRenderer.removeListener('gratonite:navigate', handler);
  },
});
