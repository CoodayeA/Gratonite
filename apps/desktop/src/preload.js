const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gratonite', {
  platform: process.platform,
  versions: process.versions,
  updateUrl: process.env.GRATONITE_UPDATE_URL ?? null,
  notify: (payload) => ipcRenderer.invoke('gratonite:notify', payload),
  setBadge: (count) => ipcRenderer.invoke('gratonite:badge', count),
  openExternal: (url) => ipcRenderer.invoke('gratonite:open-external', url),
  checkForUpdates: () => ipcRenderer.invoke('gratonite:check-updates'),
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
