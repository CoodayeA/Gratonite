const { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, globalShortcut, Notification, crashReporter, powerMonitor, screen, dialog, desktopCapturer, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');

// In production, load from the deployed web app.
// In dev, load from the local Vite dev server.
const DEV_URL = 'http://localhost:5174/app';
const PROD_URL = process.env.GRATONITE_DESKTOP_URL || 'https://gratonite.chat/app';

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

// --- Extracted magic numbers ---
const IDLE_CHECK_INTERVAL_MS = 30_000;
const GAME_CHECK_INTERVAL_MS = 5_000;
const GAME_STOP_VERIFY_DELAY_MS = 10_000;
const PROCESS_EXEC_TIMEOUT_MS = 5_000;
const WINDOW_STATE_SAVE_DEBOUNCE_MS = 500;
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

let mainWindow = null;
let miniWindow = null;
let tray = null;
let isMuted = false;
let isDeafened = false;
let isDndEnabled = false;
let minimizeToTray = true;
let startOnLogin = false;
let trayUnreadCount = 0;

// --- Task #91: Crash Reporting ---
crashReporter.start({
  productName: 'Gratonite',
  submitURL: 'https://api.gratonite.chat/crash-reports',
  uploadToServer: !isDev,
  compress: true,
});

const crashLogDir = path.join(app.getPath('userData'), 'crashes');

function ensureCrashLogDir() {
  try { fs.mkdirSync(crashLogDir, { recursive: true }); } catch {}
}

function writeCrashLog(type, error) {
  ensureCrashLogDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(crashLogDir, `${type}-${timestamp}.log`);
  const content = `${type}: ${new Date().toISOString()}\n${error.stack || error.message || String(error)}\n`;
  try { fs.writeFileSync(logFile, content); } catch {}
  rotateCrashLogs();
}

function rotateCrashLogs() {
  try {
    const files = fs.readdirSync(crashLogDir)
      .filter(f => f.endsWith('.log'))
      .map(f => ({ name: f, time: fs.statSync(path.join(crashLogDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);
    for (const file of files.slice(10)) {
      fs.unlinkSync(path.join(crashLogDir, file.name));
    }
  } catch {}
}

process.on('uncaughtException', (error) => {
  writeCrashLog('uncaughtException', error);
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  writeCrashLog('unhandledRejection', error);
  console.error('Unhandled rejection:', error);
});

// --- Task #44: Window State Persistence ---
const windowStateFile = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    const data = JSON.parse(fs.readFileSync(windowStateFile, 'utf8'));
    // Validate bounds are on a visible display
    const displays = screen.getAllDisplays();
    const onScreen = displays.some(d => {
      const b = d.bounds;
      return data.x >= b.x - 100 && data.x < b.x + b.width + 100 &&
             data.y >= b.y - 100 && data.y < b.y + b.height + 100;
    });
    if (onScreen && data.width >= 940 && data.height >= 600) {
      return data;
    }
  } catch {}
  return null;
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const isMaximized = mainWindow.isMaximized();
  const isFullScreen = mainWindow.isFullScreen();
  // Only save normal bounds (not maximized/fullscreen dimensions)
  const bounds = isMaximized || isFullScreen ? (mainWindow._lastNormalBounds || mainWindow.getBounds()) : mainWindow.getBounds();
  const state = { ...bounds, isMaximized, isFullScreen };
  try { fs.writeFileSync(windowStateFile, JSON.stringify(state)); } catch {}
}

let saveStateTimeout = null;
function debouncedSaveWindowState() {
  if (saveStateTimeout) clearTimeout(saveStateTimeout);
  saveStateTimeout = setTimeout(saveWindowState, WINDOW_STATE_SAVE_DEBOUNCE_MS);
}

// --- Feature #23: Desktop Global Hotkeys Configuration ---
const hotkeysConfigFile = path.join(app.getPath('userData'), 'hotkeys.json');

const DEFAULT_HOTKEYS = {
  'toggle-mute': 'CmdOrCtrl+Shift+M',
  'toggle-deafen': 'CmdOrCtrl+Shift+D',
  'push-to-talk': '',
  'toggle-dnd': 'CmdOrCtrl+Shift+N',
  'quick-switch': 'CmdOrCtrl+K',
};

function loadHotkeysConfig() {
  try {
    const data = JSON.parse(fs.readFileSync(hotkeysConfigFile, 'utf8'));
    // Merge with defaults so new keys are always present
    return { ...DEFAULT_HOTKEYS, ...data };
  } catch {}
  return { ...DEFAULT_HOTKEYS };
}

function saveHotkeysConfig(config) {
  try { fs.writeFileSync(hotkeysConfigFile, JSON.stringify(config, null, 2)); } catch {}
}

let currentHotkeys = loadHotkeysConfig();

function hotkeyAction(action) {
  switch (action) {
    case 'toggle-mute':
      isMuted = !isMuted;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hotkey-pressed', { action: 'toggle-mute', state: isMuted });
        mainWindow.webContents.send('mute-toggled', isMuted);
      }
      updateTrayMenu();
      break;
    case 'toggle-deafen':
      isDeafened = !isDeafened;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hotkey-pressed', { action: 'toggle-deafen', state: isDeafened });
      }
      updateTrayMenu();
      break;
    case 'push-to-talk':
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hotkey-pressed', { action: 'push-to-talk' });
      }
      break;
    case 'toggle-dnd':
      isDndEnabled = !isDndEnabled;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hotkey-pressed', { action: 'toggle-dnd', state: isDndEnabled });
      }
      updateTrayMenu();
      break;
    case 'quick-switch':
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('hotkey-pressed', { action: 'quick-switch' });
      }
      break;
  }
}

