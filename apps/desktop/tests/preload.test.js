'use strict';

const ELECTRON_PATH = require.resolve('electron');
const PRELOAD_PATH = require.resolve('../preload.js');

let capturedApi;
let mockIpcRenderer;

function loadPreload() {
  delete require.cache[PRELOAD_PATH];

  // Mock window.addEventListener for DOMContentLoaded handler
  global.window = { addEventListener: vi.fn() };

  capturedApi = undefined;
  mockIpcRenderer = {
    invoke: vi.fn().mockResolvedValue(undefined),
    send: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
  };

  require.cache[ELECTRON_PATH] = {
    id: ELECTRON_PATH,
    filename: ELECTRON_PATH,
    loaded: true,
    exports: {
      contextBridge: {
        exposeInMainWorld: vi.fn((key, api) => {
          capturedApi = { key, api };
        }),
      },
      ipcRenderer: mockIpcRenderer,
    },
  };

  require(PRELOAD_PATH);
}

beforeEach(() => {
  loadPreload();
});

afterEach(() => {
  delete require.cache[PRELOAD_PATH];
});

describe('preload.js', () => {
  test('exposeInMainWorld called with "gratoniteDesktop"', () => {
    expect(capturedApi.key).toBe('gratoniteDesktop');
  });

  test('isDesktop === true', () => {
    expect(capturedApi.api.isDesktop).toBe(true);
  });

  test('getVersion() → ipcRenderer.invoke("app:version")', async () => {
    await capturedApi.api.getVersion();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('app:version');
  });

  test('getPlatform() → ipcRenderer.invoke("app:platform")', async () => {
    await capturedApi.api.getPlatform();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('app:platform');
  });

  test('setBadgeCount(5) → ipcRenderer.send("set-badge-count", 5)', () => {
    capturedApi.api.setBadgeCount(5);
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('set-badge-count', 5);
  });

  test('getScreenSources() → ipcRenderer.invoke("get-screen-sources")', async () => {
    await capturedApi.api.getScreenSources();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('get-screen-sources');
  });

  test('getMuteState() → ipcRenderer.invoke("get-mute-state")', async () => {
    await capturedApi.api.getMuteState();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('get-mute-state');
  });

  test('setMuteState(true) → ipcRenderer.send("set-mute-state", true)', () => {
    capturedApi.api.setMuteState(true);
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('set-mute-state', true);
  });

  test('onMuteToggled(cb) registers listener; firing it calls cb(true)', () => {
    const cb = vi.fn();
    let registeredHandler;
    mockIpcRenderer.on.mockImplementation((event, handler) => {
      if (event === 'mute-toggled') registeredHandler = handler;
    });
    capturedApi.api.onMuteToggled(cb);
    registeredHandler(null, true);
    expect(cb).toHaveBeenCalledWith(true);
  });

  test('onMuteToggled returns a cleanup function', () => {
    const cleanup = capturedApi.api.onMuteToggled(vi.fn());
    expect(typeof cleanup).toBe('function');
  });

  test('calling cleanup → ipcRenderer.removeListener("mute-toggled", handler)', () => {
    let registeredHandler;
    mockIpcRenderer.on.mockImplementation((event, handler) => {
      if (event === 'mute-toggled') registeredHandler = handler;
    });
    const cleanup = capturedApi.api.onMuteToggled(vi.fn());
    cleanup();
    expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith('mute-toggled', registeredHandler);
  });

  // Fullscreen API
  test('getFullscreen() → ipcRenderer.invoke("get-fullscreen")', async () => {
    await capturedApi.api.getFullscreen();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith('get-fullscreen');
  });

  test('setFullscreen(true) → ipcRenderer.send("set-fullscreen", true)', () => {
    capturedApi.api.setFullscreen(true);
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('set-fullscreen', true);
  });

  test('toggleFullscreen() → ipcRenderer.send("toggle-fullscreen")', () => {
    capturedApi.api.toggleFullscreen();
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('toggle-fullscreen');
  });

  test('onFullscreenChanged(cb) registers listener; firing it calls cb(true)', () => {
    const cb = vi.fn();
    let registeredHandler;
    mockIpcRenderer.on.mockImplementation((event, handler) => {
      if (event === 'fullscreen-changed') registeredHandler = handler;
    });
    capturedApi.api.onFullscreenChanged(cb);
    registeredHandler(null, true);
    expect(cb).toHaveBeenCalledWith(true);
  });

  test('onFullscreenChanged returns a cleanup function', () => {
    const cleanup = capturedApi.api.onFullscreenChanged(vi.fn());
    expect(typeof cleanup).toBe('function');
  });

  test('calling fullscreen cleanup → ipcRenderer.removeListener("fullscreen-changed", handler)', () => {
    let registeredHandler;
    mockIpcRenderer.on.mockImplementation((event, handler) => {
      if (event === 'fullscreen-changed') registeredHandler = handler;
    });
    const cleanup = capturedApi.api.onFullscreenChanged(vi.fn());
    cleanup();
    expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith('fullscreen-changed', registeredHandler);
  });
});
