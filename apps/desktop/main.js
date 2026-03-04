const { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, globalShortcut } = require('electron');
const path = require('path');

// In production, load from the deployed web app.
// In dev, load from the local Vite dev server.
const DEV_URL = 'http://localhost:5174/app';
const PROD_URL = process.env.GRATONITE_DESKTOP_URL || 'https://app.gratonite.chat';

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

let mainWindow = null;
let tray = null;
let isMuted = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    title: 'Gratonite',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
    show: false, // Show after ready-to-show to prevent flash
  });

  // Show window when content is ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the app
  const url = isDev ? DEV_URL : PROD_URL;
  mainWindow.loadURL(url);

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Open DevTools in dev mode
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // On macOS, clicking the dock icon re-opens the window
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// --- Item 259: System Tray Icon with Context Menu ---
function createTray() {
  // macOS uses Template images (monochrome, auto-adapts to dark/light menu bar)
  // Windows/Linux use the colored version
  const trayIconName = process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png';
  const trayIconPath = path.join(__dirname, 'assets', trayIconName);

  const icon = nativeImage.createFromPath(trayIconPath);
  // Mark as template for macOS (auto dark/light adaptation)
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);
  tray.setToolTip('Gratonite');

  updateTrayMenu();

  // Click on tray icon shows/focuses the window
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Gratonite',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    {
      label: 'Mute Notifications',
      type: 'checkbox',
      checked: isMuted,
      click: (menuItem) => {
        isMuted = menuItem.checked;
        // Notify renderer process of mute state change
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mute-toggled', isMuted);
        }
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
}

// --- Item 260: Notification Badge on Dock/Taskbar ---
function updateBadgeCount(count) {
  if (process.platform === 'darwin') {
    // macOS: dock badge
    app.setBadgeCount(count);
  } else if (process.platform === 'win32' && mainWindow) {
    // Windows: overlay icon on taskbar
    if (count > 0) {
      // Create a small badge overlay with the count
      const badgeIcon = createBadgeOverlay(count);
      mainWindow.setOverlayIcon(badgeIcon, `${count} unread notifications`);
    } else {
      mainWindow.setOverlayIcon(null, '');
    }
  }
  // Also update tray tooltip
  if (tray) {
    tray.setToolTip(count > 0 ? `Gratonite (${count} unread)` : 'Gratonite');
  }
}

// Creates a small numbered badge overlay for Windows taskbar
function createBadgeOverlay(count) {
  const size = 16;
  // Use a canvas-like approach via nativeImage
  // For simplicity, create a red dot; full number rendering would need a canvas lib
  const canvas = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const idx = (y * size + x) * 4;
      if (dist <= radius) {
        // Red circle (RGBA)
        canvas[idx] = 220;     // R
        canvas[idx + 1] = 50;  // G
        canvas[idx + 2] = 50;  // B
        canvas[idx + 3] = 255; // A
      } else {
        canvas[idx + 3] = 0;   // transparent
      }
    }
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

// --- Item 261: Global Keyboard Shortcut for Mute ---
function registerGlobalShortcuts() {
  // CmdOrCtrl+Shift+M to toggle mute
  const ret = globalShortcut.register('CmdOrCtrl+Shift+M', () => {
    isMuted = !isMuted;
    // Notify renderer process
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mute-toggled', isMuted);
    }
    // Update tray menu checkbox
    updateTrayMenu();
  });

  if (!ret) {
    console.warn('Failed to register global shortcut CmdOrCtrl+Shift+M');
  }
}

// Single instance lock — prevent multiple windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerGlobalShortcuts();

  // macOS: re-create window when dock icon is clicked
  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('will-quit', () => {
  // Unregister all global shortcuts when the app is about to quit
  globalShortcut.unregisterAll();
});

// IPC handlers for the renderer
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:platform', () => process.platform);

// Item 260: Renderer sends unread count updates
ipcMain.on('set-badge-count', (_event, count) => {
  updateBadgeCount(count);
});

// Item 261: Renderer can query or set mute state
ipcMain.handle('get-mute-state', () => isMuted);
ipcMain.on('set-mute-state', (_event, muted) => {
  isMuted = muted;
  updateTrayMenu();
});

// Auto-update (production only)
if (!isDev) {
  try {
    const { autoUpdater } = require('electron-updater');

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    app.whenReady().then(() => {
      autoUpdater.checkForUpdatesAndNotify();
    });

    // Check for updates every 4 hours
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 4 * 60 * 60 * 1000);
  } catch (e) {
    // electron-updater may not be available in all environments
    console.warn('Auto-updater not available:', e.message);
  }
}