function registerConfigurableHotkeys() {
  // Unregister all first, then re-register
  globalShortcut.unregisterAll();

  for (const [action, accelerator] of Object.entries(currentHotkeys)) {
    if (!accelerator) continue; // Skip empty bindings (e.g. push-to-talk with no default)
    try {
      const success = globalShortcut.register(accelerator, () => hotkeyAction(action));
      if (!success) {
        console.warn(`Failed to register hotkey ${accelerator} for ${action}`);
      }
    } catch (err) {
      console.warn(`Error registering hotkey ${accelerator} for ${action}:`, err.message);
    }
  }
}

// --- Feature #24: Minimize-to-Tray Settings ---
const traySettingsFile = path.join(app.getPath('userData'), 'tray-settings.json');

function loadTraySettings() {
  try {
    const data = JSON.parse(fs.readFileSync(traySettingsFile, 'utf8'));
    if (typeof data.minimizeToTray === 'boolean') minimizeToTray = data.minimizeToTray;
    if (typeof data.startOnLogin === 'boolean') startOnLogin = data.startOnLogin;
  } catch {}
}

function saveTraySettings() {
  try { fs.writeFileSync(traySettingsFile, JSON.stringify({ minimizeToTray, startOnLogin }, null, 2)); } catch {}
}

loadTraySettings();

// --- Task #88: System Idle Detection ---
let idleCheckInterval = null;
let idleThresholdMinutes = 5;
let wasIdle = false;
let manualStatus = null; // track manual DND/invisible so we don't override

function startIdleDetection() {
  idleCheckInterval = setInterval(() => {
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const isIdle = idleSeconds >= idleThresholdMinutes * 60;

    if (isIdle && !wasIdle) {
      wasIdle = true;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('system-idle-changed', { idle: true, idleSeconds });
      }
    } else if (!isIdle && wasIdle) {
      wasIdle = false;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('system-idle-changed', { idle: false, idleSeconds });
      }
    }
  }, IDLE_CHECK_INTERVAL_MS);
}

function stopIdleDetection() {
  if (idleCheckInterval) clearInterval(idleCheckInterval);
  idleCheckInterval = null;
}

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

    execFile(cmd, args, { timeout: PROCESS_EXEC_TIMEOUT_MS }, (err, stdout) => {
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
          execFile(cmd, args, { timeout: PROCESS_EXEC_TIMEOUT_MS }, (err2, stdout2) => {
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
        }, GAME_STOP_VERIFY_DELAY_MS);
      }
    });
  }, GAME_CHECK_INTERVAL_MS);
}

function stopGameDetection() {
  if (gameCheckInterval) clearInterval(gameCheckInterval);
  gameCheckInterval = null;
}

