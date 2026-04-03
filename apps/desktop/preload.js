const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal API to the web app
contextBridge.exposeInMainWorld('gratoniteDesktop', {
  // App info
  getVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),

  // Flag so the web app knows it's running in Electron
  isDesktop: true,

  // --- B4: OS Accent Color Sync ---
  getSystemAccentColor: () => ipcRenderer.invoke('get-system-accent-color'),

  // --- B5: Taskbar Progress Bar ---
  setProgressBar: (progress) => ipcRenderer.send('set-progress-bar', progress),

  // Sync Windows title bar overlay color with theme
  setTitleBarOverlay: (options) => ipcRenderer.send('set-title-bar-overlay', options),

  // Notification support (Electron handles system notifications)
  sendNotification: (title, body) => {
    new Notification(title, { body });
  },

  // Desktop IPC: report network status to Electron main process
  setNetworkStatus: (online) => ipcRenderer.send('network-status-changed', { online }),

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

  // Game activity detection (Task #104: Rich Presence Integration)
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
  getCurrentGame: () => ipcRenderer.invoke('get-current-game'),
  setGameActivityEnabled: (enabled) => ipcRenderer.send('set-game-activity-enabled', enabled),

  // Task #86: Deep Link Protocol
  onDeepLink: (callback) => {
    const handler = (_event, url) => callback(url);
    ipcRenderer.on('deep-link', handler);
    return () => ipcRenderer.removeListener('deep-link', handler);
  },

  // Task #87: Auto-Update Progress UI
  onUpdateAvailable: (callback) => {
    const handler = (_event, info) => callback(info);
    ipcRenderer.on('update-available', handler);
    return () => ipcRenderer.removeListener('update-available', handler);
  },
  onUpdateDownloadProgress: (callback) => {
    const handler = (_event, progress) => callback(progress);
    ipcRenderer.on('update-download-progress', handler);
    return () => ipcRenderer.removeListener('update-download-progress', handler);
  },
  onUpdateDownloaded: (callback) => {
    const handler = (_event, info) => callback(info);
    ipcRenderer.on('update-downloaded', handler);
    return () => ipcRenderer.removeListener('update-downloaded', handler);
  },
  onUpdateError: (callback) => {
    const handler = (_event, err) => callback(err);
    ipcRenderer.on('update-error', handler);
    return () => ipcRenderer.removeListener('update-error', handler);
  },
  downloadUpdate: () => ipcRenderer.send('update-download'),
  installUpdate: () => ipcRenderer.send('update-install'),
  checkForUpdates: () => ipcRenderer.send('update-check'),

  // Task #88: System Idle Detection
  onSystemIdleChanged: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('system-idle-changed', handler);
    return () => ipcRenderer.removeListener('system-idle-changed', handler);
  },
  setIdleThreshold: (minutes) => ipcRenderer.send('set-idle-threshold', minutes),
  getIdleThreshold: () => ipcRenderer.invoke('get-idle-threshold'),

  // Task #89: Mini Mode
  toggleMiniMode: () => ipcRenderer.send('toggle-mini-mode'),
  exitMiniMode: () => ipcRenderer.send('exit-mini-mode'),
  isMiniMode: () => ipcRenderer.invoke('is-mini-mode'),
  onMiniModeChanged: (callback) => {
    const handler = (_event, active) => callback(active);
    ipcRenderer.on('mini-mode-changed', handler);
    return () => ipcRenderer.removeListener('mini-mode-changed', handler);
  },

  // Task #90: App Menu navigation events
  onNavigate: (callback) => {
    const handler = (_event, route) => callback(route);
    ipcRenderer.on('navigate', handler);
    return () => ipcRenderer.removeListener('navigate', handler);
  },

  // Push-to-Talk global toggle
  registerPushToTalk: (key) => ipcRenderer.send('ptt-register', key),
  unregisterPushToTalk: () => ipcRenderer.send('ptt-unregister'),
  onPttToggle: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('ptt-toggle', handler);
    return () => ipcRenderer.removeListener('ptt-toggle', handler);
  },

  // Desktop screen capture (Electron desktopCapturer)
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),

  // --- Feature #23: Configurable Global Hotkeys ---
  getHotkeys: () => ipcRenderer.invoke('get-hotkeys'),
  setHotkeys: (hotkeys) => ipcRenderer.invoke('set-hotkeys', hotkeys),
  resetHotkeys: () => ipcRenderer.invoke('reset-hotkeys'),
  getDefaultHotkeys: () => ipcRenderer.invoke('get-default-hotkeys'),
  onHotkeyPressed: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('hotkey-pressed', handler);
    return () => ipcRenderer.removeListener('hotkey-pressed', handler);
  },

  // --- Feature #24: System Tray & Minimize-to-Tray ---
  updateTrayBadge: (count) => ipcRenderer.send('update-tray-badge', { count }),
  getMinimizeToTray: () => ipcRenderer.invoke('get-minimize-to-tray'),
  setMinimizeToTray: (value) => ipcRenderer.send('set-minimize-to-tray', value),
  getStartOnLogin: () => ipcRenderer.invoke('get-start-on-login'),
  setStartOnLogin: (value) => ipcRenderer.send('set-start-on-login', value),

  // Deafen state (synced with tray)
  getDeafenState: () => ipcRenderer.invoke('get-deafen-state'),
  setDeafenState: (deafened) => ipcRenderer.send('set-deafen-state', deafened),

  // DND state (synced with tray)
  getDndState: () => ipcRenderer.invoke('get-dnd-state'),
  setDndState: (enabled) => ipcRenderer.send('set-dnd-state', enabled),

  // Task #92: Notification Actions
  showMessageNotification: (data) => ipcRenderer.send('show-message-notification', data),
  onNotificationClicked: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('notification-clicked', handler);
    return () => ipcRenderer.removeListener('notification-clicked', handler);
  },
  onNotificationReply: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('notification-reply', handler);
    return () => ipcRenderer.removeListener('notification-reply', handler);
  },
  onNotificationMarkRead: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('notification-mark-read', handler);
    return () => ipcRenderer.removeListener('notification-mark-read', handler);
  },
});

window.addEventListener('DOMContentLoaded', () => {
  if (process.platform === 'darwin') {
    document.body.classList.add('electron-mac');
  } else if (process.platform === 'win32') {
    document.body.classList.add('electron-win');
  }
});
