/**
 * builtinPlugins.ts — Three example built-in plugins for the Plugin SDK.
 *
 * a. "Word Counter" — shows word count in sidebar panel
 * b. "Timestamp Converter" — renders Unix timestamps as human-readable dates
 * c. "Code Runner" — provides /run-js slash command (runs in sandboxed iframe)
 *
 * SECURITY NOTE: All plugin code runs inside a sandboxed iframe with
 * sandbox="allow-scripts" only. The iframe has no same-origin access,
 * no access to the host page DOM, cookies, or storage. The Function
 * constructor usage in the Code Runner plugin is confined to this sandbox.
 */
import type { PluginManifest } from './types';

export const BUILTIN_PLUGINS: PluginManifest[] = [
  {
    id: 'builtin:word-counter',
    name: 'Word Counter',
    version: '1.0.0',
    description: 'Displays a live word count for messages in the current channel. Shows total words, messages counted, and average words per message in a sidebar panel.',
    author: 'Gratonite',
    permissions: ['read_messages', 'sidebar_panel'],
    entryPoint: 'builtin:word-counter',
    icon: '#',
  },
  {
    id: 'builtin:timestamp-converter',
    name: 'Timestamp Converter',
    version: '1.0.0',
    description: 'Automatically detects Unix timestamps in messages and renders them as human-readable dates and times. Supports both seconds and milliseconds.',
    author: 'Gratonite',
    permissions: ['read_messages', 'custom_renderer'],
    entryPoint: 'builtin:timestamp-converter',
    icon: '@',
  },
  {
    id: 'builtin:code-runner',
    name: 'Code Runner',
    version: '1.0.0',
    description: 'Provides a /run-js slash command that safely executes JavaScript code snippets within the plugin sandbox and displays results.',
    author: 'Gratonite',
    permissions: ['slash_command', 'sidebar_panel'],
    entryPoint: 'builtin:code-runner',
    icon: '>',
  },
];

/**
 * Get the JavaScript source code for a built-in plugin.
 * This code runs inside the sandboxed iframe.
 */
export function getBuiltinPluginCode(pluginId: string): string | null {
  switch (pluginId) {
    case 'builtin:word-counter':
      return WORD_COUNTER_CODE;
    case 'builtin:timestamp-converter':
      return TIMESTAMP_CONVERTER_CODE;
    case 'builtin:code-runner':
      return CODE_RUNNER_CODE;
    default:
      return null;
  }
}

// ─── Word Counter Plugin ─────────────────────────────────────────────────────

const WORD_COUNTER_CODE = `
var totalWords = 0;
var messageCount = 0;

function updatePanel() {
  var avg = messageCount > 0 ? (totalWords / messageCount).toFixed(1) : '0';
  gratonite.updateSidebarPanel('Word Counter', function() {
    return '<div style="padding:8px">' +
      '<p style="margin:0 0 4px"><strong>Total Words:</strong> ' + totalWords + '</p>' +
      '<p style="margin:0 0 4px"><strong>Messages:</strong> ' + messageCount + '</p>' +
      '<p style="margin:0"><strong>Avg/msg:</strong> ' + avg + '</p>' +
    '</div>';
  });
}

gratonite.registerSidebarPanel({
  title: 'Word Counter',
  icon: '#',
  render: function() {
    return '<div style="padding:8px"><p style="margin:0;color:#888">Waiting for messages...</p></div>';
  }
});

gratonite.onMessage(function(msg) {
  if (msg.content) {
    var words = msg.content.trim().split(/\\s+/).filter(function(w) { return w.length > 0; });
    totalWords += words.length;
    messageCount++;
    updatePanel();
  }
});
`;

// ─── Timestamp Converter Plugin ──────────────────────────────────────────────

const TIMESTAMP_CONVERTER_CODE = `
gratonite.registerMessageRenderer({
  match: function(content) {
    // Match messages containing Unix timestamps (10 or 13 digits)
    return /\\b(1[0-9]{9}|1[0-9]{12})\\b/.test(content);
  },
  render: function(content) {
    return content.replace(/\\b(1[0-9]{9}|1[0-9]{12})\\b/g, function(match) {
      var ts = parseInt(match, 10);
      // If 13 digits, it is in milliseconds
      if (match.length === 13) ts = Math.floor(ts / 1000);
      var date = new Date(ts * 1000);
      if (isNaN(date.getTime())) return match;
      return '<span title="Unix: ' + match + '" style="background:rgba(88,101,242,0.15);padding:1px 4px;border-radius:3px;font-size:0.9em">' +
        date.toLocaleString() + '</span>';
    });
  }
});
`;

// ─── Code Runner Plugin ──────────────────────────────────────────────────────
// NOTE: The Function constructor usage below is confined to the sandboxed iframe
// (sandbox="allow-scripts" only). It cannot access the host page, cookies, or origin.

const CODE_RUNNER_CODE = `
var lastResult = '';
var lastCode = '';

function updatePanel() {
  gratonite.updateSidebarPanel('Code Runner', function() {
    return '<div style="padding:8px">' +
      (lastCode ? '<p style="margin:0 0 4px;font-size:11px;color:#888">Last code:</p>' +
        '<pre style="margin:0 0 8px;padding:6px;background:rgba(0,0,0,0.2);border-radius:4px;font-size:12px;overflow-x:auto;white-space:pre-wrap">' + lastCode + '</pre>' : '') +
      (lastResult ? '<p style="margin:0 0 4px;font-size:11px;color:#888">Result:</p>' +
        '<pre style="margin:0;padding:6px;background:rgba(0,0,0,0.2);border-radius:4px;font-size:12px;overflow-x:auto;white-space:pre-wrap;color:#2ecc71">' + lastResult + '</pre>' :
        '<p style="margin:0;color:#888;font-size:12px">Use /run-js &lt;code&gt; to run JavaScript</p>') +
    '</div>';
  });
}

gratonite.registerSidebarPanel({
  title: 'Code Runner',
  icon: '>',
  render: function() {
    return '<div style="padding:8px"><p style="margin:0;color:#888;font-size:12px">Use /run-js &lt;code&gt; to run JavaScript</p></div>';
  }
});

gratonite.registerSlashCommand({
  name: 'run-js',
  description: 'Execute JavaScript code in the plugin sandbox',
  handler: function(args) {
    lastCode = args;
    try {
      // Runs in sandboxed iframe only - no host page access
      var result = Function('"use strict"; return (' + args + ')')();
      lastResult = String(result);
    } catch(e) {
      lastResult = 'Error: ' + e.message;
    }
    updatePanel();
  }
});
`;
