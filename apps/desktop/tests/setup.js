'use strict';

function createElectronMock() {
  const ipcHandlers = {};
  const ipcListeners = {};
  const appListeners = {};
  const shortcutHandlers = {};

  const mockWebContents = {
    send: vi.fn(),
    openDevTools: vi.fn(),
    setWindowOpenHandler: vi.fn(),
    // Auto-fire did-finish-load synchronously so loadURL gets called in tests
    on: vi.fn().mockImplementation((event, handler) => {
      if (event === 'did-finish-load') handler();
    }),
    insertCSS: vi.fn(),
    replaceMisspelling: vi.fn(),
    copyImageAt: vi.fn(),
  };

  const mockWindow = {
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(),
    maximize: vi.fn(),
    isMinimized: vi.fn().mockReturnValue(false),
    isVisible: vi.fn().mockReturnValue(true),
    isDestroyed: vi.fn().mockReturnValue(false),
    isFullScreen: vi.fn().mockReturnValue(false),
    isMaximized: vi.fn().mockReturnValue(false),
    setFullScreen: vi.fn(),
    setProgressBar: vi.fn(),
    setTitleBarOverlay: vi.fn(),
    setOverlayIcon: vi.fn(),
    getBounds: vi.fn().mockReturnValue({ x: 100, y: 100, width: 1280, height: 800 }),
    once: vi.fn(),
    on: vi.fn(),
    webContents: mockWebContents,
  };

  const mockTray = {
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn(),
  };

  const Menu = {
    buildFromTemplate: vi.fn((template) => ({ _template: template })),
    setApplicationMenu: vi.fn(),
  };

  const ipcMain = {
    handle: vi.fn((channel, handler) => {
      ipcHandlers[channel] = handler;
    }),
    on: vi.fn((channel, handler) => {
      ipcListeners[channel] = handler;
    }),
  };

  const app = {
    whenReady: vi.fn().mockReturnValue(Promise.resolve()),
    getVersion: vi.fn().mockReturnValue('1.0.1'),
    getPath: vi.fn().mockReturnValue('/tmp/gratonite-test'),
    setBadgeCount: vi.fn(),
    quit: vi.fn(),
    requestSingleInstanceLock: vi.fn().mockReturnValue(true),
    setAsDefaultProtocolClient: vi.fn(),
    setLoginItemSettings: vi.fn(),
    commandLine: { appendSwitch: vi.fn() },
    isQuitting: false,
    name: 'Gratonite',
    on: vi.fn((event, handler) => {
      if (!appListeners[event]) appListeners[event] = [];
      appListeners[event].push(handler);
    }),
    once: vi.fn(),
  };

  const BrowserWindow = vi.fn().mockImplementation(() => mockWindow);
  const Tray = vi.fn().mockImplementation(() => mockTray);

  const nativeImage = {
    createFromPath: vi.fn().mockReturnValue({ setTemplateImage: vi.fn() }),
    createFromBuffer: vi.fn().mockReturnValue({}),
  };

  const globalShortcut = {
    register: vi.fn((key, handler) => {
      shortcutHandlers[key] = handler;
      return true;
    }),
    unregister: vi.fn(),
    unregisterAll: vi.fn(),
  };

  const shell = {
    openExternal: vi.fn(),
  };

  const crashReporter = {
    start: vi.fn(),
  };

  const powerMonitor = {
    getSystemIdleTime: vi.fn().mockReturnValue(0),
  };

  const screen = {
    getAllDisplays: vi.fn().mockReturnValue([
      { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    ]),
  };

  const dialog = {
    showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
    showSaveDialog: vi.fn().mockResolvedValue({ filePath: undefined }),
  };

  const desktopCapturer = {
    getSources: vi.fn().mockResolvedValue([]),
  };

  const systemPreferences = {
    getAccentColor: vi.fn().mockReturnValue('6c63ffff'),
  };

  const session = {
    defaultSession: {
      setPermissionRequestHandler: vi.fn(),
    },
  };

  const Notification = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    show: vi.fn(),
  }));

  const clipboard = {
    writeText: vi.fn(),
    readText: vi.fn(),
  };

  return {
    app,
    BrowserWindow,
    shell,
    ipcMain,
    Tray,
    Menu,
    nativeImage,
    globalShortcut,
    crashReporter,
    powerMonitor,
    screen,
    dialog,
    desktopCapturer,
    systemPreferences,
    session,
    Notification,
    clipboard,
    _mocks: {
      ipcHandlers,
      ipcListeners,
      appListeners,
      shortcutHandlers,
      mockWindow,
      mockTray,
      mockWebContents,
      app,
      ipcMain,
      globalShortcut,
      nativeImage,
      Menu,
    },
  };
}

module.exports = { createElectronMock };
