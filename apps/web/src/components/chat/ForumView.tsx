/**
 * ForumView.tsx — Visual grid/card view for GUILD_FORUM channels.
 * Posts display as cards with colorful gradient thumbnails, tags, reply counts.
 * Supports grid (default) and list view modes.
 */
import { useState, useEffect, useCallback, useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import {
    MessageSquare, CheckCircle, Clock, Plus, ChevronDown, Search,
    Loader2, X, LayoutGrid, List, Lock, Tag, ArrowLeft, Send,
    Paperclip, File as FileIcon,
} from 'lucide-react';
import { api, API_BASE, getAccessToken } from '../../lib/api';
import Avatar from '../ui/Avatar';

type ForumTag = { id: string; name: string; color?: string };
type ForumThread = {
    id: string;
    name: string;
    messageCount?: number;
    createdAt: string;
    lastMessageAt?: string;
    authorId?: string;
    authorName?: string;
    authorAvatarHash?: string | null;
    tags?: string[];
    solved?: boolean;
    locked?: boolean;
    opAttachment?: AttachmentSnapshot | null;
};

type AttachmentSnapshot = {
    id: string;
    url: string;
    filename: string;
    size: number;
    mimeType: string;
};

type PendingAttachment = {
    name: string;
    sizeLabel: string;
    file: File;
    previewUrl?: string;
};

type SortMode = 'latest' | 'oldest' | 'most-replies';
type ViewMode = 'grid' | 'list';

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

/** Derive a visually distinct gradient from a string */
function threadGradient(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    const h1 = Math.abs(hash) % 360;
    const h2 = (h1 + 40 + (Math.abs(hash >> 8) % 60)) % 360;
    return `linear-gradient(135deg, hsl(${h1},60%,28%) 0%, hsl(${h2},55%,18%) 100%)`;
}

/** One or two initials from a thread name */
function threadInitials(name: string): string {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

function formatFileSize(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1048576).toFixed(1)} MB`;
}

function filesToPending(files: File[]): PendingAttachment[] {
    return files.map(file => ({
        name: file.name,
        sizeLabel: formatFileSize(file.size),
        file,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
}

function revokePendingAttachments(files: PendingAttachment[]) {
    files.forEach(file => {
        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
    });
}

function uploadWithProgress(file: File, onProgress: (pct: number) => void) {
    return new Promise<AttachmentSnapshot>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'attachment');
        xhr.upload.onprogress = event => {
            if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                try {
                    const body = JSON.parse(xhr.responseText);
                    reject(new Error(body?.message || xhr.statusText || 'Upload failed'));
                } catch {
                    reject(new Error(xhr.statusText || 'Upload failed'));
                }
            }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.open('POST', `${API_BASE}/files/upload`);
        const token = getAccessToken();
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);
    });
}

async function uploadPendingAttachments(
    files: PendingAttachment[],
    setProgress: Dispatch<SetStateAction<Record<string, number>>>,
) {
    const uploaded: AttachmentSnapshot[] = [];
    for (const pending of files) {
        setProgress(prev => ({ ...prev, [pending.name]: 0 }));
        try {
            const result = await uploadWithProgress(pending.file, pct => {
                setProgress(prev => ({ ...prev, [pending.name]: pct }));
            });
            uploaded.push(result);
            setProgress(prev => ({ ...prev, [pending.name]: 100 }));
        } catch (err) {
            setProgress(prev => ({ ...prev, [pending.name]: -1 }));
            throw err;
        }
    }
    return uploaded;
}

function PendingAttachmentList({
    files,
    progress,
    onRemove,
}: {
    files: PendingAttachment[];
    progress: Record<string, number>;
    onRemove: (index: number) => void;
}) {
    if (files.length === 0) return null;
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {files.map((file, index) => {
                const pct = progress[file.name];
                const isUploading = pct !== undefined && pct >= 0 && pct < 100;
                const isFailed = pct === -1;
                return (
                    <div key={`${file.name}-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: 'var(--bg-tertiary)', border: `1px solid ${isFailed ? 'var(--error)' : 'var(--stroke)'}`, borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {file.previewUrl ? <img src={file.previewUrl} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'cover' }} loading="lazy" /> : <FileIcon size={13} />}
                            <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{file.sizeLabel}</span>
                            {isUploading && <span style={{ color: 'var(--accent-primary)', fontSize: '10px' }}>{pct}%</span>}
                            {isFailed && <span style={{ color: 'var(--error)', fontSize: '10px' }}>failed</span>}
                            <button
                                onClick={() => onRemove(index)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}
                                aria-label={`Remove ${file.name}`}
                            >
                                <X size={12} />
                            </button>
                        </div>
                        {isUploading && (
                            <div style={{ height: '2px', background: 'var(--stroke)', borderRadius: '1px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-primary)', transition: 'width 0.2s ease' }} />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function ExistingAttachmentList({
    attachments,
    onRemove,
}: {
    attachments: AttachmentSnapshot[];
    onRemove: (attachmentId: string) => void;
}) {
    if (attachments.length === 0) return null;
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {attachments.map((attachment) => (
                <div key={attachment.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {attachment.mimeType?.startsWith('image/')
                        ? <img src={attachment.url} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'cover' }} loading="lazy" />
                        : <FileIcon size={13} />}
                    <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.filename}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{formatFileSize(attachment.size)}</span>
                    <button
                        onClick={() => onRemove(attachment.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}
                        aria-label={`Remove ${attachment.filename}`}
                    >
                        <X size={12} />
                    </button>
                </div>
            ))}
        </div>
    );
}

function AttachmentRenderer({ attachments }: { attachments?: AttachmentSnapshot[] }) {
    if (!attachments || attachments.length === 0) return null;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            {attachments.map(att => {
                const isImage = att.mimeType?.startsWith('image/');
                const isVideo = att.mimeType?.startsWith('video/');
                const isAudio = att.mimeType?.startsWith('audio/');
                if (isImage) {
                    return (
                        <div key={att.id} style={{ maxWidth: '520px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)' }}>
                            <img src={att.url} alt={att.filename} loading="lazy" decoding="async" style={{ width: '100%', display: 'block', maxHeight: '420px', objectFit: 'contain' }} />
                        </div>
                    );
                }
                if (isVideo) {
                    return <video key={att.id} controls preload="metadata" src={att.url} style={{ maxWidth: '520px', borderRadius: '8px', display: 'block' }} />;
                }
                if (isAudio) {
                    return <audio key={att.id} controls src={att.url} style={{ width: '100%', maxWidth: '520px' }} />;
                }
                return (
                    <a key={att.id} href={att.url} download={att.filename} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'var(--text-primary)', textDecoration: 'none', maxWidth: '360px' }}>
                        <FileIcon size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 600 }}>{att.filename}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', flexShrink: 0 }}>{formatFileSize(att.size)}</span>
                    </a>
                );
            })}
        </div>
    );
}

