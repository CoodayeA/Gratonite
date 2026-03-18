import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Trash2, Edit2, Save, ChevronLeft, FileText } from 'lucide-react';
import { api } from '../../lib/api';
import { RichTextRenderer } from './RichTextRenderer';

type DocItem = {
    id: string;
    channelId: string;
    title: string;
    content: string;
    lastEditorId: string | null;
    createdAt: string;
    updatedAt: string;
    editorUsername: string | null;
    editorDisplayName: string | null;
};

interface ChannelNotesPanelProps {
    channelId: string;
    onClose: () => void;
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

const ChannelNotesPanel = ({ channelId, onClose }: ChannelNotesPanelProps) => {
    const [docs, setDocs] = useState<DocItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeDoc, setActiveDoc] = useState<DocItem | null>(null);
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [creating, setCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [saving, setSaving] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSavedRef = useRef('');

    const fetchDocs = useCallback(() => {
        setLoading(true);
        api.channelDocuments.list(channelId)
            .then(data => setDocs(data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [channelId]);

    useEffect(() => {
        fetchDocs();
    }, [fetchDocs]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    // Auto-save with 2s debounce when editing
    useEffect(() => {
        if (!editing || !activeDoc) return;
        if (editContent === lastSavedRef.current && editTitle === activeDoc.title) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setSaving(true);
            try {
                const updated = await api.channelDocuments.update(channelId, activeDoc.id, {
                    title: editTitle,
                    content: editContent,
                });
                lastSavedRef.current = editContent;
                setActiveDoc(updated);
                setDocs(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d));
            } catch {}
            setSaving(false);
        }, 2000);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [editContent, editTitle, editing, activeDoc, channelId]);

    const handleCreate = async () => {
        if (!newTitle.trim()) return;
        try {
            const doc = await api.channelDocuments.create(channelId, { title: newTitle.trim() });
            setDocs(prev => [doc, ...prev]);
            setCreating(false);
            setNewTitle('');
            setActiveDoc(doc);
            setEditing(true);
            setEditTitle(doc.title);
            setEditContent(doc.content);
            lastSavedRef.current = doc.content;
        } catch {}
    };

    const handleDelete = async (docId: string) => {
        try {
            await api.channelDocuments.remove(channelId, docId);
            setDocs(prev => prev.filter(d => d.id !== docId));
            if (activeDoc?.id === docId) {
                setActiveDoc(null);
                setEditing(false);
            }
        } catch {}
    };

    const openDoc = (doc: DocItem) => {
        setActiveDoc(doc);
        setEditing(false);
        setEditTitle(doc.title);
        setEditContent(doc.content);
        lastSavedRef.current = doc.content;
    };

    const startEdit = () => {
        if (!activeDoc) return;
        setEditing(true);
        setEditTitle(activeDoc.title);
        setEditContent(activeDoc.content);
        lastSavedRef.current = activeDoc.content;
    };

    const saveNow = async () => {
        if (!activeDoc) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setSaving(true);
        try {
            const updated = await api.channelDocuments.update(channelId, activeDoc.id, {
                title: editTitle,
                content: editContent,
            });
            lastSavedRef.current = editContent;
            setActiveDoc(updated);
            setDocs(prev => prev.map(d => d.id === updated.id ? { ...d, ...updated } : d));
            setEditing(false);
        } catch {}
        setSaving(false);
    };

    // Document view / editor
    if (activeDoc) {
        return (
            <div style={{
                width: '380px', flexShrink: 0, borderLeft: '1px solid var(--stroke)',
                background: 'var(--bg-secondary, #2f3136)', display: 'flex', flexDirection: 'column',
                position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 30,
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px',
                    borderBottom: '1px solid var(--stroke)', flexShrink: 0,
                }}>
                    <ChevronLeft
                        size={18}
                        style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}
                        onClick={() => { setActiveDoc(null); setEditing(false); }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {editing ? (
                            <input
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                style={{
                                    width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                    borderRadius: '4px', padding: '4px 8px', color: 'var(--text-primary)',
                                    fontSize: '14px', fontWeight: 600,
                                }}
                            />
                        ) : (
                            <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                                {activeDoc.title}
                            </span>
                        )}
                    </div>
                    {editing ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {saving && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Saving...</span>}
                            <Save
                                size={16}
                                style={{ cursor: 'pointer', color: 'var(--accent-primary)' }}
                                onClick={saveNow}
                            />
                        </div>
                    ) : (
                        <Edit2
                            size={16}
                            style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}
                            onClick={startEdit}
                        />
                    )}
                </div>

                {/* Meta info */}
                <div style={{
                    padding: '6px 16px', fontSize: '11px', color: 'var(--text-muted)',
                    display: 'flex', gap: '8px', borderBottom: '1px solid var(--stroke)', flexShrink: 0,
                }}>
                    <span>Last edited by {activeDoc.editorDisplayName || activeDoc.editorUsername || 'Unknown'}</span>
                    <span>{timeAgo(activeDoc.updatedAt)}</span>
                </div>

                {/* Content area */}
                <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
                    {editing ? (
                        <textarea
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            placeholder="Write your notes here... Supports markdown formatting."
                            style={{
                                width: '100%', height: '100%', background: 'transparent',
                                border: 'none', outline: 'none', resize: 'none',
                                color: 'var(--text-primary)', fontSize: '13px',
                                fontFamily: 'inherit', lineHeight: '1.6',
                            }}
                        />
                    ) : (
                        <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                            {activeDoc.content ? (
                                <RichTextRenderer content={activeDoc.content} />
                            ) : (
                                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    No content yet. Click the edit button to start writing.
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Document list view
    return (
        <div style={{
            width: '340px', flexShrink: 0, borderLeft: '1px solid var(--stroke)',
            background: 'var(--bg-secondary, #2f3136)', display: 'flex', flexDirection: 'column',
            position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 30,
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', borderBottom: '1px solid var(--stroke)', flexShrink: 0,
            }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                    Channel Notes
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus
                        size={18}
                        style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}
                        onClick={() => setCreating(true)}
                    />
                    <X
                        size={18}
                        style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}
                        onClick={onClose}
                    />
                </div>
            </div>

            {/* Create form */}
            {creating && (
                <div style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--stroke)',
                    display: 'flex', gap: '8px',
                }}>
                    <input
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        placeholder="Document title..."
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewTitle(''); } }}
                        style={{
                            flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                            borderRadius: '6px', padding: '8px 12px', color: 'var(--text-primary)',
                            fontSize: '13px', outline: 'none',
                        }}
                    />
                    <button
                        onClick={handleCreate}
                        style={{
                            background: 'var(--accent-primary)', color: '#fff', border: 'none',
                            borderRadius: '6px', padding: '8px 12px', fontSize: '13px',
                            fontWeight: 600, cursor: 'pointer',
                        }}
                    >
                        Create
                    </button>
                </div>
            )}

            {/* Documents list */}
            <div style={{ flex: 1, overflow: 'auto' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        Loading...
                    </div>
                ) : docs.length === 0 ? (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', padding: '48px 24px', gap: '12px', color: 'var(--text-muted)',
                    }}>
                        <FileText size={40} style={{ opacity: 0.4 }} />
                        <span style={{ fontSize: '14px', textAlign: 'center' }}>
                            No notes yet. Create one to share information with your channel.
                        </span>
                    </div>
                ) : (
                    docs.map(doc => (
                        <div
                            key={doc.id}
                            onClick={() => openDoc(doc)}
                            style={{
                                padding: '12px 16px', cursor: 'pointer',
                                borderBottom: '1px solid var(--stroke)',
                                transition: 'background 0.15s',
                            }}
                            className="hover-bg-tertiary"
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                    <FileText size={16} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                                    <span style={{
                                        fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {doc.title}
                                    </span>
                                </div>
                                <Trash2
                                    size={14}
                                    style={{ flexShrink: 0, cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.6 }}
                                    onClick={e => { e.stopPropagation(); handleDelete(doc.id); }}
                                />
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', gap: '8px' }}>
                                <span>{doc.editorDisplayName || doc.editorUsername || 'Unknown'}</span>
                                <span>{timeAgo(doc.updatedAt)}</span>
                            </div>
                            {doc.content && (
                                <div style={{
                                    fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    maxWidth: '280px',
                                }}>
                                    {doc.content.slice(0, 80)}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ChannelNotesPanel;
