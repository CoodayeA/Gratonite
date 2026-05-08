'use strict';

const { createElectronMock } = require('./setup');

// Resolve absolute paths once
const ELECTRON_PATH = require.resolve('electron');
const MAIN_PATH = require.resolve('../main.js');
let UPDATER_PATH;
try { UPDATER_PATH = require.resolve('electron-updater'); } catch (_) {}

let currentMocks;
let mockAutoUpdater;

function injectCache(modulePath, exports) {
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports };
}

async function loadMain({ platform = 'darwin', isDev = false, envUrl = null } = {}) {
  delete require.cache[MAIN_PATH];

  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  process.argv = isDev ? ['electron', 'main.js', '--dev'] : ['electron', 'main.js'];
  process.env.NODE_ENV = isDev ? 'development' : 'production';
  if (envUrl) {
    process.env.GRATONITE_DESKTOP_URL = envUrl;
  } else {
    delete process.env.GRATONITE_DESKTOP_URL;
  }

  currentMocks = createElectronMock();
  mockAutoUpdater = { checkForUpdates: vi.fn(), autoDownload: false, autoInstallOnAppQuit: false, on: vi.fn() };

  injectCache(ELECTRON_PATH, currentMocks);
  if (UPDATER_PATH) injectCache(UPDATER_PATH, { autoUpdater: mockAutoUpdater });

  require(MAIN_PATH);
  await new Promise((r) => setImmediate(r));

  return { ...currentMocks._mocks, autoUpdater: mockAutoUpdater };
}

