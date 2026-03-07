import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar, Clock, MapPin, Users, Plus, MoreHorizontal, X, Link, Share2, Trash2, Edit3 } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

interface ScheduledEvent {
    id: string;
    name: string;
    description: string | null;
    startTime: string;
    endTime: string | null;
    location: string | null;
    creatorId: string;
    creatorName: string;
    interestedCount: number;
    status: string;
    isInterested: boolean;
    createdAt: string;
}

function formatEventDate(isoString: string): string {
    const dateObj = new Date(isoString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateObj.toDateString() === today.toDateString()) {
        return `Today, ${dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } else if (dateObj.toDateString() === tomorrow.toDateString()) {
        return `Tomorrow, ${dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    } else {
        return `${dateObj.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}, ${dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    }
}

function getDateBadge(isoString: string): { label: string; value: string } {
    const dateObj = new Date(isoString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateObj.toDateString() === today.toDateString()) {
        return { label: 'Today', value: dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) };
    } else if (dateObj.toDateString() === tomorrow.toDateString()) {
        return { label: 'Tomorrow', value: dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) };
    } else {
        return {
            label: dateObj.toLocaleDateString([], { month: 'short' }),
            value: String(dateObj.getDate()),
        };
    }
}

const EventOptionsMenu = ({ event, guildId, onClose, onDeleted }: { event: ScheduledEvent; guildId: string; onClose: () => void; onDeleted: (id: string) => void }) => {
    const { addToast } = useToast();
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleCopyLink = () => {
        const link = `${window.location.origin}/events/${event.id}`;
        navigator.clipboard.writeText(link).catch(() => {});
        addToast({ title: 'Link Copied', description: `Event link for "${event.name}" copied to clipboard.`, variant: 'success' });
        onClose();
    };

    const handleShare = () => {
        const link = `${window.location.origin}/events/${event.id}`;
        if (navigator.share) {
            navigator.share({ title: event.name, url: link }).catch(() => {});
        } else {
            navigator.clipboard.writeText(link).catch(() => {});
            addToast({ title: 'Link Copied', description: `Event link for "${event.name}" copied to clipboard.`, variant: 'success' });
        }
        onClose();
    };

    const handleDelete = async () => {
        try {
            await api.events.delete(guildId, event.id);
            onDeleted(event.id);
            addToast({ title: 'Event Deleted', description: `"${event.name}" has been removed.`, variant: 'success' });
        } catch {
            addToast({ title: 'Failed to delete event', variant: 'error' });
        }
        onClose();
    };

    const btnBase: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', textAlign: 'left' };

    return (
        <div ref={menuRef} style={{ position: 'absolute', bottom: '44px', right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '4px', zIndex: 100, minWidth: '180px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
            <button onClick={handleShare} style={btnBase}
                onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
                <Share2 size={15} /> Share Event
            </button>
            <button onClick={handleCopyLink} style={btnBase}
                onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
                <Link size={15} /> Copy Link
            </button>
            <div style={{ height: '1px', background: 'var(--stroke)', margin: '4px 0' }} />
            <button onClick={handleDelete} style={{ ...btnBase, color: 'var(--error)' }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,80,80,0.1)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
            >
                <Trash2 size={15} /> Delete Event
            </button>
            <div style={{ height: '1px', background: 'var(--stroke)', margin: '4px 0' }} />
            <button onClick={onClose} style={{ ...btnBase, color: 'var(--text-muted)' }}
                onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
                <X size={15} /> Close
            </button>
        </div>
    );
};

const EventScheduler = () => {
    const { guildId } = useParams<{ guildId: string }>();
    const { addToast } = useToast();
    const [events, setEvents] = useState<ScheduledEvent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [optionsOpenFor, setOptionsOpenFor] = useState<string | null>(null);

    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newLocation, setNewLocation] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [locationType, setLocationType] = useState<'voice' | 'custom'>('custom');
    const [selectedChannelId, setSelectedChannelId] = useState('');
    const [voiceChannels, setVoiceChannels] = useState<Array<{ id: string; name: string }>>([]);

    // Fetch voice channels for location dropdown
    useEffect(() => {
        if (!guildId) return;
        api.channels.getGuildChannels(guildId).then((channels: any[]) => {
            const voice = channels.filter(
                (ch: any) => ch.type === 'voice' || ch.type === 'GUILD_VOICE'
            ).map((ch: any) => ({ id: ch.id, name: ch.name }));
            setVoiceChannels(voice);
        }).catch(() => {});
    }, [guildId]);

    // Fetch events from API
    useEffect(() => {
        if (!guildId) return;
        setIsLoading(true);
        setError(null);
        api.events.list(guildId).then((data: any[]) => {
            const mapped: ScheduledEvent[] = data.map((e: any) => ({
                id: e.id,
                name: e.name ?? e.title ?? 'Untitled Event',
                description: e.description ?? null,
                startTime: e.startTime,
                endTime: e.endTime ?? null,
                location: e.location ?? null,
                creatorId: e.creatorId ?? '',
                creatorName: e.creatorName ?? 'Server',
                interestedCount: e.interestedCount ?? 0,
                status: e.status ?? 'scheduled',
                isInterested: e.isInterested ?? false,
                createdAt: e.createdAt,
            }));
            setEvents(mapped);
        }).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Failed to load events';
            setError(msg);
        }).finally(() => {
            setIsLoading(false);
        });
    }, [guildId]);

    // Toggle interest via API
    const handleInterestToggle = async (eventId: string) => {
        if (!guildId) return;
        const event = events.find(e => e.id === eventId);
        if (!event) return;

        const wasInterested = event.isInterested;

        // Optimistic update
        setEvents(prev => prev.map(e =>
            e.id === eventId
                ? { ...e, isInterested: !wasInterested, interestedCount: e.interestedCount + (wasInterested ? -1 : 1) }
                : e
        ));

        try {
            if (wasInterested) {
                await api.events.unmarkInterested(guildId, eventId);
            } else {
                await api.events.markInterested(guildId, eventId);
            }
            addToast({
                title: wasInterested ? 'Interest Removed' : 'Marked Interested!',
                description: wasInterested ? `You're no longer interested in "${event.name}".` : `You're interested in "${event.name}".`,
                variant: wasInterested ? 'info' : 'success',
            });
        } catch {
            // Revert
            setEvents(prev => prev.map(e =>
                e.id === eventId
                    ? { ...e, isInterested: wasInterested, interestedCount: e.interestedCount + (wasInterested ? 1 : -1) }
                    : e
            ));
            addToast({ title: 'Failed to update interest', variant: 'error' });
        }
    };

    // Create event via API
    const handleCreateEvent = async () => {
        if (!guildId || !newTitle.trim() || !newDate || !newTime) return;
        setIsCreating(true);
        try {
            const startTime = new Date(`${newDate}T${newTime}`).toISOString();
            const selectedVoice = voiceChannels.find(ch => ch.id === selectedChannelId);
            const eventLocation = locationType === 'voice' && selectedVoice
                ? selectedVoice.name
                : newLocation.trim() || undefined;
            const created = await api.events.create(guildId, {
                name: newTitle.trim(),
                description: newDescription.trim() || undefined,
                startTime,
                location: eventLocation,
                entityType: locationType === 'voice' && selectedVoice ? 'VOICE' : 'EXTERNAL',
                ...(locationType === 'voice' && selectedVoice ? { channelId: selectedVoice.id } : {}),
            });
            // Refresh list
            const data = await api.events.list(guildId);
            const mapped: ScheduledEvent[] = data.map((e: any) => ({
                id: e.id,
                name: e.name ?? 'Untitled Event',
                description: e.description ?? null,
                startTime: e.startTime,
                endTime: e.endTime ?? null,
                location: e.location ?? null,
                creatorId: e.creatorId ?? '',
                creatorName: e.creatorName ?? 'Server',
                interestedCount: e.interestedCount ?? 0,
                status: e.status ?? 'scheduled',
                isInterested: e.isInterested ?? false,
                createdAt: e.createdAt,
            }));
            setEvents(mapped);
            resetForm();
            addToast({ title: 'Event Created', description: `"${newTitle.trim()}" has been scheduled.`, variant: 'success' });
        } catch {
            addToast({ title: 'Failed to create event', variant: 'error' });
        } finally {
            setIsCreating(false);
        }
    };

    const handleEventDeleted = (eventId: string) => {
        setEvents(prev => prev.filter(e => e.id !== eventId));
    };

    const resetForm = () => {
        setShowCreateForm(false);
        setNewTitle('');
        setNewDate('');
        setNewTime('');
        setNewDescription('');
        setNewLocation('');
        setLocationType('custom');
        setSelectedChannelId('');
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        height: '40px',
        padding: '0 12px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--stroke)',
        borderRadius: '8px',
        color: 'white',
        outline: 'none',
        fontSize: '14px',
        boxSizing: 'border-box',
    };

    const canSubmit = newTitle.trim() && newDate && newTime && !isCreating;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
            <header className="channel-header glass-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={20} color="var(--text-muted)" />
                    <h2 style={{ fontSize: '15px', fontWeight: 600 }}>events</h2>
                </div>
            </header>

            {isLoading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading events...</div>
                </div>
            ) : error ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ color: 'var(--error)', fontSize: '14px' }}>{error}</div>
                </div>
            ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 48px' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <div>
                            <h1 style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>Upcoming Events</h1>
                            <p style={{ color: 'var(--text-secondary)' }}>See what's happening in this server.</p>
                        </div>
                        <button onClick={() => setShowCreateForm(true)} className="auth-button" style={{ margin: 0, width: 'auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--accent-primary)', height: '40px' }}>
                            <Plus size={16} /> Create Event
                        </button>
                    </div>

                    {showCreateForm && (
                        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent-primary)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Create New Event</h3>
                                <button onClick={resetForm} style={{ width: '32px', height: '32px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <X size={16} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Event Title *</label>
                                    <input type="text" placeholder="e.g. Community Game Night" value={newTitle} onChange={e => setNewTitle(e.target.value)} style={inputStyle} />
                                </div>

                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Date *</label>
                                        <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Time *</label>
                                        <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Location</label>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setLocationType('voice')}
                                            style={{
                                                flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--stroke)',
                                                background: locationType === 'voice' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                                color: locationType === 'voice' ? '#fff' : 'var(--text-secondary)',
                                                cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                                            }}
                                        >
                                            Voice Channel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLocationType('custom')}
                                            style={{
                                                flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--stroke)',
                                                background: locationType === 'custom' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                                color: locationType === 'custom' ? '#fff' : 'var(--text-secondary)',
                                                cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                                            }}
                                        >
                                            Custom Location
                                        </button>
                                    </div>
                                    {locationType === 'voice' ? (
                                        <select
                                            value={selectedChannelId}
                                            onChange={e => setSelectedChannelId(e.target.value)}
                                            style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' as any }}
                                        >
                                            <option value="">Select a voice channel...</option>
                                            {voiceChannels.map(ch => (
                                                <option key={ch.id} value={ch.id}>{ch.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input type="text" placeholder="e.g. Voice: Lounge" value={newLocation} onChange={e => setNewLocation(e.target.value)} style={inputStyle} />
                                    )}
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Description</label>
                                    <textarea placeholder="What's this event about?" value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={3} style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical', fontFamily: 'inherit' }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                                <button onClick={resetForm} style={{ padding: '0 20px', height: '36px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                                <button
                                    onClick={handleCreateEvent}
                                    disabled={!canSubmit}
                                    className="auth-button"
                                    style={{ margin: 0, width: 'auto', padding: '0 24px', background: canSubmit ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: canSubmit ? '#fff' : 'var(--text-muted)', height: '36px', cursor: canSubmit ? 'pointer' : 'not-allowed', opacity: canSubmit ? 1 : 0.6 }}
                                >
                                    {isCreating ? 'Creating...' : 'Create Event'}
                                </button>
                            </div>
                        </div>
                    )}

                    {events.length === 0 && !showCreateForm && (
                        <div style={{ textAlign: 'center', padding: '64px 0' }}>
                            <Calendar size={48} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.5 }} />
                            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No upcoming events</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Create an event to get things started!</p>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {events.map(event => {
                            const badge = getDateBadge(event.startTime);
                            return (
                            <div key={event.id} style={{ background: 'var(--bg-elevated)', border: `1px solid ${event.isInterested ? 'var(--success)' : 'var(--stroke)'}`, borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s' }}>
                                <div style={{ height: '80px', background: 'linear-gradient(135deg, rgba(82, 109, 245, 0.2), rgba(0,0,0,0.5))', borderBottom: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', padding: '0 24px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', width: '56px', height: '56px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                                        <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: '2px' }}>{badge.label}</span>
                                        <span style={{ fontSize: '18px', fontWeight: 600 }}>{badge.value}</span>
                                    </div>
                                    {event.status !== 'scheduled' && (
                                        <span style={{ marginLeft: '16px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', padding: '4px 10px', borderRadius: '12px', background: event.status === 'active' ? 'rgba(82, 245, 109, 0.15)' : event.status === 'cancelled' ? 'rgba(255, 80, 80, 0.15)' : 'rgba(255, 255, 255, 0.1)', color: event.status === 'active' ? 'var(--success)' : event.status === 'cancelled' ? 'var(--error)' : 'var(--text-muted)' }}>
                                            {event.status}
                                        </span>
                                    )}
                                </div>

                                <div style={{ padding: '24px', display: 'flex', gap: '24px' }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>{event.name}</h3>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px', lineHeight: 1.5 }}>{event.description || 'No description provided.'}</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={16} /> {formatEventDate(event.startTime)}</div>
                                            {event.location && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={16} /> {event.location}</div>}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent-purple)', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>{event.creatorName.charAt(0)}</div>
                                                Hosted by {event.creatorName}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '1px solid var(--stroke)', paddingLeft: '24px' }}>
                                        <div>
                                            <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Users size={14} /> {event.interestedCount} Interested
                                            </div>
                                            {event.interestedCount > 0 && (
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    {Array.from({ length: Math.min(event.interestedCount, 4) }).map((_, idx) => (
                                                        <div key={idx} style={{ width: '28px', height: '28px', borderRadius: '50%', background: `hsl(${idx * 40 + 200}, 70%, 50%)`, border: '2px solid var(--bg-elevated)', marginLeft: idx > 0 ? '-8px' : '0', zIndex: 10 - idx }} />
                                                    ))}
                                                    {event.interestedCount > 4 && (
                                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-tertiary)', border: '2px solid var(--bg-elevated)', marginLeft: '-8px', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600 }}>
                                                            +{event.interestedCount - 4}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', position: 'relative' }}>
                                            <button onClick={() => handleInterestToggle(event.id)} className="auth-button" style={{ margin: 0, flex: 1, padding: '0', background: event.isInterested ? 'var(--success)' : 'var(--accent-primary)', color: '#fff', height: '36px', transition: 'all 0.15s' }}>{event.isInterested ? 'Interested' : 'Interested?'}</button>
                                            <button onClick={() => setOptionsOpenFor(optionsOpenFor === event.id ? null : event.id)} style={{ width: '36px', height: '36px', background: 'var(--bg-tertiary)', border: `1px solid ${optionsOpenFor === event.id ? 'var(--accent-primary)' : 'var(--stroke)'}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                                <MoreHorizontal size={18} />
                                            </button>
                                            {optionsOpenFor === event.id && guildId && (
                                                <EventOptionsMenu event={event} guildId={guildId} onClose={() => setOptionsOpenFor(null)} onDeleted={handleEventDeleted} />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                    </div>

                </div>
            </div>
            )}
        </div>
    );
};

export default EventScheduler;
