const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal API to the web app
contextBridge.exposeInMainWorld('gratoniteDesktop', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),

  // Flag so the web app knows it's running in Electron
  isDesktop: true,

  // Notification support (Electron handles system notifications)
  sendNotification: (title, body) => {
    new Notification(title, { body });
  },

  // Item 260: Badge count — renderer tells main process about unread count
  setBadgeCount: (count) => {
    ipcRenderer.send('set-badge-count', count);
  },

  // Item 261: Mute state
  getMuteState: () => ipcRenderer.invoke('get-mute-state'),
  setMuteState: (muted) => {
    ipcRenderer.send('set-mute-state', muted);
  },

  // Listen for mute toggle from main process (tray menu or global shortcut)
  onMuteToggled: (callback) => {
    const handler = (_event, isMuted) => callback(isMuted);
    ipcRenderer.on('mute-toggled', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('mute-toggled', handler);
    };
  },
});