afterEach(() => {
  delete require.cache[MAIN_PATH];
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Group A: URL Selection
// ---------------------------------------------------------------------------
describe('URL selection', () => {
  test('--dev flag → loads http://localhost:5174/app', async () => {
    const mocks = await loadMain({ isDev: true });
    expect(mocks.mockWindow.loadURL).toHaveBeenCalledWith('http://localhost:5174/app');
  });

  test('NODE_ENV=development → loads http://localhost:5174/app', async () => {
    const mocks = await loadMain({ isDev: true });
    expect(mocks.mockWindow.loadURL).toHaveBeenCalledWith('http://localhost:5174/app');
  });

  test('production → loads https://gratonite.chat/app', async () => {
    const mocks = await loadMain({ isDev: false });
    expect(mocks.mockWindow.loadURL).toHaveBeenCalledWith('https://gratonite.chat/app');
  });

  test('GRATONITE_DESKTOP_URL env var overrides production URL', async () => {
    const mocks = await loadMain({ isDev: false, envUrl: 'https://custom.example.com' });
    expect(mocks.mockWindow.loadURL).toHaveBeenCalledWith('https://custom.example.com');
  });

  test('dev mode opens DevTools; production does NOT', async () => {
    const devMocks = await loadMain({ isDev: true });
    expect(devMocks.mockWebContents.openDevTools).toHaveBeenCalled();

    const prodMocks = await loadMain({ isDev: false });
    expect(prodMocks.mockWebContents.openDevTools).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Group B: IPC Handlers
// ---------------------------------------------------------------------------
describe('IPC handlers', () => {
  test('app:version handler returns app.getVersion() result', async () => {
    const mocks = await loadMain();
    mocks.app.getVersion.mockReturnValue('2.3.4');
    const result = await mocks.ipcHandlers['app:version']();
    expect(result).toBe('2.3.4');
  });

  test('app:platform handler returns process.platform', async () => {
    const mocks = await loadMain({ platform: 'linux' });
    const result = await mocks.ipcHandlers['app:platform']();
    expect(result).toBe('linux');
  });

  test('get-mute-state returns false initially', async () => {
    const mocks = await loadMain();
    const result = await mocks.ipcHandlers['get-mute-state']();
    expect(result).toBe(false);
  });

  test('get-mute-state returns true after set-mute-state(null, true)', async () => {
    const mocks = await loadMain();
    mocks.ipcListeners['set-mute-state'](null, true);
    const result = await mocks.ipcHandlers['get-mute-state']();
    expect(result).toBe(true);
  });

  test('set-mute-state round-trips false → true → false', async () => {
    const mocks = await loadMain();
    mocks.ipcListeners['set-mute-state'](null, true);
    expect(await mocks.ipcHandlers['get-mute-state']()).toBe(true);
    mocks.ipcListeners['set-mute-state'](null, false);
    expect(await mocks.ipcHandlers['get-mute-state']()).toBe(false);
  });

  test('set-mute-state triggers tray menu rebuild', async () => {
    const mocks = await loadMain();
    const callsBefore = mocks.mockTray.setContextMenu.mock.calls.length;
    mocks.ipcListeners['set-mute-state'](null, true);
    expect(mocks.mockTray.setContextMenu.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  test('all 8 IPC channels are registered', async () => {
    const mocks = await loadMain();
    expect(mocks.ipcHandlers).toHaveProperty('app:version');
    expect(mocks.ipcHandlers).toHaveProperty('app:platform');
    expect(mocks.ipcHandlers).toHaveProperty('get-mute-state');
    expect(mocks.ipcHandlers).toHaveProperty('get-fullscreen');
    expect(mocks.ipcListeners).toHaveProperty('set-badge-count');
    expect(mocks.ipcListeners).toHaveProperty('set-mute-state');
    expect(mocks.ipcListeners).toHaveProperty('set-fullscreen');
    expect(mocks.ipcListeners).toHaveProperty('toggle-fullscreen');
  });
});

// ---------------------------------------------------------------------------
// Group C: Mute State
// ---------------------------------------------------------------------------
describe('mute state', () => {
  test('initial state is false', async () => {
    const mocks = await loadMain();
    expect(await mocks.ipcHandlers['get-mute-state']()).toBe(false);
  });

  test('tray menu toggle → state updates + sends mute-toggled to renderer', async () => {
    const mocks = await loadMain();
    const trayCall = mocks.Menu.buildFromTemplate.mock.calls.find(
      (c) => c[0].some((item) => item.label === 'Mute')
    );
    const muteItem = trayCall[0].find((item) => item.label === 'Mute');
    muteItem.click({ checked: true });
    expect(mocks.mockWebContents.send).toHaveBeenCalledWith('mute-toggled', true);
  });

  test('tray menu toggle → get-mute-state reflects new value', async () => {
    const mocks = await loadMain();
    const trayCall = mocks.Menu.buildFromTemplate.mock.calls.find(
      (c) => c[0].some((item) => item.label === 'Mute')
    );
    const muteItem = trayCall[0].find((item) => item.label === 'Mute');
    muteItem.click({ checked: true });
    expect(await mocks.ipcHandlers['get-mute-state']()).toBe(true);
  });

  test('global shortcut CmdOrCtrl+Shift+M toggles false→true', async () => {
    const mocks = await loadMain();
    mocks.shortcutHandlers['CmdOrCtrl+Shift+M']();
    expect(await mocks.ipcHandlers['get-mute-state']()).toBe(true);
  });

  test('global shortcut toggles true→false on second call', async () => {
    const mocks = await loadMain();
    mocks.shortcutHandlers['CmdOrCtrl+Shift+M']();
    mocks.shortcutHandlers['CmdOrCtrl+Shift+M']();
    expect(await mocks.ipcHandlers['get-mute-state']()).toBe(false);
  });

  test('shortcut registers with key string CmdOrCtrl+Shift+M', async () => {
    const mocks = await loadMain();
    expect(mocks.globalShortcut.register).toHaveBeenCalledWith(
      'CmdOrCtrl+Shift+M',
      expect.any(Function)
    );
  });

  test('mute-toggled NOT sent if mainWindow.isDestroyed() is true', async () => {
    const mocks = await loadMain();
    mocks.mockWindow.isDestroyed.mockReturnValue(true);
    mocks.shortcutHandlers['CmdOrCtrl+Shift+M']();
    expect(mocks.mockWebContents.send).not.toHaveBeenCalledWith('mute-toggled', expect.anything());
  });

  // Note: The IPC set-mute-state handler only updates state and rebuilds the tray menu.
  // Sending mute-toggled to the renderer is done by the tray menu toggle and global shortcut only.
  test('IPC set-mute-state updates state but does not send mute-toggled', async () => {
    const mocks = await loadMain();
    mocks.ipcListeners['set-mute-state'](null, true);
    expect(await mocks.ipcHandlers['get-mute-state']()).toBe(true);
    expect(mocks.mockWebContents.send).not.toHaveBeenCalledWith('mute-toggled', expect.anything());
  });
});

// ---------------------------------------------------------------------------
// Group D: Badge System
// ---------------------------------------------------------------------------
describe('badge system', () => {
  test('macOS: set-badge-count(5) → app.setBadgeCount(5)', async () => {
    const mocks = await loadMain({ platform: 'darwin' });
    mocks.ipcListeners['set-badge-count'](null, 5);
    expect(mocks.app.setBadgeCount).toHaveBeenCalledWith(5);
  });

  test('macOS: set-badge-count(0) → app.setBadgeCount(0)', async () => {
    const mocks = await loadMain({ platform: 'darwin' });
    mocks.ipcListeners['set-badge-count'](null, 0);
    expect(mocks.app.setBadgeCount).toHaveBeenCalledWith(0);
  });

  test('macOS: does NOT call setOverlayIcon', async () => {
    const mocks = await loadMain({ platform: 'darwin' });
    mocks.ipcListeners['set-badge-count'](null, 5);
    expect(mocks.mockWindow.setOverlayIcon).not.toHaveBeenCalled();
  });

  test('Windows: set-badge-count(3) → setOverlayIcon(image, "3 unread notifications")', async () => {
    const mocks = await loadMain({ platform: 'win32' });
    mocks.ipcListeners['set-badge-count'](null, 3);
    expect(mocks.mockWindow.setOverlayIcon).toHaveBeenCalledWith(
      expect.anything(),
      '3 unread notifications'
    );
  });

  test('Windows: set-badge-count(0) → setOverlayIcon(null, "")', async () => {
    const mocks = await loadMain({ platform: 'win32' });
    mocks.ipcListeners['set-badge-count'](null, 0);
    expect(mocks.mockWindow.setOverlayIcon).toHaveBeenCalledWith(null, '');
  });

  test('Windows: does NOT call app.setBadgeCount', async () => {
    const mocks = await loadMain({ platform: 'win32' });
    mocks.ipcListeners['set-badge-count'](null, 3);
    expect(mocks.app.setBadgeCount).not.toHaveBeenCalled();
  });

  test('positive count → tray tooltip "Gratonite (7 unread)"', async () => {
    const mocks = await loadMain({ platform: 'darwin' });
    mocks.ipcListeners['set-badge-count'](null, 7);
    expect(mocks.mockTray.setToolTip).toHaveBeenCalledWith('Gratonite (7 unread)');
  });

  test('zero count → tray tooltip "Gratonite"', async () => {
    const mocks = await loadMain({ platform: 'darwin' });
    mocks.ipcListeners['set-badge-count'](null, 0);
    expect(mocks.mockTray.setToolTip).toHaveBeenCalledWith('Gratonite');
  });

  test('badge buffer is 4096 bytes (32×32×4 RGBA)', async () => {
    const mocks = await loadMain({ platform: 'win32' });
    mocks.ipcListeners['set-badge-count'](null, 5);
    const [buffer] = mocks.nativeImage.createFromBuffer.mock.calls[0];
    expect(buffer.length).toBe(4096);
  });

  test('nativeImage.createFromBuffer second arg is { width: 32, height: 32 }', async () => {
    const mocks = await loadMain({ platform: 'win32' });
    mocks.ipcListeners['set-badge-count'](null, 5);
    const [, opts] = mocks.nativeImage.createFromBuffer.mock.calls[0];
    expect(opts).toEqual({ width: 32, height: 32 });
  });
});

// ---------------------------------------------------------------------------
// Group E: Auto-Updater
// ---------------------------------------------------------------------------
describe('auto-updater', () => {
  test('dev mode → checkForUpdates never called', async () => {
    const mocks = await loadMain({ isDev: true });
    expect(mocks.autoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  test('production → checkForUpdates called once on startup', async () => {
    const mocks = await loadMain({ isDev: false });
    expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  test('production → autoUpdater.autoDownload set to false', async () => {
    const mocks = await loadMain({ isDev: false });
    expect(mocks.autoUpdater.autoDownload).toBe(false);
  });

  test('production → autoUpdater.autoInstallOnAppQuit set to true', async () => {
    const mocks = await loadMain({ isDev: false });
    expect(mocks.autoUpdater.autoInstallOnAppQuit).toBe(true);
  });

  test('production → setInterval called with 4-hour interval (14400000 ms)', async () => {
    const spy = vi.spyOn(global, 'setInterval');
    await loadMain({ isDev: false });
    const call = spy.mock.calls.find((c) => c[1] === 14400000);
    expect(call).toBeDefined();
    spy.mockRestore();
  });

  test('interval callback calls checkForUpdates again', async () => {
    const spy = vi.spyOn(global, 'setInterval');
    const mocks = await loadMain({ isDev: false });
    const call = spy.mock.calls.find((c) => c[1] === 14400000);
    call[0]();
    expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  test('dev mode → 4-hour setInterval NOT registered', async () => {
    const spy = vi.spyOn(global, 'setInterval');
    await loadMain({ isDev: true });
    const call = spy.mock.calls.find((c) => c[1] === 14400000);
    expect(call).toBeUndefined();
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Group F: App Lifecycle
// ---------------------------------------------------------------------------
describe('app lifecycle', () => {
  test('requestSingleInstanceLock called on load', async () => {
    const mocks = await loadMain();
    expect(mocks.app.requestSingleInstanceLock).toHaveBeenCalled();
  });

  test('second-instance: restores minimized window + focuses', async () => {
    const mocks = await loadMain();
    mocks.mockWindow.isMinimized.mockReturnValue(true);
    mocks.appListeners['second-instance'][0](null, []);
    expect(mocks.mockWindow.restore).toHaveBeenCalled();
    expect(mocks.mockWindow.focus).toHaveBeenCalled();
  });

  test('second-instance: focuses non-minimized window without restore', async () => {
    const mocks = await loadMain();
    mocks.mockWindow.isMinimized.mockReturnValue(false);
    mocks.appListeners['second-instance'][0](null, []);
    expect(mocks.mockWindow.restore).not.toHaveBeenCalled();
    expect(mocks.mockWindow.focus).toHaveBeenCalled();
  });

  test('window-all-closed on Linux → app.quit() called', async () => {
    const mocks = await loadMain({ platform: 'linux' });
    mocks.ipcListeners['set-minimize-to-tray'](null, false);
    mocks.appListeners['window-all-closed'][0]();
    expect(mocks.app.quit).toHaveBeenCalled();
  });

  test('window-all-closed on macOS → app.quit() NOT called', async () => {
    const mocks = await loadMain({ platform: 'darwin' });
    mocks.appListeners['window-all-closed'][0]();
    expect(mocks.app.quit).not.toHaveBeenCalled();
  });

  test('will-quit → globalShortcut.unregisterAll() called', async () => {
    const mocks = await loadMain();
    mocks.appListeners['will-quit'][0]();
    expect(mocks.globalShortcut.unregisterAll).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Group G: Fullscreen
// ---------------------------------------------------------------------------
describe('fullscreen', () => {
  test('F11 keyDown toggles fullscreen via before-input-event', async () => {
    const mocks = await loadMain();
    // Find the before-input-event handler registered on webContents
    const onCall = mocks.mockWebContents.on.mock.calls.find(
      (c) => c[0] === 'before-input-event'
    );
    expect(onCall).toBeDefined();
    const handler = onCall[1];

    // Simulate F11 keyDown
    const event = { preventDefault: vi.fn() };
    mocks.mockWindow.isFullScreen.mockReturnValue(false);
    handler(event, { key: 'F11', type: 'keyDown', alt: false, control: false, meta: false, shift: false });
    expect(mocks.mockWindow.setFullScreen).toHaveBeenCalledWith(true);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  test('F11 with modifiers does NOT toggle fullscreen', async () => {
    const mocks = await loadMain();
    const onCall = mocks.mockWebContents.on.mock.calls.find(
      (c) => c[0] === 'before-input-event'
    );
    const handler = onCall[1];
    const event = { preventDefault: vi.fn() };
    handler(event, { key: 'F11', type: 'keyDown', alt: false, control: true, meta: false, shift: false });
    expect(mocks.mockWindow.setFullScreen).not.toHaveBeenCalled();
  });

  test('get-fullscreen IPC returns mainWindow.isFullScreen()', async () => {
    const mocks = await loadMain();
    mocks.mockWindow.isFullScreen.mockReturnValue(true);
    const result = await mocks.ipcHandlers['get-fullscreen']();
    expect(result).toBe(true);
  });

  test('set-fullscreen IPC calls mainWindow.setFullScreen(value)', async () => {
    const mocks = await loadMain();
    mocks.ipcListeners['set-fullscreen'](null, true);
    expect(mocks.mockWindow.setFullScreen).toHaveBeenCalledWith(true);
  });

  test('toggle-fullscreen IPC toggles fullscreen state', async () => {
    const mocks = await loadMain();
    mocks.mockWindow.isFullScreen.mockReturnValue(false);
    mocks.ipcListeners['toggle-fullscreen']();
    expect(mocks.mockWindow.setFullScreen).toHaveBeenCalledWith(true);
  });

  test('enter-full-screen event sends fullscreen-changed true', async () => {
    const mocks = await loadMain();
    const onCall = mocks.mockWindow.on.mock.calls.find(
      (c) => c[0] === 'enter-full-screen'
    );
    expect(onCall).toBeDefined();
    onCall[1]();
    expect(mocks.mockWebContents.send).toHaveBeenCalledWith('fullscreen-changed', true);
  });

  test('leave-full-screen event sends fullscreen-changed false', async () => {
    const mocks = await loadMain();
    const onCall = mocks.mockWindow.on.mock.calls.find(
      (c) => c[0] === 'leave-full-screen'
    );
    expect(onCall).toBeDefined();
    onCall[1]();
    expect(mocks.mockWebContents.send).toHaveBeenCalledWith('fullscreen-changed', false);
  });
});

// ---------------------------------------------------------------------------
// Group H: Desktop Screen Capture
// ---------------------------------------------------------------------------
describe('desktop screen capture', () => {
  test('get-screen-sources IPC maps desktopCapturer sources for renderer use', async () => {
    const mocks = await loadMain();
    const source = {
      id: 'screen:1:0',
      name: 'Display 1',
      display_id: '69733248',
      thumbnail: { toDataURL: vi.fn().mockReturnValue('data:image/png;base64,thumb') },
      appIcon: { toDataURL: vi.fn().mockReturnValue('data:image/png;base64,icon') },
    };
    mocks.desktopCapturer.getSources.mockResolvedValue([source]);

    const result = await mocks.ipcHandlers['get-screen-sources']();

    expect(mocks.desktopCapturer.getSources).toHaveBeenCalledWith({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true,
    });
    expect(result).toEqual([
      {
        id: 'screen:1:0',
        name: 'Display 1',
        thumbnailDataUrl: 'data:image/png;base64,thumb',
        displayId: '69733248',
        appIconDataUrl: 'data:image/png;base64,icon',
      },
    ]);
  });

  test('get-screen-sources IPC returns empty array when desktopCapturer fails', async () => {
    const mocks = await loadMain();
    mocks.desktopCapturer.getSources.mockRejectedValue(new Error('capture failed'));

    const result = await mocks.ipcHandlers['get-screen-sources']();

    expect(result).toEqual([]);
  });

  test('permission handler allows media, display-capture, screen, and notifications', async () => {
    const mocks = await loadMain({ platform: 'linux' });
    const permissionHandler = mocks.session.defaultSession.setPermissionRequestHandler.mock.calls[0][0];
    const allowed = vi.fn();
    const denied = vi.fn();

    // Handler is async (awaits askForMediaAccess on darwin); on non-darwin it resolves immediately.
    await permissionHandler(null, 'media', allowed);
    await permissionHandler(null, 'display-capture', allowed);
    await permissionHandler(null, 'screen', allowed);
    await permissionHandler(null, 'notifications', allowed);
    await permissionHandler(null, 'geolocation', denied);

    expect(allowed).toHaveBeenNthCalledWith(1, true);
    expect(allowed).toHaveBeenNthCalledWith(2, true);
    expect(allowed).toHaveBeenNthCalledWith(3, true);
    expect(allowed).toHaveBeenNthCalledWith(4, true);
    expect(denied).toHaveBeenCalledWith(false);
  });
});
