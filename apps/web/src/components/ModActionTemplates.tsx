import { useState } from 'react';
import { Zap, AlertTriangle, Ban, Clock, MessageSquare, Shield } from 'lucide-react';

interface ModTemplate {
    id: string;
    name: string;
    actionType: 'warn' | 'timeout' | 'kick' | 'ban' | 'mute';
    duration?: number; // seconds
    reason: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

const DEFAULT_TEMPLATES: ModTemplate[] = [
    { id: 'first-warning', name: 'First Warning', actionType: 'warn', reason: 'This is your first warning. Please review the server rules.', severity: 'low' },
    { id: 'spam-timeout', name: 'Spam Timeout (1h)', actionType: 'timeout', duration: 3600, reason: 'Spamming messages in channels.', severity: 'medium' },
    { id: 'nsfw-ban', name: 'NSFW Content Ban', actionType: 'ban', reason: 'Posting NSFW content outside designated channels.', severity: 'critical' },
    { id: 'verbal-warning', name: 'Verbal Warning', actionType: 'warn', reason: 'Please be more mindful of your behavior.', severity: 'low' },
    { id: 'mute-24h', name: 'Mute (24h)', actionType: 'mute', duration: 86400, reason: 'Repeated rule violations. Muted for 24 hours.', severity: 'high' },
];

const SEVERITY_COLORS: Record<string, string> = {
    low: 'var(--success)',
    medium: 'var(--warning)',
    high: '#f97316',
    critical: 'var(--error)',
};

const ACTION_ICONS: Record<string, typeof Shield> = {
    warn: AlertTriangle,
    timeout: Clock,
    kick: Zap,
    ban: Ban,
    mute: MessageSquare,
};

interface Props {
    onApply: (template: ModTemplate, targetUserId: string) => void;
    targetUserId: string;
    targetUsername: string;
}

export default function ModActionTemplates({ onApply, targetUserId, targetUsername }: Props) {
    const [templates] = useState<ModTemplate[]>(DEFAULT_TEMPLATES);
    const [confirmId, setConfirmId] = useState<string | null>(null);

    const handleApply = (template: ModTemplate) => {
        if (confirmId === template.id) {
            onApply(template, targetUserId);
            setConfirmId(null);
        } else {
            setConfirmId(template.id);
            setTimeout(() => setConfirmId(null), 3000);
        }
    };

    const formatDuration = (seconds: number | undefined) => {
        if (!seconds) return '';
        if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
        return `${Math.round(seconds / 86400)}d`;
    };

    return (
        <div style={{
            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--stroke)', overflow: 'hidden',
        }}>
            <div style={{
                padding: '10px 14px', borderBottom: '1px solid var(--stroke)',
                background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
                <Shield size={14} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Quick Actions for {targetUsername}</span>
            </div>

            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {templates.map(t => {
                    const Icon = ACTION_ICONS[t.actionType] || Shield;
                    const isConfirming = confirmId === t.id;
                    return (
                        <button
                            key={t.id}
                            onClick={() => handleApply(t)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                                background: isConfirming ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-primary)',
                                border: isConfirming ? '1px solid var(--error)' : '1px solid transparent',
                                cursor: 'pointer', textAlign: 'left', width: '100%',
                                transition: 'all 0.15s',
                            }}
                        >
                            <Icon size={14} style={{ color: SEVERITY_COLORS[t.severity], flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {t.name}
                                    {t.duration && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({formatDuration(t.duration)})</span>}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {t.reason}
                                </div>
                            </div>
                            <div style={{
                                width: '6px', height: '6px', borderRadius: '50%',
                                background: SEVERITY_COLORS[t.severity], flexShrink: 0,
                            }} />
                            {isConfirming && (
                                <span style={{ fontSize: '10px', color: 'var(--error)', fontWeight: 600, flexShrink: 0 }}>Confirm?</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
