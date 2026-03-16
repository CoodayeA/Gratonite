/**
 * PluginSDK.ts — The API surface and plugin lifecycle manager.
 *
 * Manages installed plugins, their sandboxed execution, and coordinates
 * events between the host application and plugin instances.
 */
import type {
  PluginManifest,
  PluginInstance,
  SidebarPanelConfig,
  SlashCommandConfig,
  MessageRendererConfig,
} from './types';
import { createPluginSandbox, destroyPluginSandbox, sendMessageToPlugin, invokeSlashCommand } from './PluginSandbox';
import { BUILTIN_PLUGINS, getBuiltinPluginCode } from './builtinPlugins';
import { apiFetch } from '../lib/api/_core';

const STORAGE_KEY = 'gratonite:plugins';

// Global plugin state
let installedPlugins: Map<string, PluginInstance> = new Map();
let sidebarPanels: SidebarPanelConfig[] = [];
let slashCommands: SlashCommandConfig[] = [];
let messageRenderers: MessageRendererConfig[] = [];

// Change listeners for React integration
type ChangeListener = () => void;
const changeListeners = new Set<ChangeListener>();

function notifyChange() {
  changeListeners.forEach(cb => cb());
}

export function onPluginChange(cb: ChangeListener): () => void {
  changeListeners.add(cb);
  return () => { changeListeners.delete(cb); };
}

/**
 * Get all installed plugins.
 */
export function getInstalledPlugins(): PluginInstance[] {
  return Array.from(installedPlugins.values());
}

/**
 * Get all registered sidebar panels from enabled plugins.
 */
export function getSidebarPanels(): SidebarPanelConfig[] {
  return sidebarPanels;
}

/**
 * Get all registered slash commands from enabled plugins.
 */
export function getSlashCommands(): SlashCommandConfig[] {
  return slashCommands;
}

/**
 * Get all registered message renderers from enabled plugins.
 */
export function getMessageRenderers(): MessageRendererConfig[] {
  return messageRenderers;
}

/**
 * Load saved plugin state from localStorage.
 */
