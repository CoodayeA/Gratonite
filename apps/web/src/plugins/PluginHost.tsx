/**
 * PluginHost.tsx — React component that manages the plugin lifecycle.
 *
 * Initializes the plugin system on mount, renders sidebar panels from plugins,
 * and dispatches events to active plugins.
 *
 * SECURITY: All plugin HTML output is sanitized with DOMPurify before rendering
 * via React's dangerouslySetInnerHTML (which requires explicit DOMPurify sanitization).
 */
import { useEffect, useState, useMemo } from 'react';
import DOMPurify from 'dompurify';
import {
  initPluginSystem,
  getSidebarPanels,
  onPluginChange,
  dispatchMessageToPlugins,
  getInstalledPlugins,
  installPlugin,
  uninstallPlugin,
  togglePlugin,
  getSlashCommands,
} from './PluginSDK';
import { onMessageCreate, type MessageCreatePayload } from '../lib/socket';
import type { SidebarPanelConfig, PluginInstance } from './types';

let initialized = false;

const PURIFY_CONFIG = {
  ALLOWED_TAGS: ['div', 'span', 'p', 'br', 'strong', 'em', 'b', 'i', 'code', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'hr'],
  ALLOWED_ATTR: ['style', 'class'],
};

/**
 * Hook to initialize the plugin system and subscribe to updates.
 * Returns the current plugin state for use in components.
 */
export function usePluginHost() {
  const [panels, setPanels] = useState<SidebarPanelConfig[]>([]);
  const [plugins, setPlugins] = useState<PluginInstance[]>([]);
  const [slashCommands, setSlashCommands] = useState<{ pluginId: string; name: string; description: string }[]>([]);

  useEffect(() => {
    if (!initialized) {
      initialized = true;
      initPluginSystem();
    }

    const unsub = onPluginChange(() => {
      setPanels([...getSidebarPanels()]);
      setPlugins([...getInstalledPlugins()]);
      setSlashCommands([...getSlashCommands()]);
    });

    setPanels([...getSidebarPanels()]);
    setPlugins([...getInstalledPlugins()]);
    setSlashCommands([...getSlashCommands()]);

    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onMessageCreate((payload: MessageCreatePayload) => {
      dispatchMessageToPlugins(
        payload.content || '',
        payload.author?.username || payload.authorId || 'Unknown',
        payload.channelId,
      );
    });
    return unsub;
  }, []);

  return {
    plugins,
    sidebarPanels: panels,
    slashCommands,
    installPlugin,
    uninstallPlugin,
    togglePlugin,
    dispatchMessage: dispatchMessageToPlugins,
  };
}

/**
 * Individual sanitized panel renderer.
 * Uses DOMPurify to sanitize plugin HTML before rendering.
 */
function SanitizedPanelContent({ html }: { html: string }) {
  const sanitized = useMemo(() => DOMPurify.sanitize(html, PURIFY_CONFIG), [html]);
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

/**
 * Component that renders all active plugin sidebar panels.
 */
export function PluginSidebarPanels() {
  const { sidebarPanels } = usePluginHost();

  if (sidebarPanels.length === 0) return null;

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        padding: '4px 12px 8px',
        letterSpacing: 0.5,
      }}>
        Plugins
      </div>
      {sidebarPanels.map((panel, i) => (
        <div key={`${panel.pluginId}-${panel.title}-${i}`} style={{
          margin: '0 8px 8px',
          background: 'var(--bg-tertiary)',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '6px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span>{panel.icon}</span>
            <span>{panel.title}</span>
          </div>
          <SanitizedPanelContent html={panel.html} />
        </div>
      ))}
    </div>
  );
}

export default PluginSidebarPanels;
