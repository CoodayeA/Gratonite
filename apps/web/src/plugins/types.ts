/**
 * types.ts — TypeScript types for the Gratonite Plugin SDK.
 *
 * Defines the plugin manifest format, permission model, and the API surface
 * that plugins can interact with through the sandboxed iframe bridge.
 */

export interface PluginManifest {
  /** Unique identifier for the plugin (reverse-domain recommended, e.g. "com.example.word-counter"). */
  id: string;
  /** Human-readable plugin name. */
  name: string;
  /** Semantic version string. */
  version: string;
  /** Short description of what the plugin does. */
  description: string;
  /** Plugin author name. */
  author: string;
  /** Permissions the plugin requires. */
  permissions: PluginPermission[];
  /** URL to the plugin's entry point JS file. For built-in plugins, this is "builtin:<id>". */
  entryPoint: string;
  /** Optional icon URL or emoji. */
  icon?: string;
}

export type PluginPermission =
  | 'read_messages'
  | 'send_messages'
  | 'custom_renderer'
  | 'sidebar_panel'
  | 'slash_command'
  | 'theme_modify'
  | 'notifications';

/** The API surface exposed to plugins through the message-passing bridge. */
export interface PluginAPI {
  /** Subscribe to incoming messages. Requires 'read_messages' permission. */
  onMessage(callback: (msg: { content: string; author: string; channelId: string }) => void): void;

  /** Send a message to a channel. Requires 'send_messages' permission. */
  sendMessage(channelId: string, content: string): Promise<void>;

  /** Register a sidebar panel. Requires 'sidebar_panel' permission. */
  registerSidebarPanel(config: {
    title: string;
    icon: string;
    render: () => string;
  }): void;

  /** Register a slash command. Requires 'slash_command' permission. */
  registerSlashCommand(config: {
    name: string;
    description: string;
    handler: (args: string) => void;
  }): void;

  /** Register a custom message renderer. Requires 'custom_renderer' permission. */
  registerMessageRenderer(config: {
    match: (content: string) => boolean;
    render: (content: string) => string;
  }): void;

  /** Per-plugin localStorage. */
  storage: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  };

  /** Override CSS custom properties. Requires 'theme_modify' permission. */
  setThemeOverride(vars: Record<string, string>): void;

  /** Show a browser notification. Requires 'notifications' permission. */
  showNotification(title: string, body: string): void;
}

/** Internal state for a loaded plugin instance. */
export interface PluginInstance {
  manifest: PluginManifest;
  enabled: boolean;
  sidebarPanels: SidebarPanelConfig[];
  slashCommands: SlashCommandConfig[];
  messageRenderers: MessageRendererConfig[];
  sandboxIframe: HTMLIFrameElement | null;
}

export interface SidebarPanelConfig {
  pluginId: string;
  title: string;
  icon: string;
  /** HTML string returned by the plugin's render function. */
  html: string;
}

export interface SlashCommandConfig {
  pluginId: string;
  name: string;
  description: string;
}

export interface MessageRendererConfig {
  pluginId: string;
  /** Serialized match function body (runs in sandbox). */
  matchPattern: string;
  /** Serialized render function body (runs in sandbox). */
  renderTemplate: string;
}

/** Messages sent between the host and the plugin sandbox iframe. */
export type HostToPluginMessage =
  | { type: 'INIT'; pluginId: string; permissions: PluginPermission[] }
  | { type: 'MESSAGE_EVENT'; content: string; author: string; channelId: string }
  | { type: 'STORAGE_RESULT'; requestId: string; value: string | null }
  | { type: 'SLASH_COMMAND_INVOKE'; name: string; args: string };

export type PluginToHostMessage =
  | { type: 'REGISTER_SIDEBAR_PANEL'; title: string; icon: string; html: string }
  | { type: 'REGISTER_SLASH_COMMAND'; name: string; description: string }
  | { type: 'REGISTER_MESSAGE_RENDERER'; matchPattern: string; renderTemplate: string }
  | { type: 'SEND_MESSAGE'; channelId: string; content: string; requestId: string }
  | { type: 'STORAGE_GET'; key: string; requestId: string }
  | { type: 'STORAGE_SET'; key: string; value: string; requestId: string }
  | { type: 'STORAGE_DELETE'; key: string; requestId: string }
  | { type: 'SET_THEME_OVERRIDE'; vars: Record<string, string> }
  | { type: 'SHOW_NOTIFICATION'; title: string; body: string }
  | { type: 'SIDEBAR_PANEL_UPDATE'; title: string; html: string }
  | { type: 'READY' };
