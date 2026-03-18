import { useState, useEffect, useCallback } from 'react';
import { Bookmark, Trash2, ExternalLink, FolderOpen, Folder, X, Plus, Search, Edit2, MoreHorizontal, FolderPlus } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';
import { useNavigate } from 'react-router-dom';

type BookmarkItem = {
    id: string;
    messageId: string;
    folderId: string | null;
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

type BookmarkFolder = {
    id: string;
    name: string;
    color: string;
    createdAt: string;
};

const FOLDER_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function SavedMessages() {
    const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
    const [folders, setFolders] = useState<BookmarkFolder[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null); // null = all, 'uncategorized' = no folder, or folder id
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewFolder, setShowNewFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderColor, setNewFolderColor] = useState('#6366f1');
    const [editingFolder, setEditingFolder] = useState<string | null>(null);
    const [editFolderName, setEditFolderName] = useState('');
    const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null);
    const [moveMenuOpen, setMoveMenuOpen] = useState<string | null>(null);
    const { addToast } = useToast();
    const navigate = useNavigate();

    // Fetch bookmarks and folders on mount
    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.bookmarks.list({ limit: 50 }),
            api.bookmarks.folders.list(),
        ])
            .then(([bks, flds]) => {
                setBookmarks(Array.isArray(bks) ? bks : []);
                setFolders(Array.isArray(flds) ? flds : []);
            })
            .catch(() => addToast({ title: 'Failed to load bookmarks', variant: 'error' }))
            .finally(() => setLoading(false));
    }, []);

    const removeBookmark = async (messageId: string) => {
        try {
            await api.bookmarks.remove(messageId);
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

    const createFolder = useCallback(async () => {
        if (!newFolderName.trim()) return;
        try {
            const folder = await api.bookmarks.folders.create({ name: newFolderName.trim(), color: newFolderColor });
            setFolders(prev => [...prev, folder]);
            setNewFolderName('');
            setNewFolderColor('#6366f1');
            setShowNewFolder(false);
            addToast({ title: `Folder "${folder.name}" created`, variant: 'success' });
        } catch {
            addToast({ title: 'Failed to create folder', variant: 'error' });
        }
    }, [newFolderName, newFolderColor, addToast]);

    const renameFolder = useCallback(async (folderId: string) => {
        if (!editFolderName.trim()) { setEditingFolder(null); return; }
        try {
            const updated = await api.bookmarks.folders.update(folderId, { name: editFolderName.trim() });
            setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: updated.name } : f));
            setEditingFolder(null);
        } catch {
            addToast({ title: 'Failed to rename folder', variant: 'error' });
        }
    }, [editFolderName, addToast]);

    const deleteFolder = useCallback(async (folderId: string) => {
        try {
            await api.bookmarks.folders.remove(folderId);
            setFolders(prev => prev.filter(f => f.id !== folderId));
            // Bookmarks in that folder become uncategorized
            setBookmarks(prev => prev.map(b => b.folderId === folderId ? { ...b, folderId: null } : b));
            if (selectedFolder === folderId) setSelectedFolder(null);
            addToast({ title: 'Folder deleted', variant: 'info' });
        } catch {
            addToast({ title: 'Failed to delete folder', variant: 'error' });
        }
        setFolderMenuOpen(null);
    }, [selectedFolder, addToast]);

    const moveToFolder = useCallback(async (bookmarkId: string, folderId: string | null) => {
        try {
            await api.bookmarks.update(bookmarkId, { folderId });
            setBookmarks(prev => prev.map(b => b.id === bookmarkId ? { ...b, folderId } : b));
            setMoveMenuOpen(null);
        } catch {
            addToast({ title: 'Failed to move bookmark', variant: 'error' });
        }
    }, [addToast]);

    const filteredBookmarks = bookmarks.filter(b => {
        const matchesFolder = selectedFolder === null
            ? true
            : selectedFolder === 'uncategorized'
                ? !b.folderId
                : b.folderId === selectedFolder;
        const matchesSearch = searchQuery
            ? (b.messageContent || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
              (b.authorDisplayName || b.authorUsername || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
              b.channelName.toLowerCase().includes(searchQuery.toLowerCase())
            : true;
        return matchesFolder && matchesSearch;
    });

    const folderCounts = new Map<string | null, number>();
    for (const b of bookmarks) {
        const key = b.folderId || null;
        folderCounts.set(key, (folderCounts.get(key) || 0) + 1);
    }

    return (
        <div style={{ padding: 'clamp(12px, 3vw, 32px)', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <Bookmark size={24} color="var(--accent-primary)" />
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Saved Messages</h1>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{bookmarks.length} saved</span>
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
                {/* Folder sidebar */}
                <div style={{ width: '200px', flexShrink: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                        Folders
                    </div>

                    {/* All */}
                    <button
                        onClick={() => setSelectedFolder(null)}
                        style={{
                            width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: '8px',
                            border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: selectedFolder === null ? 'var(--accent-primary)' : 'transparent',
                            color: selectedFolder === null ? 'white' : 'var(--text-secondary)',
                            marginBottom: '2px',
                        }}
                    >
                        <Bookmark size={14} /> All <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.7 }}>{bookmarks.length}</span>
                    </button>

                    {/* Uncategorized */}
                    <button
                        onClick={() => setSelectedFolder('uncategorized')}
                        style={{
                            width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: '8px',
                            border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: selectedFolder === 'uncategorized' ? 'var(--accent-primary)' : 'transparent',
                            color: selectedFolder === 'uncategorized' ? 'white' : 'var(--text-secondary)',
                            marginBottom: '2px',
                        }}
                    >
                        <FolderOpen size={14} /> Uncategorized <span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.7 }}>{folderCounts.get(null) || 0}</span>
                    </button>

                    {/* User folders */}
                    {folders.map(folder => (
                        <div key={folder.id} style={{ position: 'relative', marginBottom: '2px' }}>
                            {editingFolder === folder.id ? (
                                <input
                                    autoFocus
                                    value={editFolderName}
                                    onChange={e => setEditFolderName(e.target.value)}
                                    onBlur={() => renameFolder(folder.id)}
                                    onKeyDown={e => { if (e.key === 'Enter') renameFolder(folder.id); if (e.key === 'Escape') setEditingFolder(null); }}
                                    style={{
                                        width: '100%', padding: '8px 12px', borderRadius: '8px',
                                        border: '1px solid var(--accent-primary)', fontSize: '13px',
                                        background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                                        outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                            ) : (
                                <button
                                    onClick={() => setSelectedFolder(folder.id)}
                                    style={{
                                        width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: '8px',
                                        border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        background: selectedFolder === folder.id ? 'var(--accent-primary)' : 'transparent',
                                        color: selectedFolder === folder.id ? 'white' : 'var(--text-secondary)',
                                    }}
                                >
                                    <Folder size={14} style={{ color: selectedFolder === folder.id ? 'white' : folder.color }} />
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                                    <span style={{ fontSize: '11px', opacity: 0.7, flexShrink: 0 }}>{folderCounts.get(folder.id) || 0}</span>
                                    <span
                                        onClick={e => { e.stopPropagation(); setFolderMenuOpen(folderMenuOpen === folder.id ? null : folder.id); }}
                                        style={{ cursor: 'pointer', display: 'flex', padding: '2px', opacity: 0.5 }}
                                    >
                                        <MoreHorizontal size={12} />
                                    </span>
                                </button>
                            )}
                            {/* Folder context menu */}
                            {folderMenuOpen === folder.id && (
                                <div style={{
                                    position: 'absolute', top: '100%', right: 0, zIndex: 50,
                                    background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                                    borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                                    padding: '4px', minWidth: '120px',
                                }}>
                                    <button
                                        onClick={() => { setEditingFolder(folder.id); setEditFolderName(folder.name); setFolderMenuOpen(null); }}
                                        style={{
                                            width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: '4px',
                                            border: 'none', cursor: 'pointer', fontSize: '12px',
                                            background: 'transparent', color: 'var(--text-secondary)',
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                        }}
                                        className="hover-bg-tertiary"
                                    >
                                        <Edit2 size={12} /> Rename
                                    </button>
                                    <button
                                        onClick={() => deleteFolder(folder.id)}
                                        style={{
                                            width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: '4px',
                                            border: 'none', cursor: 'pointer', fontSize: '12px',
                                            background: 'transparent', color: 'var(--error)',
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                        }}
                                        className="hover-bg-tertiary"
                                    >
                                        <Trash2 size={12} /> Delete
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* New folder */}
                    {showNewFolder ? (
                        <div style={{ padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '8px', marginTop: '8px' }}>
                            <input
                                autoFocus
                                value={newFolderName}
                                onChange={e => setNewFolderName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName(''); } }}
                                placeholder="Folder name..."
                                style={{
                                    width: '100%', padding: '6px 8px', borderRadius: '6px',
                                    border: '1px solid var(--stroke)', fontSize: '12px',
                                    background: 'var(--bg-primary)', color: 'var(--text-primary)',
                                    outline: 'none', marginBottom: '6px', boxSizing: 'border-box',
                                }}
                            />
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                {FOLDER_COLORS.map(c => (
                                    <div
                                        key={c}
                                        onClick={() => setNewFolderColor(c)}
                                        style={{
                                            width: '18px', height: '18px', borderRadius: '50%',
                                            background: c, cursor: 'pointer',
                                            border: newFolderColor === c ? '2px solid white' : '2px solid transparent',
                                            boxShadow: newFolderColor === c ? `0 0 0 1px ${c}` : 'none',
                                        }}
                                    />
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                    onClick={createFolder}
                                    style={{
                                        flex: 1, padding: '4px', borderRadius: '4px',
                                        border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                                        background: 'var(--accent-primary)', color: 'white',
                                    }}
                                >
                                    Create
                                </button>
                                <button
                                    onClick={() => { setShowNewFolder(false); setNewFolderName(''); }}
                                    style={{
                                        padding: '4px 8px', borderRadius: '4px',
                                        border: 'none', cursor: 'pointer', fontSize: '11px',
                                        background: 'transparent', color: 'var(--text-muted)',
                                    }}
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowNewFolder(true)}
                            style={{
                                width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: '8px',
                                border: '1px dashed var(--stroke)', cursor: 'pointer', fontSize: '12px',
                                background: 'transparent', color: 'var(--text-muted)',
                                display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px',
                            }}
                        >
                            <FolderPlus size={14} /> New Folder
                        </button>
                    )}
                </div>

                {/* Bookmark list */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: '16px' }}>
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

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading...</div>
                    ) : filteredBookmarks.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                            <Bookmark size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                            <p style={{ fontSize: '16px', fontWeight: 600 }}>
                                {searchQuery ? 'No matching bookmarks' : selectedFolder ? 'No bookmarks in this folder' : 'No saved messages'}
                            </p>
                            <p style={{ fontSize: '13px' }}>
                                Right-click a message and choose "Bookmark" to save it here.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {filteredBookmarks.map(b => {
                                const folder = folders.find(f => f.id === b.folderId);
                                return (
                                    <div key={b.id} style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--stroke)',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        borderLeft: folder ? `3px solid ${folder.color}` : undefined,
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
                                                {folder && (
                                                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Folder size={10} style={{ color: folder.color }} />
                                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{folder.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0, position: 'relative' }}>
                                                {/* Move to folder */}
                                                <button
                                                    onClick={() => setMoveMenuOpen(moveMenuOpen === b.id ? null : b.id)}
                                                    title="Move to folder"
                                                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                                                >
                                                    <FolderOpen size={14} />
                                                </button>
                                                {moveMenuOpen === b.id && (
                                                    <div style={{
                                                        position: 'absolute', top: '100%', right: 0, zIndex: 50, marginTop: '4px',
                                                        background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                                                        borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                                                        padding: '4px', minWidth: '140px',
                                                    }}>
                                                        <button
                                                            onClick={() => moveToFolder(b.id, null)}
                                                            style={{
                                                                width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: '4px',
                                                                border: 'none', cursor: 'pointer', fontSize: '12px',
                                                                background: !b.folderId ? 'var(--bg-tertiary)' : 'transparent',
                                                                color: 'var(--text-secondary)',
                                                                display: 'flex', alignItems: 'center', gap: '6px',
                                                            }}
                                                            className="hover-bg-tertiary"
                                                        >
                                                            <FolderOpen size={12} /> Uncategorized
                                                        </button>
                                                        {folders.map(f => (
                                                            <button
                                                                key={f.id}
                                                                onClick={() => moveToFolder(b.id, f.id)}
                                                                style={{
                                                                    width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: '4px',
                                                                    border: 'none', cursor: 'pointer', fontSize: '12px',
                                                                    background: b.folderId === f.id ? 'var(--bg-tertiary)' : 'transparent',
                                                                    color: 'var(--text-secondary)',
                                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                                }}
                                                                className="hover-bg-tertiary"
                                                            >
                                                                <Folder size={12} style={{ color: f.color }} /> {f.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
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
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
