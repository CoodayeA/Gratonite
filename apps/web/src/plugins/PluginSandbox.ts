/**
 * PluginSandbox.ts — iframe-based sandboxed execution environment for plugins.
 *
 * SECURITY: All plugin code runs inside a sandboxed iframe with only allow-scripts.
 * Communication happens exclusively through postMessage. No direct DOM access,
 * no same-origin access. All HTML from plugins is sanitized with DOMPurify
 * before rendering in the host.
 */
import DOMPurify from 'dompurify';
import type {
  PluginManifest,
  PluginPermission,
  PluginToHostMessage,
  SidebarPanelConfig,
  SlashCommandConfig,
  MessageRendererConfig,
} from './types';

// The sandbox HTML template that runs inside the iframe
function createSandboxHTML(pluginId: string, permissions: PluginPermission[], code: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Plugin Sandbox: ${pluginId}</title></head>
<body>
<script>
(function() {
  'use strict';
  var pluginId = ${JSON.stringify(pluginId)};
  var permissions = ${JSON.stringify(permissions)};
  var _requestId = 0;
  var _pendingCallbacks = {};
  var _messageCallbacks = [];

  function genId() { return 'req_' + (++_requestId); }

  // Plugin API exposed to plugin code
  var gratonite = {
    onMessage: function(cb) {
      if (permissions.indexOf('read_messages') === -1) {
        console.warn('[plugin] Missing read_messages permission');
        return;
      }
      _messageCallbacks.push(cb);
    },

    sendMessage: function(channelId, content) {
      if (permissions.indexOf('send_messages') === -1) {
        return Promise.reject(new Error('Missing send_messages permission'));
      }
      var id = genId();
      parent.postMessage({ type: 'SEND_MESSAGE', channelId: channelId, content: content, requestId: id }, '*');
      return new Promise(function(resolve) { _pendingCallbacks[id] = resolve; });
    },

    registerSidebarPanel: function(config) {
      if (permissions.indexOf('sidebar_panel') === -1) return;
      var html = typeof config.render === 'function' ? config.render() : '';
      parent.postMessage({
        type: 'REGISTER_SIDEBAR_PANEL',
        title: config.title,
        icon: config.icon || '',
        html: html
      }, '*');
    },

    registerSlashCommand: function(config) {
      if (permissions.indexOf('slash_command') === -1) return;
      parent.postMessage({
        type: 'REGISTER_SLASH_COMMAND',
        name: config.name,
        description: config.description
      }, '*');
      // Store handler for later invocation
      window['_slashHandler_' + config.name] = config.handler;
    },

    registerMessageRenderer: function(config) {
      if (permissions.indexOf('custom_renderer') === -1) return;
      parent.postMessage({
        type: 'REGISTER_MESSAGE_RENDERER',
        matchPattern: config.match.toString(),
        renderTemplate: config.render.toString()
      }, '*');
    },

    storage: {
      get: function(key) {
        var id = genId();
        parent.postMessage({ type: 'STORAGE_GET', key: key, requestId: id }, '*');
        return new Promise(function(resolve) { _pendingCallbacks[id] = resolve; });
      },
      set: function(key, value) {
        var id = genId();
        parent.postMessage({ type: 'STORAGE_SET', key: key, value: value, requestId: id }, '*');
        return new Promise(function(resolve) { _pendingCallbacks[id] = resolve; });
      },
      delete: function(key) {
        var id = genId();
        parent.postMessage({ type: 'STORAGE_DELETE', key: key, requestId: id }, '*');
        return new Promise(function(resolve) { _pendingCallbacks[id] = resolve; });
      }
    },

    setThemeOverride: function(vars) {
      if (permissions.indexOf('theme_modify') === -1) return;
      parent.postMessage({ type: 'SET_THEME_OVERRIDE', vars: vars }, '*');
    },

    showNotification: function(title, body) {
      if (permissions.indexOf('notifications') === -1) return;
      parent.postMessage({ type: 'SHOW_NOTIFICATION', title: title, body: body }, '*');
    },

    updateSidebarPanel: function(title, renderFn) {
      var html = typeof renderFn === 'function' ? renderFn() : '';
      parent.postMessage({ type: 'SIDEBAR_PANEL_UPDATE', title: title, html: html }, '*');
    }
  };

  // Listen for host messages
  window.addEventListener('message', function(event) {
    var data = event.data;
    if (!data || !data.type) return;

    if (data.type === 'MESSAGE_EVENT') {
      _messageCallbacks.forEach(function(cb) {
        try { cb({ content: data.content, author: data.author, channelId: data.channelId }); }
        catch(e) { console.error('[plugin] message callback error:', e); }
      });
    }
    else if (data.type === 'STORAGE_RESULT') {
      var cb = _pendingCallbacks[data.requestId];
      if (cb) { delete _pendingCallbacks[data.requestId]; cb(data.value); }
    }
    else if (data.type === 'SLASH_COMMAND_INVOKE') {
      var handler = window['_slashHandler_' + data.name];
      if (handler) { try { handler(data.args); } catch(e) { console.error('[plugin] slash command error:', e); } }
    }
  });

  // Execute plugin code (runs in sandboxed iframe context only)
  try {
    ${code}
  } catch(e) {
    console.error('[plugin ' + pluginId + '] initialization error:', e);
  }

  parent.postMessage({ type: 'READY' }, '*');
})();
</script>
</body>
</html>`;
}

export interface SandboxCallbacks {
  onSidebarPanel: (config: SidebarPanelConfig) => void;
  onSlashCommand: (config: SlashCommandConfig) => void;
  onMessageRenderer: (config: MessageRendererConfig) => void;
  onSendMessage: (channelId: string, content: string) => Promise<void>;
  onThemeOverride: (vars: Record<string, string>) => void;
  onNotification: (title: string, body: string) => void;
  onSidebarPanelUpdate: (title: string, html: string) => void;
  onReady: () => void;
}

/**
 * Create a sandboxed iframe for a plugin and wire up message passing.
 * The iframe uses sandbox="allow-scripts" which prevents same-origin access
 * and restricts the plugin to only running JavaScript within its own context.
 */
export function createPluginSandbox(
  manifest: PluginManifest,
  code: string,
  callbacks: SandboxCallbacks,
): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.sandbox.add('allow-scripts');
  iframe.style.display = 'none';
  iframe.setAttribute('data-plugin-id', manifest.id);

  // Create the sandbox HTML
  const html = createSandboxHTML(manifest.id, manifest.permissions, code);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  // Message handler
  const handleMessage = (event: MessageEvent) => {
    // Only accept messages from this iframe
    if (event.source !== iframe.contentWindow) return;

    const data = event.data as PluginToHostMessage;
    if (!data?.type) return;

    switch (data.type) {
      case 'REGISTER_SIDEBAR_PANEL': {
        const sanitizedHtml = DOMPurify.sanitize(data.html, {
          ALLOWED_TAGS: ['div', 'span', 'p', 'br', 'strong', 'em', 'b', 'i', 'code', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'hr'],
          ALLOWED_ATTR: ['style', 'class'],
        });
        callbacks.onSidebarPanel({
          pluginId: manifest.id,
          title: String(data.title).slice(0, 50),
          icon: String(data.icon || '').slice(0, 10),
          html: sanitizedHtml,
        });
        break;
      }
      case 'REGISTER_SLASH_COMMAND':
        callbacks.onSlashCommand({
          pluginId: manifest.id,
          name: String(data.name).slice(0, 32).replace(/[^a-z0-9-_]/gi, ''),
          description: String(data.description).slice(0, 100),
        });
        break;
      case 'REGISTER_MESSAGE_RENDERER':
        callbacks.onMessageRenderer({
          pluginId: manifest.id,
          matchPattern: String(data.matchPattern).slice(0, 1000),
          renderTemplate: String(data.renderTemplate).slice(0, 5000),
        });
        break;
      case 'SEND_MESSAGE':
        if (manifest.permissions.includes('send_messages')) {
          callbacks.onSendMessage(
            String(data.channelId).slice(0, 50),
            String(data.content).slice(0, 2000),
          ).catch(() => {});
        }
        break;
      case 'STORAGE_GET': {
        const storageKey = `gratonite:plugin:${manifest.id}:${String(data.key).slice(0, 100)}`;
        const value = localStorage.getItem(storageKey);
        iframe.contentWindow?.postMessage({
          type: 'STORAGE_RESULT',
          requestId: data.requestId,
          value,
        }, '*');
        break;
      }
      case 'STORAGE_SET': {
        const storageKey = `gratonite:plugin:${manifest.id}:${String(data.key).slice(0, 100)}`;
        try {
          localStorage.setItem(storageKey, String(data.value).slice(0, 10000));
        } catch { /* quota exceeded */ }
        iframe.contentWindow?.postMessage({
          type: 'STORAGE_RESULT',
          requestId: data.requestId,
          value: null,
        }, '*');
        break;
      }
      case 'STORAGE_DELETE': {
        const storageKey = `gratonite:plugin:${manifest.id}:${String(data.key).slice(0, 100)}`;
        localStorage.removeItem(storageKey);
        iframe.contentWindow?.postMessage({
          type: 'STORAGE_RESULT',
          requestId: data.requestId,
          value: null,
        }, '*');
        break;
      }
      case 'SET_THEME_OVERRIDE':
        if (manifest.permissions.includes('theme_modify') && data.vars && typeof data.vars === 'object') {
          // Sanitize CSS variable names and values
          const cleanVars: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.vars)) {
            if (k.startsWith('--') && typeof v === 'string' && v.length < 100) {
              cleanVars[k] = v;
            }
          }
          callbacks.onThemeOverride(cleanVars);
        }
        break;
      case 'SHOW_NOTIFICATION':
        if (manifest.permissions.includes('notifications')) {
          callbacks.onNotification(
            String(data.title).slice(0, 100),
            String(data.body).slice(0, 300),
          );
        }
        break;
      case 'SIDEBAR_PANEL_UPDATE': {
        const sanitizedHtml = DOMPurify.sanitize(data.html, {
          ALLOWED_TAGS: ['div', 'span', 'p', 'br', 'strong', 'em', 'b', 'i', 'code', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'hr'],
          ALLOWED_ATTR: ['style', 'class'],
        });
        callbacks.onSidebarPanelUpdate(String(data.title).slice(0, 50), sanitizedHtml);
        break;
      }
      case 'READY':
        callbacks.onReady();
        break;
    }
  };

  window.addEventListener('message', handleMessage);

  // Store cleanup reference
  (iframe as any)._cleanup = () => {
    window.removeEventListener('message', handleMessage);
    URL.revokeObjectURL(url);
  };

  iframe.src = url;
  document.body.appendChild(iframe);

  return iframe;
}

/**
 * Destroy a plugin sandbox and clean up resources.
 */
export function destroyPluginSandbox(iframe: HTMLIFrameElement): void {
  const cleanup = (iframe as any)._cleanup;
  if (typeof cleanup === 'function') cleanup();
  iframe.remove();
}

/**
 * Send a message event to a plugin sandbox.
 */
export function sendMessageToPlugin(
  iframe: HTMLIFrameElement,
  content: string,
  author: string,
  channelId: string,
): void {
  iframe.contentWindow?.postMessage({
    type: 'MESSAGE_EVENT',
    content,
    author,
    channelId,
  }, '*');
}

/**
 * Invoke a slash command in a plugin sandbox.
 */
export function invokeSlashCommand(
  iframe: HTMLIFrameElement,
  name: string,
  args: string,
): void {
  iframe.contentWindow?.postMessage({
    type: 'SLASH_COMMAND_INVOKE',
    name,
    args,
  }, '*');
}
