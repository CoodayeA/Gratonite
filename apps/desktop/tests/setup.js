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
    on: vi.fn(),
    insertCSS: vi.fn(),
  };

  const mockWindow = {
    loadURL: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(),
    isMinimized: vi.fn().mockReturnValue(false),
    isVisible: vi.fn().mockReturnValue(true),
    isDestroyed: vi.fn().mockReturnValue(false),
    isFullScreen: vi.fn().mockReturnValue(false),
    setFullScreen: vi.fn(),
    once: vi.fn(),
    on: vi.fn(),
    setOverlayIcon: vi.fn(),
    webContents: mockWebContents,
  };

  const mockTray = {
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn(),
  };

  const Menu = {
    buildFromTemplate: vi.fn((template) => ({ _template: template })),
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
    setBadgeCount: vi.fn(),
    quit: vi.fn(),
    requestSingleInstanceLock: vi.fn().mockReturnValue(true),
    commandLine: { appendSwitch: vi.fn() },
    isQuitting: false,
    on: vi.fn((event, handler) => {
      if (!appListeners[event]) appListeners[event] = [];
      appListeners[event].push(handler);
    }),
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
    unregisterAll: vi.fn(),
  };

  const shell = {
    openExternal: vi.fn(),
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