function loadPluginState(): Map<string, { manifest: PluginManifest; enabled: boolean }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const arr = JSON.parse(raw) as Array<{ manifest: PluginManifest; enabled: boolean }>;
    const map = new Map<string, { manifest: PluginManifest; enabled: boolean }>();
    for (const item of arr) {
      if (item.manifest?.id) {
        map.set(item.manifest.id, item);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Save plugin state to localStorage.
 */
function savePluginState(): void {
  const arr = Array.from(installedPlugins.values()).map(p => ({
    manifest: p.manifest,
    enabled: p.enabled,
  }));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch { /* quota exceeded */ }
}

/**
 * Start a plugin by creating its sandbox and loading its code.
 */
function startPlugin(instance: PluginInstance): void {
  if (instance.sandboxIframe) return; // already running

  const code = instance.manifest.entryPoint.startsWith('builtin:')
    ? getBuiltinPluginCode(instance.manifest.id)
    : null; // remote plugins not yet supported

  if (!code) return;

  const iframe = createPluginSandbox(instance.manifest, code, {
    onSidebarPanel: (config) => {
      sidebarPanels = sidebarPanels.filter(p => !(p.pluginId === config.pluginId && p.title === config.title));
      sidebarPanels.push(config);
      instance.sidebarPanels.push(config);
      notifyChange();
    },
    onSlashCommand: (config) => {
      slashCommands = slashCommands.filter(c => !(c.pluginId === config.pluginId && c.name === config.name));
      slashCommands.push(config);
      instance.slashCommands.push(config);
      notifyChange();
    },
    onMessageRenderer: (config) => {
      messageRenderers.push(config);
      instance.messageRenderers.push(config);
      notifyChange();
    },
    onSendMessage: async (channelId: string, content: string) => {
      await apiFetch(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    },
    onThemeOverride: (vars) => {
      const root = document.documentElement;
      for (const [key, value] of Object.entries(vars)) {
        root.style.setProperty(key, value);
      }
    },
    onNotification: (title, body) => {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    },
    onSidebarPanelUpdate: (title, html) => {
      const idx = sidebarPanels.findIndex(p => p.pluginId === instance.manifest.id && p.title === title);
      if (idx !== -1) {
        sidebarPanels[idx] = { ...sidebarPanels[idx], html };
        notifyChange();
      }
    },
    onReady: () => {
      console.info(`[PluginSDK] Plugin "${instance.manifest.name}" ready`);
    },
  });

  instance.sandboxIframe = iframe;
}

/**
 * Stop a plugin by destroying its sandbox.
 */
function stopPlugin(instance: PluginInstance): void {
  if (instance.sandboxIframe) {
    destroyPluginSandbox(instance.sandboxIframe);
    instance.sandboxIframe = null;
  }
  // Remove its registrations
  sidebarPanels = sidebarPanels.filter(p => p.pluginId !== instance.manifest.id);
  slashCommands = slashCommands.filter(c => c.pluginId !== instance.manifest.id);
  messageRenderers = messageRenderers.filter(r => r.pluginId !== instance.manifest.id);
  instance.sidebarPanels = [];
  instance.slashCommands = [];
  instance.messageRenderers = [];
  notifyChange();
}

/**
 * Install a plugin.
 */
export function installPlugin(manifest: PluginManifest): void {
  if (installedPlugins.has(manifest.id)) return;

  const instance: PluginInstance = {
    manifest,
    enabled: true,
    sidebarPanels: [],
    slashCommands: [],
    messageRenderers: [],
    sandboxIframe: null,
  };

  installedPlugins.set(manifest.id, instance);
  savePluginState();
  startPlugin(instance);
  notifyChange();
}

/**
 * Uninstall a plugin.
 */
export function uninstallPlugin(pluginId: string): void {
  const instance = installedPlugins.get(pluginId);
  if (!instance) return;

  stopPlugin(instance);
  installedPlugins.delete(pluginId);
  savePluginState();

  // Clean up plugin storage
  const prefix = `gratonite:plugin:${pluginId}:`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) keysToRemove.push(key);
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  notifyChange();
}

/**
 * Toggle a plugin enabled/disabled.
 */
export function togglePlugin(pluginId: string, enabled: boolean): void {
  const instance = installedPlugins.get(pluginId);
  if (!instance) return;

  instance.enabled = enabled;
  if (enabled) {
    startPlugin(instance);
  } else {
    stopPlugin(instance);
  }
  savePluginState();
  notifyChange();
}

/**
 * Check if a plugin is installed.
 */
export function isPluginInstalled(pluginId: string): boolean {
  return installedPlugins.has(pluginId);
}

/**
 * Dispatch a new message event to all enabled plugins with read_messages permission.
 */
export function dispatchMessageToPlugins(content: string, author: string, channelId: string): void {
  for (const instance of installedPlugins.values()) {
    if (!instance.enabled || !instance.sandboxIframe) continue;
    if (!instance.manifest.permissions.includes('read_messages')) continue;
    sendMessageToPlugin(instance.sandboxIframe, content, author, channelId);
  }
}

/**
 * Invoke a plugin slash command.
 */
export function invokePluginSlashCommand(name: string, args: string): boolean {
  for (const instance of installedPlugins.values()) {
    if (!instance.enabled || !instance.sandboxIframe) continue;
    const cmd = instance.slashCommands.find(c => c.name === name);
    if (cmd) {
      invokeSlashCommand(instance.sandboxIframe, name, args);
      return true;
    }
  }
  return false;
}

/**
 * Get available plugins for the store (built-in + any remote).
 */
export function getAvailablePlugins(): PluginManifest[] {
  return [...BUILTIN_PLUGINS];
}

/**
 * Initialize the plugin system — load saved plugins and start enabled ones.
 */
export function initPluginSystem(): void {
  const saved = loadPluginState();

  for (const [id, { manifest, enabled }] of saved) {
    const instance: PluginInstance = {
      manifest,
      enabled,
      sidebarPanels: [],
      slashCommands: [],
      messageRenderers: [],
      sandboxIframe: null,
    };
    installedPlugins.set(id, instance);
    if (enabled) {
      startPlugin(instance);
    }
  }

  notifyChange();
}
