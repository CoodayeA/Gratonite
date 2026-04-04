import { useState, useEffect, useCallback } from 'react';
import { Globe, Shield, ShieldOff, Activity, Clock, Users, ToggleLeft, ToggleRight, Ban } from 'lucide-react';
import { api } from '../../lib/api';
import FederationBadge from '../federation/FederationBadge';

interface FederatedInstance {
    instanceId: string;
    domain: string;
    trustLevel: 'verified' | 'manually_trusted' | 'auto_discovered';
    memberCount: number;
    connectedAt: string;
}

interface ActivityEntry {
    id: string;
    type: 'join' | 'leave' | 'message' | 'sync';
    instanceDomain: string;
    username: string;
    federationAddress: string;
    timestamp: string;
}

interface GuildFederationPanelProps {
    guildId: string;
    addToast: (t: { title: string; description?: string; variant: 'success' | 'error' | 'info' | 'achievement' | 'undo' }) => void;
}

const TYPE_LABELS: Record<ActivityEntry['type'], string> = {
    join: 'Joined',
    leave: 'Left',
    message: 'Sent a message',
    sync: 'Profile synced',
};

const TYPE_COLORS: Record<ActivityEntry['type'], string> = {
    join: '#22c55e',
    leave: '#f87171',
    message: '#60a5fa',
    sync: '#a78bfa',
};

