import { useState, useRef, useEffect } from 'react';
import { X, Search, Share2, Hash, Check, MessageSquare } from 'lucide-react';
import { useToast } from '../ui/ToastManager';
import { api } from '../../lib/api';
import Avatar from '../ui/Avatar';

type Destination = {
    id: string;
    name: string;
    type: 'channel' | 'dm';
    guildName?: string;
    icon?: string;
};

type ForwardModalProps = {
    message: { author: string; content: string; mediaUrl?: string };
    onClose: () => void;
    onForward: (destinations: Destination[], note: string) => void;
};

const ForwardModal = ({ message, onClose, onForward }: ForwardModalProps) => {
    const { addToast } = useToast();
    const [query, setQuery] = useState('');
    const [note, setNote] = useState('');
    const [selected, setSelected] = useState<Destination[]>([]);
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 50);
    }, []);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // Fetch guild channels and DM channels
    useEffect(() => {
        (async () => {
            setIsLoading(true);
            const all: Destination[] = [];
            try {
                // Fetch guilds and their channels
                const guilds = await api.guilds.getMine();
                for (const guild of guilds.slice(0, 10)) {
                    try {
                        const channels = await api.channels.getGuildChannels(guild.id);
                        for (const ch of channels) {
                            if ((ch as any).type === 0 || (ch as any).type === undefined) {
                                all.push({
                                    id: ch.id,
                                    name: ch.name,
                                    type: 'channel',
                                    guildName: guild.name,
                                });
                            }
                        }
                    } catch { /* ignore */ }
                }
            } catch { /* ignore */ }
            try {
                // Fetch DM channels
                const dmChannels = await api.relationships.getDmChannels();
                for (const dm of dmChannels) {
                    const recipient = dm.recipients?.[0];
                    if (recipient) {
                        all.push({
                            id: dm.id,
                            name: recipient.displayName || recipient.username || 'Unknown',
                            type: 'dm',
                        });
                    }
                }
            } catch { /* ignore */ }
            setDestinations(all);
            setIsLoading(false);
        })();
    }, []);

    const filtered = query.trim()
        ? destinations.filter(d =>
            d.name.toLowerCase().includes(query.toLowerCase()) ||
            (d.guildName && d.guildName.toLowerCase().includes(query.toLowerCase()))
        )
        : destinations;

    const toggleDestination = (dest: Destination) => {
        if (selected.find(s => s.id === dest.id)) {
            setSelected(selected.filter(s => s.id !== dest.id));
        } else if (selected.length < 5) {
            setSelected([...selected, dest]);
        }
    };

    const isSelected = (id: string) => selected.some(s => s.id === id);

    const handleForward = async () => {
        if (selected.length === 0) return;
        const prefix = note.trim() ? `${note.trim()}\n\n` : '';
        const forwardContent = `${prefix}> **Forwarded from ${message.author}**\n> ${(message.content || '').split('\n').join('\n> ')}`;
        const results = await Promise.allSettled(
            selected.map(dest => api.messages.send(dest.id, { content: forwardContent }))
        );
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        if (succeeded > 0) addToast({ title: `Message forwarded to ${succeeded} destination${succeeded > 1 ? 's' : ''}`, variant: 'success' });
        if (failed > 0) addToast({ title: `Failed to forward to ${failed} destination${failed > 1 ? 's' : ''}`, variant: 'error' });
        onForward(selected, note);
    };

    const previewContent = message.content
        ? (message.content.length > 120 ? message.content.slice(0, 120) + '...' : message.content)
        : (message.mediaUrl ? '[Media]' : '[Empty message]');

    return (
        <div
            className="modal-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
        >
            <div role="dialog" aria-modal="true" style={{
                width: 'min(520px, 95vw)', position: 'relative', overflow: 'hidden',
                background: 'var(--bg-elevated)', border: '3px solid #000000',
                boxShadow: '8px 8px 0 #000000', borderRadius: '0px',
                animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex', flexDirection: 'column', maxHeight: '80vh'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--stroke)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Share2 size={20} color="var(--accent-primary)" />
                            <h2 style={{ fontSize: '18px', fontWeight: 600, fontFamily: 'var(--font-display)', margin: 0 }}>Forward Message</h2>
                        </div>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Message Preview */}
                    <div style={{
                        background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '10px 12px',
                        border: '1px solid var(--stroke)', marginBottom: '12px'
                    }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            <strong style={{ color: 'var(--text-primary)' }}>{message.author}</strong>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                            {previewContent}
                        </div>
                    </div>

                    {/* Search */}
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search channels or DMs..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 12px 10px 40px', background: 'var(--bg-tertiary)',
                                border: '1px solid var(--stroke)', borderRadius: '8px', color: 'white', fontSize: '14px',
                                outline: 'none', boxSizing: 'border-box'
                            }}
                        />
                    </div>
                </div>

                {/* Selected chips */}
                {selected.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '10px 24px 0', flexShrink: 0 }}>
                        {selected.map(s => (
                            <div key={s.id} style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
                                background: 'var(--accent-primary)', borderRadius: '16px', fontSize: '12px',
                                color: '#000', fontWeight: 600
                            }}>
                                {s.type === 'channel' ? <Hash size={12} /> : <MessageSquare size={12} />}
                                {s.name}
                                <button onClick={() => toggleDestination(s)} style={{ background: 'none', border: 'none', color: '#000', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center' }}>{selected.length}/5</span>
                    </div>
                )}

                {/* Destination list */}
                <div style={{ maxHeight: '260px', overflowY: 'auto', padding: '8px 0', flex: 1 }}>
                    {isLoading ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                            Loading destinations...
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                            {query ? `No results for "${query}"` : 'No destinations available'}
                        </div>
                    ) : (
                        filtered.map(dest => (
                            <div
                                key={dest.id}
                                onClick={() => toggleDestination(dest)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 24px',
                                    cursor: selected.length >= 5 && !isSelected(dest.id) ? 'not-allowed' : 'pointer',
                                    transition: 'background 0.15s',
                                    background: isSelected(dest.id) ? 'rgba(var(--accent-primary-rgb, 99, 102, 241), 0.1)' : 'transparent',
                                    opacity: selected.length >= 5 && !isSelected(dest.id) ? 0.4 : 1,
                                }}
                                className={selected.length >= 5 && !isSelected(dest.id) ? '' : isSelected(dest.id) ? 'hover-forward-selected' : 'hover-forward-unselected'}
                            >
                                {dest.type === 'channel' ? (
                                    <div style={{
                                        width: '36px', height: '36px', borderRadius: '8px',
                                        background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'var(--text-muted)', flexShrink: 0
                                    }}>
                                        <Hash size={16} />
                                    </div>
                                ) : (
                                    <Avatar userId={dest.id} displayName={dest.name} size={36} />
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {dest.type === 'channel' ? `#${dest.name}` : dest.name}
                                    </div>
                                    {dest.guildName && (
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {dest.guildName}
                                        </div>
                                    )}
                                    {dest.type === 'dm' && (
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Direct Message</div>
                                    )}
                                </div>
                                <div style={{
                                    width: '22px', height: '22px', borderRadius: '4px', flexShrink: 0,
                                    border: isSelected(dest.id) ? '2px solid var(--accent-primary)' : '2px solid var(--stroke)',
                                    background: isSelected(dest.id) ? 'var(--accent-primary)' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.15s'
                                }}>
                                    {isSelected(dest.id) && <Check size={14} color="#000" strokeWidth={3} />}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer with note + send */}
                <div style={{ padding: '12px 24px 20px', borderTop: '1px solid var(--stroke)', flexShrink: 0 }}>
                    <input
                        type="text"
                        placeholder="Add a note (optional)"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 12px', background: 'var(--bg-tertiary)',
                            border: '1px solid var(--stroke)', borderRadius: '8px', color: 'white',
                            fontSize: '13px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box'
                        }}
                    />
                    <button
                        onClick={handleForward}
                        disabled={selected.length === 0}
                        style={{
                            width: '100%', padding: '10px 0', border: 'none', borderRadius: '8px',
                            background: selected.length > 0 ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                            color: selected.length > 0 ? '#000' : 'var(--text-muted)',
                            fontSize: '14px', fontWeight: 700, cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
                            fontFamily: 'var(--font-display)', transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        <Share2 size={16} />
                        {selected.length > 0
                            ? `Forward to ${selected.length} destination${selected.length > 1 ? 's' : ''}`
                            : 'Select a destination'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ForwardModal;
