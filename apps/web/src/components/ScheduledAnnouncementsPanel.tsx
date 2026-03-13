import { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Edit2, Send, X } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from './ui/ToastManager';

interface ScheduledMessage {
    id: string;
    channelId: string;
    content: string;
    scheduledAt: string;
    metadata?: { isAnnouncement?: boolean };
}

interface Props {
    guildId: string;
    channels: Array<{ id: string; name: string }>;
    onClose: () => void;
}

export default function ScheduledAnnouncementsPanel({ guildId, channels, onClose }: Props) {
    const { addToast } = useToast();
    const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [content, setContent] = useState('');
    const [selectedChannel, setSelectedChannel] = useState(channels[0]?.id || '');
    const [scheduledDate, setScheduledDate] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        api.scheduledMessages?.list(guildId).then((msgs: any[]) => {
            setScheduled(msgs || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [guildId]);

    const handleCreate = async () => {
        if (!content.trim() || !selectedChannel || !scheduledDate || !scheduledTime) {
            addToast({ title: 'Please fill all fields', variant: 'error' });
            return;
        }
        setSubmitting(true);
        try {
            const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
            const msg = await api.scheduledMessages?.create(selectedChannel, {
                content: content.trim(),
                scheduledAt,
                metadata: { isAnnouncement: true },
            });
            if (msg) setScheduled(prev => [...prev, msg as ScheduledMessage]);
            setContent('');
            setScheduledDate('');
            setScheduledTime('');
            setShowForm(false);
            addToast({ title: 'Announcement scheduled', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to schedule announcement', variant: 'error' });
        }
        setSubmitting(false);
    };

    const handleDelete = async (id: string) => {
        try {
            await api.scheduledMessages?.delete(id);
            setScheduled(prev => prev.filter(m => m.id !== id));
            addToast({ title: 'Scheduled message deleted', variant: 'info' });
        } catch {
            addToast({ title: 'Failed to delete', variant: 'error' });
        }
    };

    return (
        <div style={{
            background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--stroke)', overflow: 'hidden',
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: '1px solid var(--stroke)', background: 'var(--bg-elevated)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={16} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>Scheduled Announcements</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setShowForm(!showForm)} style={{
                        padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--accent-primary)', color: '#000', border: 'none',
                        fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px',
                    }}>
                        <Plus size={12} /> New
                    </button>
                    <X size={16} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={onClose} />
                </div>
            </div>

            {showForm && (
                <div style={{ padding: '16px', borderBottom: '1px solid var(--stroke)', background: 'var(--bg-tertiary)' }}>
                    <textarea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        placeholder="Announcement content..."
                        rows={3}
                        style={{
                            width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--stroke)',
                            borderRadius: 'var(--radius-sm)', padding: '8px', color: 'var(--text-primary)',
                            fontSize: '13px', resize: 'vertical', outline: 'none',
                        }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <select
                            value={selectedChannel}
                            onChange={e => setSelectedChannel(e.target.value)}
                            style={{
                                flex: 1, minWidth: '140px', padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                                background: 'var(--bg-primary)', border: '1px solid var(--stroke)',
                                color: 'var(--text-primary)', fontSize: '12px',
                            }}
                        >
                            {channels.map(ch => (
                                <option key={ch.id} value={ch.id}>#{ch.name}</option>
                            ))}
                        </select>
                        <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                            style={{
                                padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                                background: 'var(--bg-primary)', border: '1px solid var(--stroke)',
                                color: 'var(--text-primary)', fontSize: '12px',
                            }}
                        />
                        <input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
                            style={{
                                padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                                background: 'var(--bg-primary)', border: '1px solid var(--stroke)',
                                color: 'var(--text-primary)', fontSize: '12px',
                            }}
                        />
                        <button onClick={handleCreate} disabled={submitting} style={{
                            padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                            background: 'var(--accent-primary)', color: '#000', border: 'none',
                            fontSize: '12px', fontWeight: 600, cursor: submitting ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '4px',
                        }}>
                            <Send size={12} /> Schedule
                        </button>
                    </div>
                </div>
            )}

            <div style={{ padding: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: '13px' }}>Loading...</div>
                ) : scheduled.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: '13px' }}>
                        No scheduled announcements.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {scheduled.map(msg => {
                            const ch = channels.find(c => c.id === msg.channelId);
                            return (
                                <div key={msg.id} style={{
                                    background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)',
                                    padding: '10px', display: 'flex', gap: '10px', alignItems: 'flex-start',
                                }}>
                                    <Clock size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                            #{ch?.name || 'unknown'} &middot; {new Date(msg.scheduledAt).toLocaleString()}
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                                            {msg.content.length > 150 ? msg.content.slice(0, 150) + '...' : msg.content}
                                        </div>
                                    </div>
                                    <button onClick={() => handleDelete(msg.id)} style={{
                                        padding: '4px', background: 'transparent', border: 'none',
                                        color: 'var(--text-muted)', cursor: 'pointer',
                                    }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