export function GuildFederationPanel({ guildId, addToast }: GuildFederationPanelProps) {
    const [enabled, setEnabled] = useState(false);
    const [togglingEnabled, setTogglingEnabled] = useState(false);
    const [instances, setInstances] = useState<FederatedInstance[]>([]);
    const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
    const [loadingInstances, setLoadingInstances] = useState(true);
    const [loadingActivity, setLoadingActivity] = useState(true);
    const [blockingDomain, setBlockingDomain] = useState<string | null>(null);

    const loadAll = useCallback(async () => {
        setLoadingInstances(true);
        setLoadingActivity(true);

        try {
            const settings = await api.guildFederation.getSettings(guildId);
            setEnabled(settings.enabled);
        } catch {
            // default to false if endpoint not available yet
        }

        try {
            const data = await api.guildFederation.listInstances(guildId);
            setInstances(data);
        } catch {
            setInstances([]);
        } finally {
            setLoadingInstances(false);
        }

        try {
            const data = await api.guildFederation.getActivityLog(guildId);
            setActivityLog(data);
        } catch {
            setActivityLog([]);
        } finally {
            setLoadingActivity(false);
        }
    }, [guildId]);

    useEffect(() => { loadAll(); }, [loadAll]);

    const handleToggleFederation = async () => {
        setTogglingEnabled(true);
        try {
            await api.guildFederation.setEnabled(guildId, !enabled);
            setEnabled(prev => !prev);
            addToast({ title: `Federation ${!enabled ? 'enabled' : 'disabled'}`, variant: 'success' });
        } catch {
            addToast({ title: 'Failed to update federation setting', variant: 'error' });
        } finally {
            setTogglingEnabled(false);
        }
    };

    const handleBlockInstance = async (domain: string) => {
        setBlockingDomain(domain);
        try {
            await api.guildFederation.blockInstance(guildId, domain);
            setInstances(prev => prev.filter(i => i.domain !== domain));
            addToast({ title: `Blocked ${domain}`, description: 'Members from this instance can no longer join.', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to block instance', variant: 'error' });
        } finally {
            setBlockingDomain(null);
        }
    };

    const labelStyle: React.CSSProperties = {
        fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)',
        fontWeight: 700, letterSpacing: '0.05em', marginBottom: '12px',
    };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Federation</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '28px', fontSize: '13px' }}>
                Manage which federated instances interact with this server and review cross-instance activity.
            </p>

            {/* Enable / Disable toggle */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', background: 'var(--bg-elevated)',
                border: '1px solid var(--stroke)', borderRadius: '12px', marginBottom: '28px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Globe size={20} style={{ color: 'var(--accent-primary)' }} />
                    <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>Enable Federation</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Allow members from other Gratonite instances to join this server.
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleToggleFederation}
                    disabled={togglingEnabled}
                    style={{
                        background: 'none', border: 'none', cursor: togglingEnabled ? 'not-allowed' : 'pointer',
                        color: enabled ? 'var(--accent-primary)' : 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', opacity: togglingEnabled ? 0.5 : 1,
                    }}
                    aria-label={enabled ? 'Disable federation' : 'Enable federation'}
                >
                    {enabled ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                </button>
            </div>

            {/* Federated instances list */}
            <div style={{ marginBottom: '28px' }}>
                <div style={labelStyle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={12} /> Federated Instances
                    </span>
                </div>

                {loadingInstances ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        Loading instances…
                    </div>
                ) : instances.length === 0 ? (
                    <div style={{
                        padding: '32px', textAlign: 'center', background: 'var(--bg-elevated)',
                        border: '1px solid var(--stroke)', borderRadius: '12px',
                    }}>
                        <Globe size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
                        <p style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>No federated instances yet</p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                            When members from other instances join, their instances will appear here.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {instances.map(inst => (
                            <div key={inst.instanceId} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '12px 16px', background: 'var(--bg-elevated)',
                                border: '1px solid var(--stroke)', borderRadius: '10px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: '8px',
                                        background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <Globe size={18} style={{ color: 'var(--text-muted)' }} />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {inst.domain}
                                            </span>
                                            <FederationBadge domain={inst.domain} trustLevel={inst.trustLevel} size="sm" />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '3px' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                                <Users size={10} /> {inst.memberCount} member{inst.memberCount !== 1 ? 's' : ''}
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                                <Clock size={10} /> Since {new Date(inst.connectedAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleBlockInstance(inst.domain)}
                                    disabled={blockingDomain === inst.domain}
                                    title={`Block ${inst.domain}`}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)',
                                        background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                        cursor: blockingDomain === inst.domain ? 'not-allowed' : 'pointer',
                                        fontSize: '12px', fontWeight: 600, opacity: blockingDomain === inst.domain ? 0.5 : 1,
                                        flexShrink: 0,
                                    }}
                                >
                                    <Ban size={13} />
                                    {blockingDomain === inst.domain ? 'Blocking…' : 'Block'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Activity Log */}
            <div>
                <div style={labelStyle}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Activity size={12} /> Recent Federation Activity
                    </span>
                </div>

                {loadingActivity ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        Loading activity…
                    </div>
                ) : activityLog.length === 0 ? (
                    <div style={{
                        padding: '24px', textAlign: 'center', background: 'var(--bg-elevated)',
                        border: '1px solid var(--stroke)', borderRadius: '12px',
                        color: 'var(--text-muted)', fontSize: '13px',
                    }}>
                        No recent federation activity.
                    </div>
                ) : (
                    <div style={{
                        background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                        borderRadius: '12px', overflow: 'hidden',
                    }}>
                        {activityLog.slice(0, 20).map((entry, i) => (
                            <div key={entry.id} style={{
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '10px 16px',
                                borderBottom: i < activityLog.length - 1 ? '1px solid var(--stroke)' : undefined,
                            }}>
                                <div style={{
                                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                    background: TYPE_COLORS[entry.type],
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                        {entry.username}
                                    </span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 4px' }}>
                                        {TYPE_LABELS[entry.type]}
                                    </span>
                                    <span style={{
                                        fontSize: '11px', color: 'var(--text-muted)',
                                        background: 'var(--bg-tertiary)', borderRadius: '4px', padding: '1px 5px',
                                    }}>
                                        {entry.instanceDomain}
                                    </span>
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Info section */}
            <div style={{
                marginTop: '24px', padding: '14px 16px',
                background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start',
            }}>
                <ShieldOff size={16} style={{ color: '#60a5fa', flexShrink: 0, marginTop: '1px' }} />
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                    Blocking an instance prevents new members from that instance from joining.
                    Existing members are not removed automatically.
                    Contact server admins if you need to remove existing federated members.
                </p>
            </div>
        </>
    );
}
