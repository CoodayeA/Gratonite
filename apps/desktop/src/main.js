const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut } = require('electron');
const { join } = require('path');
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
  const menu = Menu.buildFromTemplate([
    {
      label: 'Show Gratonite',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
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
    mainWindow.loadURL(appUrl);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

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

app.whenReady().then(() => {
  if (process.platform !== 'linux') {
    app.setLoginItemSettings({ openAtLogin: true });
  }

  createWindow();
  createTray();

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
