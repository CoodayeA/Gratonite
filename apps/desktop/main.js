const { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, globalShortcut } = require('electron');
const path = require('path');

// In production, load from the deployed web app.
// In dev, load from the local Vite dev server.
const DEV_URL = 'http://localhost:5174/app';
const PROD_URL = process.env.GRATONITE_DESKTOP_URL || 'https://gratonite.chat/app';

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

let mainWindow = null;
let tray = null;
let isMuted = false;

// --- Game Activity Detection ---
const knownGames = require('./data/known-games.json');

let currentGame = null;
let gameCheckInterval = null;

function startGameDetection() {
  const { execFile } = require('child_process');

  gameCheckInterval = setInterval(() => {
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'wmic' : 'ps';
    const args = isWin ? ['process', 'get', 'name', '/format:csv'] : ['-eo', 'comm'];

    execFile(cmd, args, { timeout: 5000 }, (err, stdout) => {
      if (err) return;

      const processes = stdout.toLowerCase().split('\n').map(l => l.trim()).filter(Boolean);

      let detectedGame = null;
      for (const game of knownGames) {
        const found = game.processNames.some(pn =>
          processes.some(p => p.includes(pn.toLowerCase()))
        );
        if (found) {
          detectedGame = game;
          break;
        }
      }

      if (detectedGame && (!currentGame || currentGame.displayName !== detectedGame.displayName)) {
        currentGame = { ...detectedGame, startedAt: Date.now() };
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('game-detected', {
            name: detectedGame.displayName,
            startedAt: currentGame.startedAt,
          });
        }
      } else if (!detectedGame && currentGame) {
        const stoppedGame = currentGame;
        setTimeout(() => {
          execFile(cmd, args, { timeout: 5000 }, (err2, stdout2) => {
            if (err2) return;
            const procs2 = stdout2.toLowerCase().split('\n').map(l => l.trim());
            const stillRunning = stoppedGame.processNames.some(pn =>
              procs2.some(p => p.includes(pn.toLowerCase()))
            );
            if (!stillRunning && currentGame && currentGame.displayName === stoppedGame.displayName) {
              currentGame = null;
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('game-stopped');
              }
            }
          });
        }, 10000);
      }
    });
  }, 5000);
}

function stopGameDetection() {
  if (gameCheckInterval) clearInterval(gameCheckInterval);
  gameCheckInterval = null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    title: 'Gratonite',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      backgroundThrottling: false,
      enableBlinkFeatures: 'OverlayScrollbars',
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

  // Fix chat bar button clicks on Windows (overlay/compositing hint)
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(`
      .emoji-picker-container, .sticker-picker-container, .soundboard-container, .poll-modal-container {
        will-change: transform;
        -webkit-transform: translateZ(0);
      }
    `);
  });

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

// Windows GPU performance flags — backdrop-filter and compositing are
// extremely slow on many Intel/AMD integrated GPUs without these.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-features', 'CanvasOopRasterization');
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  registerGlobalShortcuts();
  startGameDetection();

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
  stopGameDetection();
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
    const { dialog } = require('electron');

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-downloaded', (info) => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: `Gratonite ${info.version} is ready to install.`,
        detail: 'Restart Gratonite now to apply the update, or it will install the next time you quit.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
    });

    autoUpdater.on('error', (err) => {
      console.error('Auto-updater error:', err.message);
    });

    app.whenReady().then(() => {
      autoUpdater.checkForUpdates();
    });

    // Check for updates every 4 hours
    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, 4 * 60 * 60 * 1000);
  } catch (e) {
    console.warn('Auto-updater not available:', e.message);
  }
}