export default function ForumView({
    channelId,
    channelName,
    forumTags = [],
    channelIsEncrypted = false,
    attachmentsEnabled = true,
}: {
    channelId: string;
    channelName: string;
    forumTags: ForumTag[];
    channelIsEncrypted?: boolean;
    attachmentsEnabled?: boolean;
    onOpenThread: (threadId: string) => void;
}) {
    const [threads, setThreads] = useState<ForumThread[]>([]);
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState<SortMode>('latest');
    const [sortOpen, setSortOpen] = useState(false);
    const [filterTag, setFilterTag] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [showCreate, setShowCreate] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newTags, setNewTags] = useState<string[]>([]);
    const [newAttachments, setNewAttachments] = useState<PendingAttachment[]>([]);
    const [newUploadProgress, setNewUploadProgress] = useState<Record<string, number>>({});
    const [createError, setCreateError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [activePost, setActivePost] = useState<ForumThread | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const newFileInputRef = useRef<HTMLInputElement>(null);
    const attachmentBlockReason = channelIsEncrypted
        ? 'Forum attachments are not available in encrypted channels yet. Use text only here, or post attachments in a non-encrypted forum.'
        : !attachmentsEnabled
            ? 'Attachments are disabled in this channel.'
            : null;

    const fetchThreads = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.threads.list(channelId);
            const mapped: ForumThread[] = (Array.isArray(data) ? data : []).map((t: any) => ({
                id: t.id,
                name: t.name || t.title || 'Untitled',
                messageCount: t.messageCount ?? t.replyCount ?? 0,
                createdAt: t.createdAt,
                lastMessageAt: t.lastActivity || t.lastMessageAt || t.updatedAt || t.createdAt,
                authorId: t.authorId || t.creatorId,
                authorName: t.authorName || t.creatorName || t.author?.displayName || t.author?.username || 'Unknown',
                authorAvatarHash: (t.authorAvatarHash || t.creatorAvatarHash || t.author?.avatarHash) ?? null,
                tags: t.tags || t.forumTagIds || [],
                solved: t.solved || t.archived || false,
                locked: t.locked || false,
                opAttachment: t.opAttachment ?? null,
            }));
            setThreads(mapped);
        } catch {
            setThreads([]);
        }
        setLoading(false);
    }, [channelId]);

    useEffect(() => { fetchThreads(); }, [fetchThreads]);
    useEffect(() => {
        api.users.getMe().then((me: any) => setCurrentUserId(me.id)).catch(() => setCurrentUserId(null));
    }, []);

    const filtered = useMemo(() => {
        return threads
            .filter(t => !filterTag || (t.tags || []).includes(filterTag))
            .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => {
                if (sort === 'latest') return new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime();
                if (sort === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                return (b.messageCount || 0) - (a.messageCount || 0);
            });
    }, [threads, filterTag, search, sort]);

    const handleCreate = async () => {
        if (!newTitle.trim()) return;
        if (attachmentBlockReason && newAttachments.length > 0) {
            setCreateError(attachmentBlockReason);
            return;
        }
        setCreating(true);
        setCreateError(null);
        try {
            const uploaded = await uploadPendingAttachments(newAttachments, setNewUploadProgress);
            const thread = await api.threads.create(channelId, {
                name: newTitle.trim(),
                body: newContent.trim() || null,
                attachmentIds: uploaded.map(file => file.id),
                tags: newTags,
            } as any);
            setShowCreate(false);
            const title = newTitle.trim();
            const tags = [...newTags];
            const opAttachment = uploaded.find(file => file.mimeType.startsWith('image/')) ?? uploaded[0] ?? null;
            setNewTitle('');
            setNewContent('');
            setNewTags([]);
            revokePendingAttachments(newAttachments);
            setNewAttachments([]);
            setNewUploadProgress({});
            fetchThreads();
            if (thread?.id) {
                const newPost: ForumThread = { id: thread.id, name: title, createdAt: thread.createdAt ?? new Date().toISOString(), messageCount: uploaded.length > 0 || newContent.trim() ? 1 : 0, tags, opAttachment };
                setActivePost(newPost);
            }
        } catch (err: any) {
            setCreateError(err?.message || 'Could not create post');
        }
        setCreating(false);
    };

    const sortLabels: Record<SortMode, string> = {
        latest: 'Latest Activity',
        oldest: 'Oldest First',
        'most-replies': 'Most Replies',
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
            {/* ── Top bar — hidden when a post is open ── */}
            {!activePost && <div style={{
                padding: '12px 20px', borderBottom: '1px solid var(--stroke)',
                display: 'flex', flexDirection: 'column', gap: '10px',
                background: 'var(--bg-primary)',
            }}>
                {/* Row 1: title + actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <LayoutGrid size={20} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                        <h2 style={{ fontSize: '17px', fontWeight: 700, fontFamily: 'var(--font-display)', margin: 0 }}>
                            #{channelName}
                        </h2>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '20px', background: 'var(--bg-tertiary)', fontWeight: 600 }}>
                            {threads.length} post{threads.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* View mode toggle */}
                        <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--stroke)' }}>
                            <button
                                onClick={() => setViewMode('grid')}
                                title="Grid view"
                                style={{
                                    padding: '7px 10px', border: 'none', cursor: 'pointer',
                                    background: viewMode === 'grid' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                    color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
                                    display: 'flex', alignItems: 'center',
                                }}
                            ><LayoutGrid size={15} /></button>
                            <button
                                onClick={() => setViewMode('list')}
                                title="List view"
                                style={{
                                    padding: '7px 10px', border: 'none', cursor: 'pointer',
                                    background: viewMode === 'list' ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                    color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
                                    display: 'flex', alignItems: 'center',
                                }}
                            ><List size={15} /></button>
                        </div>
                        {/* New Post button */}
                        <button
                            onClick={() => setShowCreate(s => !s)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '8px 16px', borderRadius: '8px', border: 'none',
                                background: 'var(--accent-primary)', color: '#fff',
                                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                            }}
                        >
                            <Plus size={15} /> New Post
                        </button>
                    </div>
                </div>

                {/* Row 2: search + sort + tags */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Search */}
                    <div style={{ position: 'relative', flex: '1 1 180px', minWidth: '120px' }}>
                        <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search posts…"
                            style={{
                                width: '100%', padding: '7px 10px 7px 30px', borderRadius: '8px',
                                border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)',
                                color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit',
                                boxSizing: 'border-box', outline: 'none',
                            }}
                        />
                    </div>
                    {/* Sort dropdown */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setSortOpen(o => !o)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px',
                                borderRadius: '8px', border: '1px solid var(--stroke)',
                                background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                                fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {sortLabels[sort]}
                            <ChevronDown size={13} style={{ transform: sortOpen ? 'rotate(180deg)' : 'none', transition: '0.15s' }} />
                        </button>
                        {sortOpen && (
                            <div style={{
                                position: 'absolute', top: '38px', left: 0, zIndex: 100,
                                background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                                borderRadius: '10px', padding: '4px', minWidth: '160px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                            }}>
                                {(['latest', 'oldest', 'most-replies'] as SortMode[]).map(s => (
                                    <button
                                        key={s}
                                        onClick={() => { setSort(s); setSortOpen(false); }}
                                        style={{
                                            display: 'block', width: '100%', textAlign: 'left',
                                            padding: '8px 12px', border: 'none', borderRadius: '7px',
                                            background: sort === s ? 'var(--bg-tertiary)' : 'transparent',
                                            color: sort === s ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            fontSize: '13px', fontWeight: sort === s ? 600 : 400,
                                            cursor: 'pointer', fontFamily: 'inherit',
                                        }}
                                    >{sortLabels[s]}</button>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Tag filter chips */}
                    {forumTags.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <Tag size={12} style={{ color: 'var(--text-muted)' }} />
                            <button
                                onClick={() => setFilterTag(null)}
                                style={{
                                    padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                                    border: `1px solid ${!filterTag ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                    background: !filterTag ? 'rgba(82,109,245,0.1)' : 'var(--bg-tertiary)',
                                    color: !filterTag ? 'var(--accent-primary)' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                }}
                            >All</button>
                            {forumTags.map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={() => setFilterTag(filterTag === tag.id ? null : tag.id)}
                                    style={{
                                        padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                                        border: `1px solid ${filterTag === tag.id ? (tag.color || 'var(--accent-primary)') : 'var(--stroke)'}`,
                                        background: filterTag === tag.id ? `${tag.color || 'var(--accent-primary)'}18` : 'var(--bg-tertiary)',
                                        color: filterTag === tag.id ? (tag.color || 'var(--accent-primary)') : 'var(--text-muted)',
                                        cursor: 'pointer',
                                    }}
                                >{tag.name}</button>
                            ))}
                        </div>
                    )}
                </div>
            </div>}

            {/* ── New Post form ── */}
            {!activePost && showCreate && (
                <div style={{
                    margin: '12px 20px', borderRadius: '12px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--accent-primary)',
                    padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Create a new post</span>
                        <button
                            onClick={() => { setShowCreate(false); setNewTitle(''); setNewContent(''); setNewTags([]); revokePendingAttachments(newAttachments); setNewAttachments([]); setNewUploadProgress({}); setCreateError(null); }}
                            style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        ><X size={14} /></button>
                    </div>
                    <input
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        placeholder="Post title…"
                        autoFocus
                        style={{
                            width: '100%', padding: '10px 12px', borderRadius: '8px',
                            border: '1px solid var(--stroke)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', fontSize: '15px', fontFamily: 'inherit',
                            marginBottom: '10px', boxSizing: 'border-box', outline: 'none',
                        }}
                    />
                    <textarea
                        value={newContent}
                        onChange={e => setNewContent(e.target.value)}
                        placeholder="Describe your post… (optional)"
                        rows={4}
                        onPaste={e => {
                            const items = e.clipboardData?.items;
                            if (!items) return;
                            const pasted: File[] = [];
                            for (const item of Array.from(items)) {
                                if (item.type.startsWith('image/')) {
                                    const file = item.getAsFile();
                                    if (file) pasted.push(new File([file], file.name || `pasted-image.${item.type.split('/')[1] || 'png'}`, { type: file.type }));
                                }
                            }
                            if (pasted.length > 0) {
                                e.preventDefault();
                                if (attachmentBlockReason) {
                                    setCreateError(attachmentBlockReason);
                                    return;
                                }
                                setNewAttachments(prev => [...prev, ...filesToPending(pasted)]);
                            }
                        }}
                        style={{
                            width: '100%', padding: '10px 12px', borderRadius: '8px',
                            border: '1px solid var(--stroke)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit',
                            resize: 'vertical', marginBottom: '12px', boxSizing: 'border-box', outline: 'none',
                        }}
                    />
                    {forumTags.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            {forumTags.map(tag => (
                                <button
                                    key={tag.id}
                                    onClick={() => setNewTags(prev => prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id])}
                                    style={{
                                        padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                                        border: `1px solid ${newTags.includes(tag.id) ? (tag.color || 'var(--accent-primary)') : 'var(--stroke)'}`,
                                        background: newTags.includes(tag.id) ? `${tag.color || 'var(--accent-primary)'}18` : 'var(--bg-tertiary)',
                                        color: newTags.includes(tag.id) ? (tag.color || 'var(--accent-primary)') : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                    }}
                                >{tag.name}</button>
                            ))}
                        </div>
                    )}
                    <input
                        data-testid="forum-create-file-input"
                        ref={newFileInputRef}
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        onChange={e => {
                            const selected = Array.from(e.target.files || []);
                            if (selected.length > 0 && attachmentBlockReason) {
                                setCreateError(attachmentBlockReason);
                                e.target.value = '';
                                return;
                            }
                            if (selected.length > 0) setNewAttachments(prev => [...prev, ...filesToPending(selected)]);
                            e.target.value = '';
                        }}
                    />
                    <PendingAttachmentList
                        files={newAttachments}
                        progress={newUploadProgress}
                        onRemove={index => {
                            setNewAttachments(prev => {
                                const next = [...prev];
                                const removed = next.splice(index, 1)[0];
                                if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
                                return next;
                            });
                        }}
                    />
                    {createError && (
                        <div style={{ marginBottom: '12px', color: 'var(--error)', fontSize: '12px', fontWeight: 600 }}>{createError}</div>
                    )}
                    {attachmentBlockReason && (
                        <div style={{ marginBottom: '12px', color: 'var(--text-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Lock size={13} /> {attachmentBlockReason}
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                            onClick={() => newFileInputRef.current?.click()}
                            disabled={!!attachmentBlockReason}
                            title={attachmentBlockReason || 'Attach files'}
                            style={{ marginRight: 'auto', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: attachmentBlockReason ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: attachmentBlockReason ? 0.55 : 1 }}
                        >
                            <Paperclip size={14} /> Attach
                        </button>
                        <button
                            onClick={() => { setShowCreate(false); setNewTitle(''); setNewContent(''); setNewTags([]); revokePendingAttachments(newAttachments); setNewAttachments([]); setNewUploadProgress({}); setCreateError(null); }}
                            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                        >Cancel</button>
                        <button
                            onClick={handleCreate}
                            disabled={creating || !newTitle.trim()}
                            style={{
                                padding: '8px 20px', borderRadius: '8px', border: 'none',
                                background: newTitle.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                color: newTitle.trim() ? '#fff' : 'var(--text-muted)',
                                fontSize: '13px', fontWeight: 700, cursor: newTitle.trim() && !creating ? 'pointer' : 'not-allowed',
                                opacity: creating ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px',
                            }}
                        >
                            {creating ? <><Loader2 size={14} className="spin" /> Creating…</> : 'Post'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Content area ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: activePost ? 0 : '16px 20px' }} onClick={() => setSortOpen(false)}>
                {activePost ? (
                    <ForumPostView
                        thread={activePost}
                        forumTags={forumTags}
                        channelId={channelId}
                        channelName={channelName}
                        attachmentBlockReason={attachmentBlockReason}
                        currentUserId={currentUserId}
                        onBack={() => { setActivePost(null); fetchThreads(); }}
                        onResolve={(threadId) => setThreads(prev => prev.map(t => t.id === threadId ? { ...t, solved: true } : t))}
                    />
                ) : loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px', color: 'var(--text-muted)', gap: '12px' }}>
                        <Loader2 size={28} className="spin" style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ fontSize: '14px' }}>Loading posts…</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px', color: 'var(--text-muted)', gap: '12px' }}>
                        <LayoutGrid size={48} style={{ opacity: 0.2 }} />
                        <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            {threads.length === 0 ? 'No posts yet' : 'No posts match your filters'}
                        </span>
                        <span style={{ fontSize: '13px', textAlign: 'center', maxWidth: '280px' }}>
                            {threads.length === 0 ? 'Be the first to create a post in this forum!' : 'Try adjusting your search or clearing filters.'}
                        </span>
                        {threads.length === 0 && (
                            <button
                                onClick={() => setShowCreate(true)}
                                style={{ marginTop: '4px', padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent-primary)', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            ><Plus size={16} /> Create First Post</button>
                        )}
                    </div>
                ) : viewMode === 'grid' ? (
                    <GridView threads={filtered} forumTags={forumTags} onSelectPost={setActivePost} />
                ) : (
                    <ListView threads={filtered} forumTags={forumTags} onSelectPost={setActivePost} />
                )}
            </div>
        </div>
    );
}

// ── Grid view ────────────────────────────────────────────────────────────────

function GridView({ threads, forumTags, onSelectPost }: {
    threads: ForumThread[];
    forumTags: ForumTag[];
    onSelectPost: (t: ForumThread) => void;
}) {
    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '14px',
        }}>
            {threads.map(thread => (
                <GridCard key={thread.id} thread={thread} forumTags={forumTags} onSelectPost={onSelectPost} />
            ))}
        </div>
    );
}

function GridCard({ thread, forumTags, onSelectPost }: {
    thread: ForumThread;
    forumTags: ForumTag[];
    onSelectPost: (t: ForumThread) => void;
}) {
    const [hovered, setHovered] = useState(false);
    const gradient = threadGradient(thread.id + thread.name);
    const initials = threadInitials(thread.name);
    const thumbnail = thread.opAttachment?.mimeType?.startsWith('image/') ? thread.opAttachment : null;

    return (
        <div
            onClick={() => onSelectPost(thread)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                borderRadius: '12px', overflow: 'hidden',
                background: 'var(--bg-elevated)',
                border: `1px solid ${hovered ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
                transform: hovered ? 'translateY(-2px)' : 'none',
                boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.15)',
            }}
        >
            {/* Thumbnail */}
            <div style={{
                height: '120px', background: thumbnail ? `url(${thumbnail.url}) center/cover` : gradient,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', overflow: 'hidden',
            }}>
                {!thumbnail && <span style={{ fontSize: '36px', fontWeight: 800, color: 'rgba(255,255,255,0.25)', letterSpacing: '-1px', userSelect: 'none' }}>
                    {initials}
                </span>}
                {thumbnail && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.35))' }} />}
                {thread.locked && (
                    <div style={{ position: 'absolute', top: '8px', right: '8px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: '#fff' }}>
                        <Lock size={10} /> Locked
                    </div>
                )}
                {thread.solved && (
                    <div style={{ position: 'absolute', top: '8px', left: '8px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(16,185,129,0.8)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: '#fff' }}>
                        <CheckCircle size={10} /> Solved
                    </div>
                )}
            </div>

            {/* Card body */}
            <div style={{ padding: '12px' }}>
                {/* Tags */}
                {(thread.tags || []).length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        {thread.tags!.slice(0, 3).map(tagId => {
                            const tag = forumTags.find(t => t.id === tagId);
                            return tag ? (
                                <span key={tagId} style={{ padding: '1px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: `${tag.color || '#5865f2'}22`, color: tag.color || 'var(--accent-primary)', border: `1px solid ${tag.color || 'var(--accent-primary)'}40` }}>
                                    {tag.name}
                                </span>
                            ) : null;
                        })}
                    </div>
                )}

                {/* Title */}
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {thread.name}
                </div>

                {/* Meta row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {thread.authorId ? (
                            <Avatar userId={thread.authorId} displayName={thread.authorName || ''} avatarHash={thread.authorAvatarHash} size={20} />
                        ) : (
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-tertiary)', flexShrink: 0 }} />
                        )}
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80px' }}>
                            {thread.authorName || 'Unknown'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <MessageSquare size={11} /> {thread.messageCount || 0}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Clock size={11} /> {timeAgo(thread.lastMessageAt || thread.createdAt)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── List view ─────────────────────────────────────────────────────────────────

function ListView({ threads, forumTags, onSelectPost }: {
    threads: ForumThread[];
    forumTags: ForumTag[];
    onSelectPost: (t: ForumThread) => void;
}) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {threads.map(thread => (
                <ListRow key={thread.id} thread={thread} forumTags={forumTags} onSelectPost={onSelectPost} />
            ))}
        </div>
    );
}

function ListRow({ thread, forumTags, onSelectPost }: {
    thread: ForumThread;
    forumTags: ForumTag[];
    onSelectPost: (t: ForumThread) => void;
}) {
    const [hovered, setHovered] = useState(false);
    const gradient = threadGradient(thread.id + thread.name);
    const thumbnail = thread.opAttachment?.mimeType?.startsWith('image/') ? thread.opAttachment : null;

    return (
        <div
            onClick={() => onSelectPost(thread)}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '12px 16px', borderRadius: '10px',
                background: hovered ? 'var(--bg-tertiary)' : 'var(--bg-elevated)',
                border: `1px solid ${hovered ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                cursor: 'pointer', transition: 'all 0.15s',
            }}
        >
            {/* Mini thumbnail */}
            <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: thumbnail ? `url(${thumbnail.url}) center/cover` : gradient, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {!thumbnail && <span style={{ fontSize: '16px', fontWeight: 800, color: 'rgba(255,255,255,0.3)', userSelect: 'none' }}>
                    {threadInitials(thread.name)}
                </span>}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.name}</span>
                    {thread.solved && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '10px', fontWeight: 700, color: '#10b981', flexShrink: 0 }}><CheckCircle size={10} /> Solved</span>}
                    {thread.locked && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, color: 'var(--error)', flexShrink: 0 }}><Lock size={10} /> Locked</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {thread.authorId && <Avatar userId={thread.authorId} displayName={thread.authorName || ''} avatarHash={thread.authorAvatarHash} size={16} />}
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{thread.authorName}</span>
                    {(thread.tags || []).slice(0, 2).map(tagId => {
                        const tag = forumTags.find(t => t.id === tagId);
                        return tag ? <span key={tagId} style={{ padding: '1px 6px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: `${tag.color || '#5865f2'}20`, color: tag.color || 'var(--accent-primary)' }}>{tag.name}</span> : null;
                    })}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MessageSquare size={13} /> {thread.messageCount || 0}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={13} /> {timeAgo(thread.lastMessageAt || thread.createdAt)}</span>
            </div>
        </div>
    );
}

// ── Forum Post View ──────────────────────────────────────────────────────────

type PostMessage = {
    id: string;
    content: string | null;
    attachments?: AttachmentSnapshot[];
    authorId?: string;
    authorName?: string;
    authorAvatarHash?: string | null;
    createdAt: string;
    edited?: boolean;
};

function ForumPostView({ thread, forumTags, channelId, channelName, attachmentBlockReason, currentUserId, onBack, onResolve }: {
    thread: ForumThread;
    forumTags: ForumTag[];
    channelId: string;
    channelName: string;
    attachmentBlockReason: string | null;
    currentUserId: string | null;
    onBack: () => void;
    onResolve?: (threadId: string) => void;
}) {
    const [messages, setMessages] = useState<PostMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [resolved, setResolved] = useState(thread.solved ?? false);
    const [threadTitle, setThreadTitle] = useState(thread.name);
    const [threadTags, setThreadTags] = useState<string[]>(thread.tags || []);
    const draftKey = `forum-draft-${thread.id}`;
    const [reply, setReply] = useState(() => {
        try { return localStorage.getItem(draftKey) ?? ''; } catch { return ''; }
    });
    const [sending, setSending] = useState(false);
    const [replyAttachments, setReplyAttachments] = useState<PendingAttachment[]>([]);
    const [replyUploadProgress, setReplyUploadProgress] = useState<Record<string, number>>({});
    const [replyError, setReplyError] = useState<string | null>(null);
    const [editingPost, setEditingPost] = useState(false);
    const [editTitle, setEditTitle] = useState(thread.name);
    const [editTags, setEditTags] = useState<string[]>(thread.tags || []);
    const [editContent, setEditContent] = useState('');
    const [editExistingAttachments, setEditExistingAttachments] = useState<AttachmentSnapshot[]>([]);
    const [editPendingAttachments, setEditPendingAttachments] = useState<PendingAttachment[]>([]);
    const [editUploadProgress, setEditUploadProgress] = useState<Record<string, number>>({});
    const [editError, setEditError] = useState<string | null>(null);
    const [savingPost, setSavingPost] = useState(false);
    const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
    const [editReplyContent, setEditReplyContent] = useState('');
    const [editReplyExistingAttachments, setEditReplyExistingAttachments] = useState<AttachmentSnapshot[]>([]);
    const [editReplyPendingAttachments, setEditReplyPendingAttachments] = useState<PendingAttachment[]>([]);
    const [editReplyUploadProgress, setEditReplyUploadProgress] = useState<Record<string, number>>({});
    const [editReplyError, setEditReplyError] = useState<string | null>(null);
    const [savingReply, setSavingReply] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const replyFileInputRef = useRef<HTMLInputElement>(null);
    const editPostFileInputRef = useRef<HTMLInputElement>(null);
    const editReplyFileInputRef = useRef<HTMLInputElement>(null);

    const fetchMessages = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.threads.listMessages(thread.id);
            const mapped: PostMessage[] = (Array.isArray(data) ? [...data].reverse() : []).map((m: any) => ({
                id: m.id ?? m.apiId ?? String(Math.random()),
                content: m.content ?? null,
                attachments: Array.isArray(m.attachments) ? m.attachments : [],
                authorId: m.authorId ?? m.author?.id,
                authorName: m.authorName ?? m.author?.displayName ?? m.author?.username ?? 'Unknown',
                authorAvatarHash: m.authorAvatarHash ?? m.author?.avatarHash ?? null,
                createdAt: m.createdAt ?? new Date().toISOString(),
                edited: Boolean(m.edited || m.editedAt),
            }));
            setMessages(mapped);
        } catch {
            setMessages([]);
        }
        setLoading(false);
    }, [thread.id]);

    useEffect(() => { fetchMessages(); }, [fetchMessages]);
    useEffect(() => {
        setThreadTitle(thread.name);
        setThreadTags(thread.tags || []);
    }, [thread.id, thread.name, thread.tags]);

    const clearPostEditor = useCallback(() => {
        revokePendingAttachments(editPendingAttachments);
        setEditingPost(false);
        setEditTitle(threadTitle);
        setEditTags(threadTags);
        setEditContent(messages[0]?.content ?? '');
        setEditExistingAttachments(messages[0]?.attachments ?? []);
        setEditPendingAttachments([]);
        setEditUploadProgress({});
        setEditError(null);
    }, [editPendingAttachments, messages, threadTags, threadTitle]);

    const startPostEditor = useCallback(() => {
        setEditingPost(true);
        setEditTitle(threadTitle);
        setEditTags(threadTags);
        setEditContent(messages[0]?.content ?? '');
        setEditExistingAttachments(messages[0]?.attachments ?? []);
        setEditPendingAttachments([]);
        setEditUploadProgress({});
        setEditError(null);
    }, [messages, threadTags, threadTitle]);

    const clearReplyEditor = useCallback(() => {
        revokePendingAttachments(editReplyPendingAttachments);
        setEditingReplyId(null);
        setEditReplyContent('');
        setEditReplyExistingAttachments([]);
        setEditReplyPendingAttachments([]);
        setEditReplyUploadProgress({});
        setEditReplyError(null);
    }, [editReplyPendingAttachments]);

    const startReplyEditor = useCallback((message: PostMessage) => {
        clearReplyEditor();
        setEditingReplyId(message.id);
        setEditReplyContent(message.content ?? '');
        setEditReplyExistingAttachments(message.attachments ?? []);
    }, [clearReplyEditor]);

    const handleSavePost = useCallback(async () => {
        if (!editTitle.trim() || savingPost) return;
        if (attachmentBlockReason && editPendingAttachments.length > 0) {
            setEditError(attachmentBlockReason);
            return;
        }
        setSavingPost(true);
        setEditError(null);
        try {
            const uploaded = await uploadPendingAttachments(editPendingAttachments, setEditUploadProgress);
            const attachmentIds = [
                ...editExistingAttachments.map((attachment) => attachment.id),
                ...uploaded.map((attachment) => attachment.id),
            ];
            const body = editContent.trim() || null;
            if (!body && attachmentIds.length === 0) {
                setEditError('Posts must keep text or at least one attachment.');
                setSavingPost(false);
                return;
            }
            await api.threads.update(thread.id, {
                name: editTitle.trim(),
                body,
                tags: editTags,
                attachmentIds,
            });
            setThreadTitle(editTitle.trim());
            setThreadTags(editTags);
            clearPostEditor();
            await fetchMessages();
        } catch (err: any) {
            setEditError(err?.message || 'Could not save post');
        }
        setSavingPost(false);
    }, [attachmentBlockReason, clearPostEditor, editContent, editExistingAttachments, editPendingAttachments, editTags, editTitle, fetchMessages, savingPost, thread.id]);

    const handleSaveReply = useCallback(async () => {
        if (!editingReplyId || savingReply) return;
        if (attachmentBlockReason && editReplyPendingAttachments.length > 0) {
            setEditReplyError(attachmentBlockReason);
            return;
        }
        setSavingReply(true);
        setEditReplyError(null);
        try {
            const uploaded = await uploadPendingAttachments(editReplyPendingAttachments, setEditReplyUploadProgress);
            const attachmentIds = [
                ...editReplyExistingAttachments.map((attachment) => attachment.id),
                ...uploaded.map((attachment) => attachment.id),
            ];
            const content = editReplyContent.trim() || null;
            if (!content && attachmentIds.length === 0) {
                setEditReplyError('Replies must keep text or at least one attachment.');
                setSavingReply(false);
                return;
            }
            await api.messages.edit(channelId, editingReplyId, {
                content,
                attachmentIds,
            });
            clearReplyEditor();
            await fetchMessages();
        } catch (err: any) {
            setEditReplyError(err?.message || 'Could not save reply');
        }
        setSavingReply(false);
    }, [attachmentBlockReason, channelId, clearReplyEditor, editReplyContent, editReplyExistingAttachments, editReplyPendingAttachments, editingReplyId, fetchMessages, savingReply]);

    const handleSend = async () => {
        if ((!reply.trim() && replyAttachments.length === 0) || sending) return;
        if (attachmentBlockReason && replyAttachments.length > 0) {
            setReplyError(attachmentBlockReason);
            return;
        }
        setSending(true);
        setReplyError(null);
        try {
            const uploaded = await uploadPendingAttachments(replyAttachments, setReplyUploadProgress);
            await api.messages.send(channelId, {
                content: reply.trim() || null,
                threadId: thread.id,
                attachmentIds: uploaded.map(file => file.id),
            });
            setReply('');
            revokePendingAttachments(replyAttachments);
            setReplyAttachments([]);
            setReplyUploadProgress({});
            try { localStorage.removeItem(draftKey); } catch { /* ok */ }
            await fetchMessages();
            setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        } catch (err: any) {
            setReplyError(err?.message || 'Could not send reply');
        }
        setSending(false);
    };

    const handleResolve = async () => {
        try {
            await api.channels.update(thread.id, { archived: true });
        } catch { /* best effort */ }
        setResolved(true);
        onResolve?.(thread.id);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const op = messages[0];
    const replies = messages.slice(1);
    const gradient = threadGradient(thread.id + threadTitle);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* ── Post header ── */}
            <div style={{
                padding: '12px 20px', borderBottom: '1px solid var(--stroke)',
                background: 'var(--bg-primary)', flexShrink: 0,
            }}>
                <button
                    onClick={onBack}
                    aria-label="Back to forum"
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '5px 10px 5px 8px', borderRadius: '8px', border: 'none',
                        background: 'transparent', color: 'var(--text-muted)',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                        marginBottom: '8px',
                        transition: 'color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-tertiary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                    <ArrowLeft size={15} /> #{channelName}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Thumbnail dot */}
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: gradient, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'rgba(255,255,255,0.35)', userSelect: 'none' }}>{threadInitials(threadTitle)}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {threadTitle}
                        </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                            {resolved && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 7px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '10px', fontWeight: 700, color: '#10b981' }}><CheckCircle size={9} /> Solved</span>}
                            {thread.locked && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 7px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, color: 'var(--error)' }}><Lock size={9} /> Locked</span>}
                            {threadTags.slice(0, 3).map(tagId => {
                                const tag = forumTags.find(t => t.id === tagId);
                                return tag ? <span key={tagId} style={{ padding: '1px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: `${tag.color || '#5865f2'}20`, color: tag.color || 'var(--accent-primary)', border: `1px solid ${tag.color || 'var(--accent-primary)'}40` }}>{tag.name}</span> : null;
                            })}
                        </div>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                    </span>
                    {!resolved && (
                        <button onClick={handleResolve} title="Mark as Resolved" style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.08)', color: '#10b981', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                            <CheckCircle size={13} /> Mark Resolved
                        </button>
                    )}
                    {resolved && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '12px', fontWeight: 700, color: '#10b981', flexShrink: 0 }}>
                            <CheckCircle size={13} /> Resolved
                        </span>
                    )}
                    {op?.authorId === currentUserId && (
                        <button
                            onClick={editingPost ? clearPostEditor : startPostEditor}
                            style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid var(--stroke)', background: editingPost ? 'var(--bg-tertiary)' : 'transparent', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                        >
                            {editingPost ? 'Cancel Edit' : 'Edit Post'}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Messages ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px', color: 'var(--text-muted)', gap: '10px' }}>
                        <Loader2 size={24} className="spin" style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ fontSize: '13px' }}>Loading post…</span>
                    </div>
                ) : (
                    <>
                        {/* ── Original post ── */}
                        {op ? (
                            <div style={{
                                padding: '16px 18px', borderRadius: '12px', marginBottom: '20px',
                                background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                    <Avatar userId={op.authorId || ''} displayName={op.authorName || ''} avatarHash={op.authorAvatarHash} size={32} />
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{op.authorName || 'Unknown'}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{timeAgo(op.createdAt)}</div>
                                    </div>
                                    <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, background: 'rgba(82,109,245,0.12)', color: 'var(--accent-primary)', border: '1px solid rgba(82,109,245,0.25)' }}>OP</span>
                                </div>
                                {editingPost ? (
                                    <>
                                        <input
                                            value={editTitle}
                                            onChange={e => setEditTitle(e.target.value)}
                                            placeholder="Post title"
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 700, fontFamily: 'inherit', marginBottom: '10px', boxSizing: 'border-box', outline: 'none' }}
                                        />
                                        {forumTags.length > 0 && (
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                                {forumTags.map(tag => (
                                                    <button
                                                        key={tag.id}
                                                        onClick={() => setEditTags(prev => prev.includes(tag.id) ? prev.filter(t => t !== tag.id) : [...prev, tag.id])}
                                                        style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, border: `1px solid ${editTags.includes(tag.id) ? (tag.color || 'var(--accent-primary)') : 'var(--stroke)'}`, background: editTags.includes(tag.id) ? `${tag.color || 'var(--accent-primary)'}18` : 'var(--bg-tertiary)', color: editTags.includes(tag.id) ? (tag.color || 'var(--accent-primary)') : 'var(--text-secondary)', cursor: 'pointer' }}
                                                    >{tag.name}</button>
                                                ))}
                                            </div>
                                        )}
                                        <textarea
                                            value={editContent}
                                            onChange={e => setEditContent(e.target.value)}
                                            rows={4}
                                            placeholder="Describe your post…"
                                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', marginBottom: '12px', boxSizing: 'border-box', outline: 'none' }}
                                        />
                                        <input
                                            ref={editPostFileInputRef}
                                            type="file"
                                            multiple
                                            style={{ display: 'none' }}
                                            onChange={e => {
                                                const selected = Array.from(e.target.files || []);
                                                if (selected.length > 0 && attachmentBlockReason) {
                                                    setEditError(attachmentBlockReason);
                                                    e.target.value = '';
                                                    return;
                                                }
                                                if (selected.length > 0) setEditPendingAttachments(prev => [...prev, ...filesToPending(selected)]);
                                                e.target.value = '';
                                            }}
                                        />
                                        <ExistingAttachmentList
                                            attachments={editExistingAttachments}
                                            onRemove={(attachmentId) => setEditExistingAttachments(prev => prev.filter((attachment) => attachment.id !== attachmentId))}
                                        />
                                        <PendingAttachmentList
                                            files={editPendingAttachments}
                                            progress={editUploadProgress}
                                            onRemove={index => {
                                                setEditPendingAttachments(prev => {
                                                    const next = [...prev];
                                                    const removed = next.splice(index, 1)[0];
                                                    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
                                                    return next;
                                                });
                                            }}
                                        />
                                        {editError && <div style={{ marginBottom: '12px', color: 'var(--error)', fontSize: '12px', fontWeight: 600 }}>{editError}</div>}
                                        {attachmentBlockReason && <div style={{ marginBottom: '12px', color: 'var(--text-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><Lock size={13} /> {attachmentBlockReason}</div>}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                            <button
                                                onClick={() => editPostFileInputRef.current?.click()}
                                                disabled={!!attachmentBlockReason}
                                                style={{ marginRight: 'auto', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: attachmentBlockReason ? 'not-allowed' : 'pointer', opacity: attachmentBlockReason ? 0.55 : 1 }}
                                            >
                                                Add attachments
                                            </button>
                                            <button onClick={clearPostEditor} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                            <button onClick={handleSavePost} disabled={savingPost || !editTitle.trim()} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: editTitle.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: editTitle.trim() ? '#fff' : 'var(--text-muted)', fontSize: '13px', fontWeight: 700, cursor: editTitle.trim() && !savingPost ? 'pointer' : 'not-allowed', opacity: savingPost ? 0.7 : 1 }}>
                                                {savingPost ? 'Saving…' : 'Save Post'}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                            {op.content || ((op.attachments?.length ?? 0) === 0 ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No content.</span> : null)}
                                        </div>
                                        {op.edited && <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>(edited)</div>}
                                        <AttachmentRenderer attachments={op.attachments} />
                                    </>
                                )}
                            </div>
                        ) : (
                            <div style={{ padding: '16px 18px', borderRadius: '12px', marginBottom: '20px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
                                No post content yet.
                            </div>
                        )}

                        {/* ── Replies separator ── */}
                        {replies.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                <div style={{ flex: 1, height: '1px', background: 'var(--stroke)' }} />
                                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}</span>
                                <div style={{ flex: 1, height: '1px', background: 'var(--stroke)' }} />
                            </div>
                        )}

                        {/* ── Reply cards ── */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {replies.map(msg => (
                                <div key={msg.id} style={{ padding: '12px 16px', borderRadius: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <Avatar userId={msg.authorId || ''} displayName={msg.authorName || ''} avatarHash={msg.authorAvatarHash} size={24} />
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{msg.authorName || 'Unknown'}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{timeAgo(msg.createdAt)}</span>
                                        {msg.edited && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(edited)</span>}
                                        {msg.authorId === currentUserId && (
                                            <button
                                                onClick={() => editingReplyId === msg.id ? clearReplyEditor() : startReplyEditor(msg)}
                                                style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--stroke)', background: editingReplyId === msg.id ? 'var(--bg-tertiary)' : 'transparent', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                {editingReplyId === msg.id ? 'Cancel' : 'Edit'}
                                            </button>
                                        )}
                                    </div>
                                    {editingReplyId === msg.id ? (
                                        <>
                                            <textarea
                                                value={editReplyContent}
                                                onChange={e => setEditReplyContent(e.target.value)}
                                                rows={3}
                                                placeholder="Edit reply…"
                                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', marginBottom: '12px', boxSizing: 'border-box', outline: 'none' }}
                                            />
                                            <input
                                                ref={editReplyFileInputRef}
                                                type="file"
                                                multiple
                                                style={{ display: 'none' }}
                                                onChange={e => {
                                                    const selected = Array.from(e.target.files || []);
                                                    if (selected.length > 0 && attachmentBlockReason) {
                                                        setEditReplyError(attachmentBlockReason);
                                                        e.target.value = '';
                                                        return;
                                                    }
                                                    if (selected.length > 0) setEditReplyPendingAttachments(prev => [...prev, ...filesToPending(selected)]);
                                                    e.target.value = '';
                                                }}
                                            />
                                            <ExistingAttachmentList
                                                attachments={editReplyExistingAttachments}
                                                onRemove={(attachmentId) => setEditReplyExistingAttachments(prev => prev.filter((attachment) => attachment.id !== attachmentId))}
                                            />
                                            <PendingAttachmentList
                                                files={editReplyPendingAttachments}
                                                progress={editReplyUploadProgress}
                                                onRemove={index => {
                                                    setEditReplyPendingAttachments(prev => {
                                                        const next = [...prev];
                                                        const removed = next.splice(index, 1)[0];
                                                        if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
                                                        return next;
                                                    });
                                                }}
                                            />
                                            {editReplyError && <div style={{ marginBottom: '12px', color: 'var(--error)', fontSize: '12px', fontWeight: 600 }}>{editReplyError}</div>}
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                                <button onClick={() => editReplyFileInputRef.current?.click()} disabled={!!attachmentBlockReason} style={{ marginRight: 'auto', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: attachmentBlockReason ? 'not-allowed' : 'pointer', opacity: attachmentBlockReason ? 0.55 : 1 }}>Add attachments</button>
                                                <button onClick={clearReplyEditor} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                                <button onClick={handleSaveReply} disabled={savingReply} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent-primary)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: savingReply ? 'not-allowed' : 'pointer', opacity: savingReply ? 0.7 : 1 }}>{savingReply ? 'Saving…' : 'Save Reply'}</button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                {msg.content}
                                            </div>
                                            <AttachmentRenderer attachments={msg.attachments} />
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div ref={bottomRef} />
                    </>
                )}
            </div>

            {/* ── Reply composer ── */}
            {!thread.locked && (
                <div style={{
                    padding: '12px 16px', borderTop: '1px solid var(--stroke)',
                    background: 'var(--bg-primary)', flexShrink: 0,
                }}>
                    <input
                        data-testid="forum-reply-file-input"
                        ref={replyFileInputRef}
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        onChange={e => {
                            const selected = Array.from(e.target.files || []);
                            if (selected.length > 0 && attachmentBlockReason) {
                                setReplyError(attachmentBlockReason);
                                e.target.value = '';
                                return;
                            }
                            if (selected.length > 0) setReplyAttachments(prev => [...prev, ...filesToPending(selected)]);
                            e.target.value = '';
                        }}
                    />
                    <PendingAttachmentList
                        files={replyAttachments}
                        progress={replyUploadProgress}
                        onRemove={index => {
                            setReplyAttachments(prev => {
                                const next = [...prev];
                                const removed = next.splice(index, 1)[0];
                                if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
                                return next;
                            });
                        }}
                    />
                    {replyError && (
                        <div style={{ margin: '0 0 8px', color: 'var(--error)', fontSize: '12px', fontWeight: 600 }}>{replyError}</div>
                    )}
                    {attachmentBlockReason && (
                        <div style={{ margin: '0 0 8px', color: 'var(--text-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Lock size={13} /> {attachmentBlockReason}
                        </div>
                    )}
                    <div style={{
                        display: 'flex', gap: '10px', alignItems: 'flex-end',
                        background: 'var(--bg-elevated)', borderRadius: '10px',
                        border: '1px solid var(--stroke)', padding: '10px 12px',
                    }}>
                        <button
                            onClick={() => replyFileInputRef.current?.click()}
                            title={attachmentBlockReason || 'Attach files'}
                            aria-label="Attach files"
                            disabled={!!attachmentBlockReason}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '34px', height: '34px', borderRadius: '8px', border: '1px solid var(--stroke)',
                                background: 'var(--bg-tertiary)', color: 'var(--text-muted)', cursor: attachmentBlockReason ? 'not-allowed' : 'pointer',
                                flexShrink: 0,
                                opacity: attachmentBlockReason ? 0.55 : 1,
                            }}
                        >
                            <Paperclip size={15} />
                        </button>
                        <textarea
                            ref={textareaRef}
                            value={reply}
                            onChange={e => {
                                setReply(e.target.value);
                                try { if (e.target.value) { localStorage.setItem(draftKey, e.target.value); } else { localStorage.removeItem(draftKey); } } catch { /* ok */ }
                            }}
                            onKeyDown={handleKeyDown}
                            onPaste={e => {
                                const items = e.clipboardData?.items;
                                if (!items) return;
                                const pasted: File[] = [];
                                for (const item of Array.from(items)) {
                                    if (item.type.startsWith('image/')) {
                                        const file = item.getAsFile();
                                        if (file) pasted.push(new File([file], file.name || `pasted-image.${item.type.split('/')[1] || 'png'}`, { type: file.type }));
                                    }
                                }
                                if (pasted.length > 0) {
                                    e.preventDefault();
                                    if (attachmentBlockReason) {
                                        setReplyError(attachmentBlockReason);
                                        return;
                                    }
                                    setReplyAttachments(prev => [...prev, ...filesToPending(pasted)]);
                                }
                            }}
                            placeholder="Write a reply… (Enter to send, Shift+Enter for new line)"
                            rows={1}
                            style={{
                                flex: 1, border: 'none', background: 'transparent', resize: 'none',
                                color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'inherit',
                                outline: 'none', lineHeight: 1.5, maxHeight: '120px', overflowY: 'auto',
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={(!reply.trim() && replyAttachments.length === 0) || sending}
                            aria-label="Send reply"
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '34px', height: '34px', borderRadius: '8px', border: 'none',
                                background: reply.trim() || replyAttachments.length > 0 ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                color: reply.trim() || replyAttachments.length > 0 ? '#fff' : 'var(--text-muted)',
                                cursor: (reply.trim() || replyAttachments.length > 0) && !sending ? 'pointer' : 'not-allowed',
                                flexShrink: 0, transition: 'background 0.15s',
                            }}
                        >
                            {sending ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                        </button>
                    </div>
                </div>
            )}
            {thread.locked && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--stroke)', background: 'var(--bg-primary)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <Lock size={14} /> This post is locked. New replies are disabled.
                </div>
            )}
        </div>
    );
}
