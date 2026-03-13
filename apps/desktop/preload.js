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
    return () => {
      ipcRenderer.removeListener('mute-toggled', handler);
    };
  },

  // Fullscreen
  getFullscreen: () => ipcRenderer.invoke('get-fullscreen'),
  setFullscreen: (fs) => ipcRenderer.send('set-fullscreen', fs),
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  onFullscreenChanged: (callback) => {
    const handler = (_event, isFullscreen) => callback(isFullscreen);
    ipcRenderer.on('fullscreen-changed', handler);
    return () => {
      ipcRenderer.removeListener('fullscreen-changed', handler);
    };
  },

  // Game activity detection
  onGameDetected: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('game-detected', handler);
    return () => ipcRenderer.removeListener('game-detected', handler);
  },
  onGameStopped: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('game-stopped', handler);
    return () => ipcRenderer.removeListener('game-stopped', handler);
  },
});

window.addEventListener('DOMContentLoaded', () => {
  if (process.platform === 'darwin') {
    document.body.classList.add('electron-mac');
  } else if (process.platform === 'win32') {
    document.body.classList.add('electron-win');
  }
});