function createWindow() {
  // Task #44: Restore saved window state
  const savedState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: savedState ? savedState.width : 1280,
    height: savedState ? savedState.height : 800,
    x: savedState ? savedState.x : undefined,
    y: savedState ? savedState.y : undefined,
    minWidth: 940,
    minHeight: 600,
    title: 'Gratonite',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset'
      : process.platform === 'win32' ? 'hidden'
      : 'default',
    ...(process.platform === 'win32' && {
      titleBarOverlay: {
        color: '#111214',
        symbolColor: '#ffffff',
        height: 36,
      },
    }),
    trafficLightPosition: { x: 12, y: 12 },
    fullscreenable: true,
    backgroundColor: '#111214',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
      backgroundThrottling: false,
      enableBlinkFeatures: 'OverlayScrollbars',
      v8CacheOptions: 'bypassHeatCheck',
    },
    show: false, // Show after ready-to-show to prevent flash
  });

  // Show window when content is ready; restore maximized state
  mainWindow.once('ready-to-show', () => {
    if (savedState && savedState.isMaximized) {
      mainWindow.maximize();
    }
    mainWindow.show();
  });

  // Task #44: Track normal bounds and save on changes (debounced)
  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
      mainWindow._lastNormalBounds = mainWindow.getBounds();
    }
    debouncedSaveWindowState();
  });
  mainWindow.on('move', () => {
    if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
      mainWindow._lastNormalBounds = mainWindow.getBounds();
    }
    debouncedSaveWindowState();
  });
  mainWindow.on('maximize', debouncedSaveWindowState);
  mainWindow.on('unmaximize', debouncedSaveWindowState);

  // --- B1: Splash Screen ---
  // Load splash first, then navigate to the real app URL
  let splashLoaded = false;
  mainWindow.loadFile(path.join(__dirname, 'splash.html'));

  const url = isDev ? DEV_URL : PROD_URL;

  // Fix chat bar button clicks on Windows (overlay/compositing hint)
  mainWindow.webContents.on('did-finish-load', () => {
    if (!splashLoaded) {
      splashLoaded = true;
      mainWindow.loadURL(url);
      return;
    }
    mainWindow.webContents.insertCSS(`
      .emoji-picker-container, .sticker-picker-container,
      .soundboard-container, .poll-modal-container,
      .app-sidebar, .channel-list, .member-list,
      .message-list, .chat-input-container,
      .modal-overlay, .context-menu {
        will-change: transform;
        -webkit-transform: translateZ(0);
      }
      .message-list, .channel-list, .member-list {
        scroll-behavior: smooth;
      }
    `);
  });

  // --- B2: Crash / Load Failure Handler ---
  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription) => {
    const safeDesc = (errorDescription || 'Could not reach Gratonite').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const retryUrl = isDev ? DEV_URL : PROD_URL;
    mainWindow.loadURL(`data:text/html,
      <html>
      <head><style>
        body { background: #111214; color: #fff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
        h1 { font-size: 24px; margin-bottom: 8px; }
        p { color: #888; margin-bottom: 24px; }
        button { background: #6c63ff; color: #fff; border: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; cursor: pointer; }
        button:hover { opacity: 0.9; }
      </style></head>
      <body>
        <h1>Connection Failed</h1>
        <p>${safeDesc}</p>
        <button onclick="location.href='${encodeURI(retryUrl)}'">Retry</button>
      </body>
      </html>
    `);
  });

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('Render process gone:', details.reason);
    mainWindow.reload();
  });

  // Task #45: Native Context Menus
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menuTemplate = [];

    // Spell check suggestions
    if (params.misspelledWord && params.dictionarySuggestions.length > 0) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
        menuTemplate.push({
          label: suggestion,
          click: () => mainWindow.webContents.replaceMisspelling(suggestion),
        });
      }
      menuTemplate.push({ type: 'separator' });
    }

    // Link context
    if (params.linkURL) {
      menuTemplate.push(
        { label: 'Open Link in Browser', click: () => shell.openExternal(params.linkURL) },
        { label: 'Copy Link', click: () => { require('electron').clipboard.writeText(params.linkURL); } },
        { type: 'separator' },
      );
    }

    // Image context
    if (params.hasImageContents) {
      menuTemplate.push(
        { label: 'Copy Image', click: () => mainWindow.webContents.copyImageAt(params.x, params.y) },
        { label: 'Save Image As...', click: () => {
          const { dialog: dlg } = require('electron');
          const ext = path.extname(new URL(params.srcURL).pathname) || '.png';
          dlg.showSaveDialog(mainWindow, {
            defaultPath: `image${ext}`,
            filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
          }).then(({ filePath }) => {
            if (filePath) {
              const { net } = require('electron');
              const request = net.request(params.srcURL);
              request.on('response', (response) => {
                const chunks = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', () => {
                  fs.writeFileSync(filePath, Buffer.concat(chunks));
                });
              });
              request.end();
            }
          });
        }},
        { label: 'Open Image in Browser', click: () => shell.openExternal(params.srcURL) },
        { type: 'separator' },
      );
    }

    // Text editing context
    if (params.isEditable) {
      menuTemplate.push(
        { label: 'Undo', role: 'undo', enabled: params.editFlags.canUndo },
        { label: 'Redo', role: 'redo', enabled: params.editFlags.canRedo },
        { type: 'separator' },
        { label: 'Cut', role: 'cut', enabled: params.editFlags.canCut },
        { label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy },
        { label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste },
        { label: 'Select All', role: 'selectAll', enabled: params.editFlags.canSelectAll },
      );
    } else if (params.selectionText) {
      menuTemplate.push(
        { label: 'Copy', role: 'copy' },
        { label: 'Select All', role: 'selectAll' },
      );
    }

    if (menuTemplate.length > 0) {
      const menu = Menu.buildFromTemplate(menuTemplate);
      menu.popup({ window: mainWindow });
    }
  });

  // F11 fullscreen toggle
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown' && !input.alt && !input.control && !input.meta && !input.shift) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
    // Prevent accidental reload in production
    if (!isDev && input.type === 'keyDown') {
      if ((input.control || input.meta) && input.key.toLowerCase() === 'r') {
        event.preventDefault();
      }
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        event.preventDefault();
      }
    }
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

  // Fullscreen state events — notify renderer
  mainWindow.on('enter-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('fullscreen-changed', true);
    }
  });
  mainWindow.on('leave-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('fullscreen-changed', false);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // On macOS, clicking the dock icon re-opens the window
  mainWindow.on('close', (event) => {
    // Task #44: Save state before closing
    saveWindowState();
    // Feature #24: Minimize to tray on all platforms (if enabled)
    if (!app.isQuitting && minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

// --- Task #89: Mini Mode ---
function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.focus();
    return;
  }

  miniWindow = new BrowserWindow({
    width: 320,
    height: 400,
    minWidth: 280,
    minHeight: 300,
    maxWidth: 480,
    maxHeight: 600,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    transparent: false,
    backgroundColor: '#111214',
    title: 'Gratonite Mini',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  const miniUrl = isDev ? `${DEV_URL}/mini-mode` : `${PROD_URL}/mini-mode`;
  miniWindow.loadURL(miniUrl);

  miniWindow.on('closed', () => {
    miniWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mini-mode-changed', false);
    }
  });

  // Hide main window when entering mini mode
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mini-mode-changed', true);
  }
}

function closeMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.close();
    miniWindow = null;
  }
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
  const unreadLabel = trayUnreadCount > 0 ? ` (${trayUnreadCount} unread)` : '';
  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Open Gratonite${unreadLabel}`,
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Mute',
      type: 'checkbox',
      checked: isMuted,
      click: (menuItem) => {
        isMuted = menuItem.checked;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mute-toggled', isMuted);
          mainWindow.webContents.send('hotkey-pressed', { action: 'toggle-mute', state: isMuted });
        }
        updateTrayMenu();
      },
    },
    {
      label: 'Deafen',
      type: 'checkbox',
      checked: isDeafened,
      click: (menuItem) => {
        isDeafened = menuItem.checked;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('hotkey-pressed', { action: 'toggle-deafen', state: isDeafened });
        }
        updateTrayMenu();
      },
    },
    {
      label: 'Do Not Disturb',
      type: 'checkbox',
      checked: isDndEnabled,
      click: (menuItem) => {
        isDndEnabled = menuItem.checked;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('hotkey-pressed', { action: 'toggle-dnd', state: isDndEnabled });
        }
        updateTrayMenu();
      },
    },
    { type: 'separator' },
    // Task #89: Mini Mode toggle in tray
    {
      label: 'Mini Mode',
      type: 'checkbox',
      checked: !!(miniWindow && !miniWindow.isDestroyed()),
      click: (menuItem) => {
        if (menuItem.checked) {
          createMiniWindow();
        } else {
          closeMiniWindow();
        }
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

// --- Item 261 + Feature #23: Global Keyboard Shortcuts (configurable) ---
// registerGlobalShortcuts now delegates to registerConfigurableHotkeys (Feature #23)
function registerGlobalShortcuts() {
  registerConfigurableHotkeys();
}

// --- Task #86: Deep Link Protocol ---
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('gratonite', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('gratonite');
}

function handleDeepLink(url) {
  if (!url || !url.startsWith('gratonite://')) return;
  // Wait for window to be ready
  const sendToRenderer = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('deep-link', url);
      mainWindow.show();
      mainWindow.focus();
    }
  };
  if (mainWindow) {
    sendToRenderer();
  } else {
    // Window not created yet — queue for when ready
    app.once('browser-window-created', () => {
      setTimeout(sendToRenderer, 1000);
    });
  }
}

// Single instance lock — prevent multiple windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  // Task #86: On Windows/Linux, second-instance passes the deep link URL
  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // The deep link URL is typically the last argument
    const deepLinkUrl = commandLine.find(arg => arg.startsWith('gratonite://'));
    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
    }
  });
}

// Task #86: On macOS, open-url event is used for protocol handler
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// GPU & rendering performance flags (cross-platform)
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-features',
  'CanvasOopRasterization,EnableDrDc,VaapiVideoDecoder,VaapiVideoEncoder'
);
app.commandLine.appendSwitch('enable-smooth-scrolling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('force-gpu-mem-available-mb', '512');

// --- Task #90: App Menu Bar ---
function createAppMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    // macOS app menu
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Settings', accelerator: 'Cmd+,', click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('navigate', '/app/settings');
        }},
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    // File
    {
      label: 'File',
      submenu: [
        { label: 'New Server', accelerator: 'CmdOrCtrl+N', click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('navigate', '/app/create-server');
        }},
        ...(!isMac ? [
          { type: 'separator' },
          { label: 'Settings', accelerator: 'Ctrl+,', click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('navigate', '/app/settings');
          }},
          { type: 'separator' },
          { role: 'quit' },
        ] : [
          { type: 'separator' },
          { role: 'close' },
        ]),
      ],
    },
    // Edit
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' },
        ]),
      ],
    },
    // View
    {
      label: 'View',
      submenu: [
        ...(isDev ? [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
        ] : []),
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Mini Mode', accelerator: 'CmdOrCtrl+Shift+K', click: () => {
          if (miniWindow && !miniWindow.isDestroyed()) {
            closeMiniWindow();
          } else {
            createMiniWindow();
          }
          updateTrayMenu();
        }},
      ],
    },
    // Window (macOS)
    ...(isMac ? [{
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    }] : []),
    // Help
    {
      label: 'Help',
      submenu: [
        { label: 'About Gratonite', click: () => {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'About Gratonite',
            message: `Gratonite v${app.getVersion()}`,
            detail: 'A modern chat platform.\nhttps://gratonite.chat',
          });
        }},
        { label: 'Check for Updates', click: () => {
          if (!isDev) {
            try {
              const { autoUpdater } = require('electron-updater');
              autoUpdater.checkForUpdates();
            } catch {}
          }
        }},
        { type: 'separator' },
        { label: 'Report a Bug', click: () => shell.openExternal('https://gratonite.chat/feedback') },
        { label: 'Visit Website', click: () => shell.openExternal('https://gratonite.chat') },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createAppMenu();
  createWindow();
  createTray();
  registerGlobalShortcuts();
  startGameDetection();
  startIdleDetection();

  // Handle deep link from initial launch (macOS)
  const launchUrl = process.argv.find(arg => arg.startsWith('gratonite://'));
  if (launchUrl) handleDeepLink(launchUrl);

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
  // Feature #24: Don't quit if minimize-to-tray is enabled (tray stays alive)
  if (process.platform !== 'darwin' && !minimizeToTray) {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopGameDetection();
  stopIdleDetection();
  saveWindowState();
});

app.on('will-quit', () => {
  // Unregister all global shortcuts when the app is about to quit
  globalShortcut.unregisterAll();
});

// IPC handlers for the renderer
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:platform', () => process.platform);

// --- B4: OS Accent Color Sync ---
ipcMain.handle('get-system-accent-color', () => {
  try { return '#' + systemPreferences.getAccentColor().slice(0, 6); } catch { return null; }
});

// --- B5: Taskbar Progress Bar ---
ipcMain.on('set-progress-bar', (_event, progress) => {
  if (mainWindow) mainWindow.setProgressBar(progress);
});

// Sync Windows title bar overlay color with theme
ipcMain.on('set-title-bar-overlay', (_event, options) => {
  if (mainWindow && process.platform === 'win32') {
    try { mainWindow.setTitleBarOverlay(options); } catch {}
  }
});

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

// Fullscreen IPC
ipcMain.handle('get-fullscreen', () => mainWindow ? mainWindow.isFullScreen() : false);
ipcMain.on('set-fullscreen', (_event, value) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setFullScreen(value);
  }
});
ipcMain.on('toggle-fullscreen', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
});

// --- Task #88: Idle detection IPC ---
ipcMain.on('set-idle-threshold', (_event, minutes) => {
  if (typeof minutes === 'number' && minutes >= 1 && minutes <= 60) {
    idleThresholdMinutes = minutes;
  }
});
ipcMain.handle('get-idle-threshold', () => idleThresholdMinutes);

// --- Task #89: Mini mode IPC ---
ipcMain.on('toggle-mini-mode', () => {
  if (miniWindow && !miniWindow.isDestroyed()) {
    closeMiniWindow();
  } else {
    createMiniWindow();
  }
  updateTrayMenu();
});
ipcMain.on('exit-mini-mode', () => {
  closeMiniWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
  updateTrayMenu();
});
ipcMain.handle('is-mini-mode', () => !!(miniWindow && !miniWindow.isDestroyed()));

// --- Push-to-Talk Global Toggle (CmdOrCtrl+Shift+T) ---
let pttKey = 'CmdOrCtrl+Shift+T'; // Default PTT toggle key
let pttRegistered = false;

ipcMain.on('ptt-register', (_event, key) => {
  if (pttRegistered) {
    try { globalShortcut.unregister(pttKey); } catch {}
  }
  pttKey = key || 'CmdOrCtrl+Shift+T';

  const success = globalShortcut.register(pttKey, () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('ptt-toggle');
    }
  });

  pttRegistered = success;
  if (!success) {
    console.warn(`Failed to register PTT key: ${pttKey}`);
  }
});

ipcMain.on('ptt-unregister', () => {
  if (pttRegistered) {
    try { globalShortcut.unregister(pttKey); } catch {}
    pttRegistered = false;
  }
});

// --- Desktop Screen Capture Sources ---
ipcMain.handle('get-screen-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true,
    });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnailDataUrl: source.thumbnail.toDataURL(),
      displayId: source.display_id,
      appIconDataUrl: source.appIcon ? source.appIcon.toDataURL() : null,
    }));
  } catch (err) {
    console.error('Failed to get screen sources:', err);
    return [];
  }
});

// --- Task #92: Desktop Notification Actions ---
ipcMain.on('show-message-notification', (_event, data) => {
  // data: { title, body, channelId, messageId, guildId }
  if (isMuted) return;

  const isMac = process.platform === 'darwin';
  const notification = new Notification({
    title: data.title || 'Gratonite',
    body: data.body || '',
    silent: false,
    ...(isMac ? { hasReply: true, replyPlaceholder: 'Type a reply...' } : {}),
    actions: isMac ? [] : [
      { type: 'button', text: 'Reply' },
      { type: 'button', text: 'Mark Read' },
    ],
  });

  notification.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('notification-clicked', {
        channelId: data.channelId,
        guildId: data.guildId,
      });
    }
  });

  // macOS inline reply
  notification.on('reply', (_event, reply) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('notification-reply', {
        channelId: data.channelId,
        messageId: data.messageId,
        reply,
      });
    }
  });

  // Action buttons (Windows/Linux)
  notification.on('action', (_event, index) => {
    if (index === 0) {
      // Reply — focus window and go to channel
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('notification-clicked', {
          channelId: data.channelId,
          guildId: data.guildId,
          focusInput: true,
        });
      }
    } else if (index === 1) {
      // Mark Read
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('notification-mark-read', {
          channelId: data.channelId,
        });
      }
    }
  });

  notification.show();
});

// --- Feature #23: Hotkeys IPC ---
ipcMain.handle('get-hotkeys', () => {
  return { ...currentHotkeys };
});

ipcMain.handle('set-hotkeys', (_event, newHotkeys) => {
  if (!newHotkeys || typeof newHotkeys !== 'object') return { success: false, error: 'Invalid hotkeys' };
  // Validate: only allow known action names, values must be strings
  const validActions = Object.keys(DEFAULT_HOTKEYS);
  const sanitized = {};
  for (const action of validActions) {
    sanitized[action] = typeof newHotkeys[action] === 'string' ? newHotkeys[action] : (currentHotkeys[action] || '');
  }
  currentHotkeys = sanitized;
  saveHotkeysConfig(currentHotkeys);
  registerConfigurableHotkeys();
  return { success: true, hotkeys: { ...currentHotkeys } };
});

ipcMain.handle('reset-hotkeys', () => {
  currentHotkeys = { ...DEFAULT_HOTKEYS };
  saveHotkeysConfig(currentHotkeys);
  registerConfigurableHotkeys();
  return { success: true, hotkeys: { ...currentHotkeys } };
});

ipcMain.handle('get-default-hotkeys', () => {
  return { ...DEFAULT_HOTKEYS };
});

// --- Feature #24: Tray Badge & Settings IPC ---
ipcMain.on('update-tray-badge', (_event, data) => {
  const count = (data && typeof data.count === 'number') ? data.count : 0;
  trayUnreadCount = count;
  updateBadgeCount(count);
  // Update tray icon tooltip and menu
  if (tray) {
    tray.setToolTip(count > 0 ? `Gratonite (${count} unread)` : 'Gratonite');
  }
  updateTrayMenu();
});

ipcMain.handle('get-minimize-to-tray', () => minimizeToTray);
ipcMain.on('set-minimize-to-tray', (_event, value) => {
  minimizeToTray = !!value;
  saveTraySettings();
});

ipcMain.handle('get-start-on-login', () => startOnLogin);
ipcMain.on('set-start-on-login', (_event, value) => {
  startOnLogin = !!value;
  saveTraySettings();
  app.setLoginItemSettings({
    openAtLogin: startOnLogin,
    openAsHidden: true,
  });
});

ipcMain.handle('get-deafen-state', () => isDeafened);
ipcMain.on('set-deafen-state', (_event, deafened) => {
  isDeafened = !!deafened;
  updateTrayMenu();
});

ipcMain.handle('get-dnd-state', () => isDndEnabled);
ipcMain.on('set-dnd-state', (_event, enabled) => {
  isDndEnabled = !!enabled;
  updateTrayMenu();
});

// --- Task #104: Rich Presence Integration IPC ---
ipcMain.handle('get-current-game', () => {
  if (!currentGame) return null;
  return { name: currentGame.displayName, startedAt: currentGame.startedAt };
});

ipcMain.on('set-game-activity-enabled', (_event, enabled) => {
  if (enabled) {
    if (!gameCheckInterval) startGameDetection();
  } else {
    stopGameDetection();
    if (currentGame) {
      currentGame = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('game-stopped');
      }
    }
  }
});

// --- Task #87: Auto-Update Progress UI (production only) ---
if (!isDev) {
  try {
    const { autoUpdater } = require('electron-updater');

    autoUpdater.autoDownload = false; // Don't auto-download; let renderer control it
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-available', {
          version: info.version,
          releaseNotes: info.releaseNotes || '',
          releaseDate: info.releaseDate || '',
        });
      }
    });

    autoUpdater.on('download-progress', (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-download-progress', {
          percent: progress.percent,
          bytesPerSecond: progress.bytesPerSecond,
          transferred: progress.transferred,
          total: progress.total,
        });
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-downloaded', {
          version: info.version,
          releaseNotes: info.releaseNotes || '',
        });
      }
    });

    autoUpdater.on('error', (err) => {
      console.error('Auto-updater error:', err.message);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-error', { message: err.message });
      }
    });

    // IPC from renderer to control updates
    ipcMain.on('update-download', () => {
      autoUpdater.downloadUpdate();
    });

    ipcMain.on('update-install', () => {
      autoUpdater.quitAndInstall();
    });

    ipcMain.on('update-check', () => {
      autoUpdater.checkForUpdates();
    });

    app.whenReady().then(() => {
      autoUpdater.checkForUpdates();
    });

    // Check for updates every 4 hours
    setInterval(() => {
      autoUpdater.checkForUpdates();
    }, UPDATE_CHECK_INTERVAL_MS);
  } catch (e) {
    console.warn('Auto-updater not available:', e.message);
  }
}
