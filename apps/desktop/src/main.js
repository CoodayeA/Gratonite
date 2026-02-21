const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, ipcMain, shell, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const { join, resolve } = require('path');
const { readFileSync, writeFileSync } = require('fs');

const stateFile = () => join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    const raw = readFileSync(stateFile(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { width: 1200, height: 800 };
  }
}

function saveWindowState(win) {
  if (win.isDestroyed()) return;
  const bounds = win.getBounds();
  const state = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    isMaximized: win.isMaximized(),
  };
  writeFileSync(stateFile(), JSON.stringify(state));
}

let mainWindow = null;
let tray = null;
let pendingDeepLink = null;
let loadedAppUrl = null;

function extractDeepLink(argv) {
  return argv.find((arg) => typeof arg === 'string' && arg.startsWith('gratonite://')) ?? null;
}

function handleDeepLink(url) {
  if (!url) return;
  log.info('[DeepLink] received', url);
  if (mainWindow && mainWindow.webContents) {
    if (loadedAppUrl) {
      const targetPath = deeplinkToPath(url);
      if (targetPath) {
        const nextUrl = new URL(targetPath, loadedAppUrl);
        mainWindow.loadURL(nextUrl.toString());
      }
    }
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('gratonite:deeplink', url);
  } else {
    pendingDeepLink = url;
  }
}

function deeplinkToPath(url) {
  if (!url.startsWith('gratonite://')) return null;
  const path = url.replace('gratonite://', '').replace(/^\//, '');
  const parts = path.split('/');
  if (parts[0] === 'invite' && parts[1]) return `/invite/${parts[1]}`;
  if (parts[0] === 'dm' && parts[1]) return `/dm/${parts[1]}`;
  if (parts[0] === 'guild' && parts[1] && parts[2] === 'channel' && parts[3]) {
    return `/guild/${parts[1]}/channel/${parts[3]}`;
  }
  return null;
}

function getUpdateUrl() {
  return process.env.GRATONITE_UPDATE_URL ?? null;
}

function resolveAppUrl() {
  const args = process.argv.slice(1);
  const forceIndex = args.findIndex((arg) => arg === '--force-server');
  if (forceIndex !== -1 && args[forceIndex + 1]) {
    return args[forceIndex + 1];
  }

  if (process.env.GRATONITE_DESKTOP_URL) {
    return process.env.GRATONITE_DESKTOP_URL;
  }

  return null;
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAK0lEQVR4AWP4//8/AxJgYGBgYGBg4P///4GJgYGBgYGBgYGBgYEAAN8uCKv9JZ0uAAAAAElFTkSuQmCC',
  );
  tray = new Tray(icon);
  const template = [
    {
      label: 'Show Gratonite',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
  ];

  if (getUpdateUrl()) {
    template.push({
      label: 'Check for Updates',
      click: () => autoUpdater.checkForUpdates().catch((err) => log.error('[AutoUpdater] check failed', err)),
    });
  }

  template.push(
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  );

  const menu = Menu.buildFromTemplate(template);
  tray.setToolTip('Gratonite');
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  const state = loadWindowState();
  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b0f15',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (state.isMaximized) mainWindow.maximize();

  const appUrl = resolveAppUrl();
  if (appUrl) {
    loadedAppUrl = appUrl;
    mainWindow.loadURL(appUrl);
  } else {
    loadedAppUrl = null;
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingDeepLink) {
      mainWindow.webContents.send('gratonite:deeplink', pendingDeepLink);
      pendingDeepLink = null;
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (event) => {
    if (tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('resize', () => saveWindowState(mainWindow));
  mainWindow.on('move', () => saveWindowState(mainWindow));
  mainWindow.on('maximize', () => saveWindowState(mainWindow));
  mainWindow.on('unmaximize', () => saveWindowState(mainWindow));
}

function configureAutoUpdates() {
  const updateUrl = getUpdateUrl();
  if (!updateUrl) return;

  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;
  autoUpdater.setFeedURL({ url: updateUrl });

  autoUpdater.on('error', (err) => {
    log.error('[AutoUpdater] error', err);
  });

  autoUpdater.on('update-available', () => {
    log.info('[AutoUpdater] update available');
  });

  autoUpdater.on('update-not-available', () => {
    log.info('[AutoUpdater] update not available');
  });

  autoUpdater.checkForUpdates().catch((err) => {
    log.error('[AutoUpdater] check failed', err);
  });
}

function configureIpc() {
  ipcMain.handle('gratonite:notify', (_event, payload) => {
    if (!payload || !payload.title) return;
    try {
      const notification = new Notification({
        title: payload.title,
        body: payload.body ?? '',
      });
      notification.on('click', () => {
        if (payload.route && mainWindow) {
          mainWindow.webContents.send('gratonite:navigate', payload.route);
          mainWindow.show();
          mainWindow.focus();
        }
      });
      notification.show();
    } catch (err) {
      log.error('[Notify] failed', err);
    }
  });

  ipcMain.handle('gratonite:badge', (_event, count) => {
    if (typeof count !== 'number') return;
    app.setBadgeCount(Math.max(0, count));
  });

  ipcMain.handle('gratonite:open-external', (_event, url) => {
    if (typeof url !== 'string') return;
    shell.openExternal(url);
  });

  ipcMain.handle('gratonite:check-updates', () => {
    if (!getUpdateUrl()) return;
    return autoUpdater.checkForUpdates();
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const url = extractDeepLink(argv);
    if (url) handleDeepLink(url);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.on('will-finish-launching', () => {
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });
});

app.whenReady().then(() => {
  app.setAppUserModelId('com.gratonite.desktop');
  if (process.defaultApp) {
    const appPath = resolve(process.argv[1]);
    app.setAsDefaultProtocolClient('gratonite', process.execPath, [appPath]);
  } else {
    app.setAsDefaultProtocolClient('gratonite');
  }

  const initialDeepLink = extractDeepLink(process.argv);
  if (initialDeepLink) {
    pendingDeepLink = initialDeepLink;
  }
  if (process.platform !== 'linux') {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  createWindow();
  createTray();
  configureIpc();
  configureAutoUpdates();

  globalShortcut.register('CommandOrControl+Shift+G', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  tray = null;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
