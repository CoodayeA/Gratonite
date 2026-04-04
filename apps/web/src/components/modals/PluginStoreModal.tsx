import { useState, useCallback, useEffect } from 'react';
import { X, Download, Trash2, ToggleLeft, ToggleRight, Package, Shield } from 'lucide-react';
import { ModalWrapper } from '../ui/ModalWrapper';
import { BUILTIN_PLUGINS } from '../../plugins/builtinPlugins';
import { usePluginHost } from '../../plugins/PluginHost';
import { isPluginInstalled, getAvailablePlugins } from '../../plugins/PluginSDK';
import type { PluginManifest } from '../../plugins/types';

interface Props {
    onClose: () => void;
    /** Legacy props — kept for backward compatibility but no longer required. */
    installedPlugins?: Array<{ manifest: PluginManifest; enabled: boolean }>;
    onInstall?: (manifest: PluginManifest) => void;
    onUninstall?: (pluginId: string) => void;
    onToggle?: (pluginId: string) => void;
}

export default function PluginStoreModal({ onClose, installedPlugins: propPlugins, onInstall: propInstall, onUninstall: propUninstall, onToggle: propToggle }: Props) {
    const { plugins: sdkPlugins, installPlugin: sdkInstall, uninstallPlugin: sdkUninstall, togglePlugin: sdkToggle } = usePluginHost();
    const [activeTab, setActiveTab] = useState<'browse' | 'installed'>('browse');

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);
    const [selectedPlugin, setSelectedPlugin] = useState<PluginManifest | null>(null);

    // Use SDK-managed plugins, falling back to legacy props for backward compat
    const installedPlugins = propPlugins ?? sdkPlugins.map(p => ({ manifest: p.manifest, enabled: p.enabled }));
    const handleInstall = useCallback((manifest: PluginManifest) => {
        if (propInstall) propInstall(manifest);
        else sdkInstall(manifest);
    }, [propInstall, sdkInstall]);
    const handleUninstall = useCallback((pluginId: string) => {
        if (propUninstall) propUninstall(pluginId);
        else sdkUninstall(pluginId);
    }, [propUninstall, sdkUninstall]);
    const handleToggle = useCallback((pluginId: string) => {
        if (propToggle) propToggle(pluginId);
        else {
            const plugin = installedPlugins.find(p => p.manifest.id === pluginId);
            sdkToggle(pluginId, !(plugin?.enabled ?? false));
        }
    }, [propToggle, sdkToggle, installedPlugins]);

    const isInstalled = (id: string) => installedPlugins.some(p => p.manifest.id === id);
    const isEnabled = (id: string) => installedPlugins.find(p => p.manifest.id === id)?.enabled ?? false;

    const availablePlugins = getAvailablePlugins();

    return (
        <ModalWrapper isOpen={true}>
            <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
                <div role="dialog" aria-modal="true" aria-label="Plugin store" style={{ width: 640, maxWidth: '95vw', maxHeight: '80vh', overflow: 'hidden', background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid var(--stroke)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--stroke)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Package size={20} style={{ color: 'var(--accent-primary)' }} />
                            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Plugins</h2>
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }} aria-label="Close"><X size={20} /></button>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 4, padding: '12px 24px', borderBottom: '1px solid var(--stroke)' }}>
                        {(['browse', 'installed'] as const).map(tab => (
                            <button key={tab} onClick={() => { setActiveTab(tab); setSelectedPlugin(null); }}
                                style={{
                                    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                                    fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                                    background: activeTab === tab ? 'var(--bg-tertiary)' : 'transparent',
                                    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                                }}
                            >
                                {tab === 'browse' ? 'Browse' : `Installed (${installedPlugins.length})`}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                        {selectedPlugin ? (
                            <div>
                                <button onClick={() => setSelectedPlugin(null)} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 13, marginBottom: 16, padding: 0, fontFamily: 'inherit' }}>
                                    Back
                                </button>
                                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{selectedPlugin.name}</h3>
                                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>{selectedPlugin.description}</p>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                                    <span>v{selectedPlugin.version}</span> &middot; <span>by {selectedPlugin.author}</span>
                                </div>

                                {/* Permissions */}
                                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                        <Shield size={14} style={{ color: 'var(--text-muted)' }} />
                                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Permissions</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {selectedPlugin.permissions.map(p => (
                                            <span key={p} style={{ padding: '3px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.12)', color: 'var(--accent-primary)', fontSize: 11, fontWeight: 600 }}>
                                                {p.replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {isInstalled(selectedPlugin.id) ? (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => handleToggle(selectedPlugin.id)}
                                            style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                            {isEnabled(selectedPlugin.id) ? <><ToggleRight size={16} /> Disable</> : <><ToggleLeft size={16} /> Enable</>}
                                        </button>
                                        <button onClick={() => { handleUninstall(selectedPlugin.id); setSelectedPlugin(null); }}
                                            style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.12)', color: '#ef4444', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Trash2 size={14} /> Uninstall
                                        </button>
                                    </div>
                                ) : (
                                    <button onClick={() => { handleInstall(selectedPlugin); setSelectedPlugin(null); }}
                                        style={{ width: '100%', padding: '10px 16px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                        <Download size={16} /> Install Plugin
                                    </button>
                                )}
                            </div>
                        ) : activeTab === 'browse' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {availablePlugins.map(plugin => (
                                    <div key={plugin.id}
                                        onClick={() => setSelectedPlugin(plugin)}
                                        style={{
                                            background: 'var(--bg-tertiary)', borderRadius: 10, border: '1px solid var(--stroke)',
                                            padding: 16, cursor: 'pointer', transition: 'border-color 0.15s',
                                        }}
                                        onMouseOver={e => e.currentTarget.style.borderColor = 'var(--text-muted)'}
                                        onMouseOut={e => e.currentTarget.style.borderColor = 'var(--stroke)'}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{plugin.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{plugin.description}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>by {plugin.author} &middot; v{plugin.version}</div>
                                            </div>
                                            {isInstalled(plugin.id) ? (
                                                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>Installed</span>
                                            ) : (
                                                <Download size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {installedPlugins.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                                        <Package size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
                                        <p style={{ fontSize: 14 }}>No plugins installed yet. Browse the store to get started!</p>
                                    </div>
                                ) : (
                                    installedPlugins.map(({ manifest, enabled }) => (
                                        <div key={manifest.id}
                                            style={{
                                                background: 'var(--bg-tertiary)', borderRadius: 10, border: '1px solid var(--stroke)',
                                                padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            }}
                                        >
                                            <div onClick={() => setSelectedPlugin(manifest)} style={{ cursor: 'pointer' }}>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{manifest.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>v{manifest.version}</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <button onClick={() => handleToggle(manifest.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: enabled ? 'var(--accent-primary)' : 'var(--text-muted)', padding: 4 }}>
                                                    {enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                                                </button>
                                                <button onClick={() => handleUninstall(manifest.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ModalWrapper>
    );
}
