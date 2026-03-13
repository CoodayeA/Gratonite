import { useState, useEffect, useCallback } from 'react';
import { Bookmark, Trash2, ExternalLink, MessageSquare, Tag, X, Plus, Search } from 'lucide-react';
import { api, API_BASE } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';
import { useNavigate } from 'react-router-dom';

type BookmarkItem = {
    id: string;
    messageId: string;
    note: string | null;
    createdAt: string;
    messageContent: string | null;
    messageAuthorId: string | null;
    messageCreatedAt: string;
    channelId: string;
    channelName: string;
    guildId: string | null;
    guildName: string | null;
    authorUsername: string | null;
    authorDisplayName: string | null;
};

const STORAGE_KEY = 'gratonite:bookmark-tags';
const CUSTOM_TAGS_KEY = 'gratonite:custom-tags';

function loadTags(): Record<string, string[]> {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function loadCustomTags(): string[] {
    try {
        const stored = JSON.parse(localStorage.getItem(CUSTOM_TAGS_KEY) || '[]');
        return Array.isArray(stored) ? stored : [];
    } catch { return []; }
}

const DEFAULT_TAGS = ['Important', 'Read Later', 'Reference'];

export default function SavedMessages() {
    const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [customTags, setCustomTags] = useState<string[]>(loadCustomTags);
    const [bookmarkTags, setBookmarkTags] = useState<Record<string, string[]>>(loadTags);
    const [newTagInput, setNewTagInput] = useState('');
    const [showNewTagInput, setShowNewTagInput] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingTagOld, setEditingTagOld] = useState<string | null>(null);
    const [editingTagNew, setEditingTagNew] = useState('');
    const { addToast } = useToast();
    const navigate = useNavigate();

    const allTags = [...DEFAULT_TAGS, ...customTags];

    useEffect(() => {
        setLoading(true);
        fetch(`${API_BASE}/users/@me/bookmarks`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('gratonite_access_token')}` },
        })
            .then(r => r.json())
            .then(data => { setBookmarks(Array.isArray(data) ? data : []); })
            .catch(() => addToast({ title: 'Failed to load bookmarks', variant: 'error' }))
            .finally(() => setLoading(false));
    }, []);

    const removeBookmark = async (messageId: string) => {
        try {
            await fetch(`${API_BASE}/users/@me/bookmarks/${messageId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('gratonite_access_token')}` },
            });
            setBookmarks(prev => prev.filter(b => b.messageId !== messageId));
            addToast({ title: 'Bookmark removed', variant: 'info' });
        } catch {
            addToast({ title: 'Failed to remove bookmark', variant: 'error' });
        }
    };

    const jumpToMessage = (b: BookmarkItem) => {
        if (b.guildId) {
            navigate(`/guild/${b.guildId}/channel/${b.channelId}?msg=${b.messageId}`);
        } else {
            navigate(`/dm/${b.channelId}?msg=${b.messageId}`);
        }
    };

    const toggleTag = (bookmarkId: string, tag: string) => {
        setBookmarkTags(prev => {
            const current = prev[bookmarkId] || [];
            const updated = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
            const next = { ...prev, [bookmarkId]: updated };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    };

    const addCustomTag = useCallback(() => {
        const tag = newTagInput.trim();
        if (!tag || allTags.includes(tag)) return;
        const updated = [...customTags, tag];
        setCustomTags(updated);
        localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(updated));
        setNewTagInput('');
        setShowNewTagInput(false);
    }, [newTagInput, customTags, allTags]);

    const deleteCustomTag = useCallback((tag: string) => {
        const updated = customTags.filter(t => t !== tag);
        setCustomTags(updated);
        localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(updated));
        // Remove tag from all bookmarks
        setBookmarkTags(prev => {
            const next = { ...prev };
            for (const key of Object.keys(next)) {
                next[key] = next[key].filter(t => t !== tag);
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
        if (selectedTag === tag) setSelectedTag(null);
    }, [customTags, selectedTag]);

    const renameTag = useCallback((oldName: string, newName: string) => {
        if (!newName.trim() || allTags.includes(newName.trim())) return;
        const trimmed = newName.trim();
        // Update custom tags list
        setCustomTags(prev => {
            const updated = prev.map(t => t === oldName ? trimmed : t);
            localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(updated));
            return updated;
        });
        // Update bookmarks
        setBookmarkTags(prev => {
            const next = { ...prev };
            for (const key of Object.keys(next)) {
                next[key] = next[key].map(t => t === oldName ? trimmed : t);
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
        if (selectedTag === oldName) setSelectedTag(trimmed);
        setEditingTagOld(null);
    }, [allTags, selectedTag]);

    const filteredBookmarks = bookmarks.filter(b => {
        const matchesTag = selectedTag ? (bookmarkTags[b.id] || []).includes(selectedTag) : true;
        const matchesSearch = searchQuery
            ? (b.messageContent || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
              (b.authorDisplayName || b.authorUsername || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
              b.channelName.toLowerCase().includes(searchQuery.toLowerCase())
            : true;
        return matchesTag && matchesSearch;
    });

    return (
        <div style={{ padding: 'clamp(12px, 3vw, 32px)', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <Bookmark size={24} color="var(--accent-primary)" />
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Saved Messages</h1>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{bookmarks.length} saved</span>
            </div>

            {/* Search bar */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
                <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search bookmarks..."
                    style={{
                        width: '100%', padding: '8px 12px 8px 32px', background: 'var(--bg-tertiary)',
                        border: '1px solid var(--stroke)', borderRadius: '8px', color: 'var(--text-primary)',
                        fontSize: '13px', outline: 'none', boxSizing: 'border-box',
                    }}
                />
            </div>

            {/* Tag filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <Tag size={14} color="var(--text-muted)" />
                <button
                    onClick={() => setSelectedTag(null)}
                    style={{
                        padding: '4px 12px', borderRadius: '12px', border: 'none', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                        background: selectedTag === null ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                        color: selectedTag === null ? '#000' : 'var(--text-secondary)',
                    }}
                >
                    All
                </button>
                {allTags.map(tag => (
                    <div key={tag} style={{ position: 'relative', display: 'inline-flex' }}>
                        {editingTagOld === tag ? (
                            <input
                                autoFocus
                                value={editingTagNew}
                                onChange={e => setEditingTagNew(e.target.value)}
                                onBlur={() => renameTag(tag, editingTagNew)}
                                onKeyDown={e => { if (e.key === 'Enter') renameTag(tag, editingTagNew); if (e.key === 'Escape') setEditingTagOld(null); }}
                                style={{
                                    padding: '4px 8px', borderRadius: '12px', border: '1px solid var(--accent-primary)',
                                    fontSize: '12px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                                    width: '100px', outline: 'none',
                                }}
                            />
                        ) : (
                            <button
                                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                                onDoubleClick={() => { if (customTags.includes(tag)) { setEditingTagOld(tag); setEditingTagNew(tag); } }}
                                style={{
                                    padding: '4px 12px', borderRadius: '12px', border: 'none', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                                    background: selectedTag === tag ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                    color: selectedTag === tag ? '#000' : 'var(--text-secondary)',
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                }}
                            >
                                {tag}
                                {customTags.includes(tag) && (
                                    <span
                                        onClick={(e) => { e.stopPropagation(); deleteCustomTag(tag); }}
                                        style={{ cursor: 'pointer', opacity: 0.5, display: 'flex', alignItems: 'center' }}
                                        title="Delete tag"
                                    >
                                        <X size={10} />
                                    </span>
                                )}
                            </button>
                        )}
                    </div>
                ))}
                {showNewTagInput ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                            autoFocus
                            value={newTagInput}
                            onChange={e => setNewTagInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addCustomTag(); if (e.key === 'Escape') { setShowNewTagInput(false); setNewTagInput(''); } }}
                            placeholder="New tag..."
                            style={{
                                padding: '4px 8px', borderRadius: '12px', border: '1px solid var(--accent-primary)',
                                fontSize: '12px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                                width: '100px', outline: 'none',
                            }}
                        />
                        <button onClick={() => { setShowNewTagInput(false); setNewTagInput(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
                            <X size={12} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowNewTagInput(true)}
                        style={{
                            padding: '4px 8px', borderRadius: '12px', border: '1px dashed var(--stroke)',
                            fontSize: '12px', background: 'transparent', color: 'var(--text-muted)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                        }}
                    >
                        <Plus size={10} /> Add Tag
                    </button>
                )}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : filteredBookmarks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <Bookmark size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <p style={{ fontSize: '16px', fontWeight: 600 }}>{selectedTag ? `No bookmarks tagged "${selectedTag}"` : searchQuery ? 'No matching bookmarks' : 'No saved messages'}</p>
                    <p style={{ fontSize: '13px' }}>{selectedTag ? 'Try selecting a different tag or clear the filter.' : 'Right-click a message and choose "Bookmark Message" to save it here.'}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredBookmarks.map(b => (
                        <div key={b.id} style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--stroke)',
                            borderRadius: '12px',
                            padding: '16px',
                            transition: 'border-color 0.15s',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {b.authorDisplayName || b.authorUsername || 'Unknown'}
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            in #{b.channelName}{b.guildName ? ` - ${b.guildName}` : ''}
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
                                            {new Date(b.messageCreatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5', wordBreak: 'break-word' }}>
                                        {(b.messageContent || '(no text content)').slice(0, 300)}
                                    </div>
                                    {b.note && (
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--accent-primary)', fontStyle: 'italic' }}>
                                            Note: {b.note}
                                        </div>
                                    )}
                                    {/* Tag chips */}
                                    <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                                        {allTags.map(tag => {
                                            const isActive = (bookmarkTags[b.id] || []).includes(tag);
                                            return (
                                                <button
                                                    key={tag}
                                                    onClick={() => toggleTag(b.id, tag)}
                                                    style={{
                                                        padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 500, cursor: 'pointer',
                                                        border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                                        background: isActive ? 'var(--accent-primary-alpha, rgba(99,102,241,0.15))' : 'transparent',
                                                        color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                                                        transition: 'all 0.15s',
                                                    }}
                                                >
                                                    {tag}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                    <button
                                        onClick={() => jumpToMessage(b)}
                                        title="Jump to message"
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                                    >
                                        <ExternalLink size={14} />
                                    </button>
                                    <button
                                        onClick={() => removeBookmark(b.messageId)}
                                        title="Remove bookmark"
                                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'var(--error)', display: 'flex', alignItems: 'center' }}
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
