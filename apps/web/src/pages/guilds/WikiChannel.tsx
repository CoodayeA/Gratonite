import { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { FileText, Folder, History, Edit3, Settings, Save, Plus, X, Check, Clock, User, Lock, Archive, Eye, EyeOff, Loader2, Search, Columns } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

const FOLDERS = ['General', 'Engineering', 'Design'];

function computeLineDiff(oldText: string, newText: string): Array<{ type: 'same' | 'add' | 'remove'; line: string }> {
    const a = oldText.split('\n');
    const b = newText.split('\n');
    const n = a.length, m = b.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = 1; i <= n; i++)
        for (let j = 1; j <= m; j++)
            dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
    const result: Array<{ type: 'same' | 'add' | 'remove'; line: string }> = [];
    let i = n, j = m;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i-1] === b[j-1]) {
            result.unshift({ type: 'same', line: a[i-1] }); i--; j--;
        } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
            result.unshift({ type: 'add', line: b[j-1] }); j--;
        } else {
            result.unshift({ type: 'remove', line: a[i-1] }); i--;
        }
    }
    return result;
}

type SideLine = { left: string | null; right: string | null; rowType: 'same' | 'change' | 'add' | 'remove' };

function toSideBySide(diff: Array<{ type: 'same' | 'add' | 'remove'; line: string }>): SideLine[] {
    const rows: SideLine[] = [];
    let i = 0;
    while (i < diff.length) {
        if (diff[i].type === 'same') {
            rows.push({ left: diff[i].line, right: diff[i].line, rowType: 'same' }); i++;
        } else {
            const removes: string[] = [], adds: string[] = [];
            while (i < diff.length && diff[i].type === 'remove') { removes.push(diff[i].line); i++; }
            while (i < diff.length && diff[i].type === 'add') { adds.push(diff[i].line); i++; }
            const len = Math.max(removes.length, adds.length);
            for (let k = 0; k < len; k++) {
                rows.push({
                    left: removes[k] ?? null, right: adds[k] ?? null,
                    rowType: removes[k] !== undefined && adds[k] !== undefined ? 'change' : removes[k] !== undefined ? 'remove' : 'add',
                });
            }
        }
    }
    return rows;
}

const WikiChannel = () => {
    const { hasCustomBg } = useOutletContext<{ hasCustomBg: boolean }>();
    const { addToast } = useToast();
    const { channelId } = useParams<{ channelId: string; guildId: string }>();

    const [pages, setPages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showNewPageForm, setShowNewPageForm] = useState(false);
    const [newPageTitle, setNewPageTitle] = useState('');
    const [newPageFolder, setNewPageFolder] = useState('General');
    const [isCreating, setIsCreating] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [revisions, setRevisions] = useState<any[]>([]);
    const [revisionsLoading, setRevisionsLoading] = useState(false);
    const [pageSettings, setPageSettings] = useState<Record<string, { readOnly: boolean; archived: boolean; visible: boolean }>>({});
    const [draftContent, setDraftContent] = useState('');
    const [wikiSearchQuery, setWikiSearchQuery] = useState('');
    const [wikiSearchResults, setWikiSearchResults] = useState<Array<{ id: string; title: string; snippet: string; folder?: string }>>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedRevisionForDiff, setSelectedRevisionForDiff] = useState<any | null>(null);
    const [showDiff, setShowDiff] = useState(false);

    // Fetch wiki pages on mount / channel change
    useEffect(() => {
        if (!channelId) return;
        setLoading(true);
        setError(null);
        api.wiki.listPages(channelId)
            .then(data => {
                setPages(data);
                if (data.length > 0) {
                    setSelectedPageId(data[0].id);
                    setDraftContent(data[0].content ?? '');
                }
            })
            .catch(err => {
                setError(err.message ?? 'Failed to load wiki pages.');
                addToast({ title: 'Error', description: err.message ?? 'Failed to load wiki pages.', variant: 'error' });
            })
            .finally(() => setLoading(false));
    }, [channelId]);

    // Fetch revisions when history panel opens for the active page
    useEffect(() => {
        if (!showHistory || !activePage) return;
        setRevisionsLoading(true);
        api.wiki.getRevisions(activePage.id)
            .then(setRevisions)
            .catch(err => {
                addToast({ title: 'Error', description: err.message ?? 'Failed to load revisions.', variant: 'error' });
            })
            .finally(() => setRevisionsLoading(false));
    }, [showHistory, selectedPageId]);

    const activePage = pages.find(p => p.id === selectedPageId) ?? pages[0] ?? null;
    const currentSettings = activePage ? (pageSettings[activePage.id] ?? { readOnly: false, archived: false, visible: true }) : { readOnly: false, archived: false, visible: true };

    const diffData = useMemo(() => {
        if (!showDiff || !selectedRevisionForDiff || !activePage) return null;
        const diff = computeLineDiff(selectedRevisionForDiff.content ?? '', activePage.content ?? '');
        return { diff, rows: toSideBySide(diff) };
    }, [showDiff, selectedRevisionForDiff, activePage]);

    const handleCreatePage = async () => {
        const trimmed = newPageTitle.trim();
        if (!trimmed) {
            addToast({ title: 'Missing Title', description: 'Please enter a page title.', variant: 'error' });
            return;
        }
        if (!channelId) return;
        setIsCreating(true);
        try {
            const initialContent = `# ${trimmed}\n\nStart writing here...`;
            const newPage = await api.wiki.createPage(channelId, {
                title: trimmed,
                content: initialContent,
            });
            // Attach a folder hint client-side (API may not support folders)
            const pageWithFolder = { ...newPage, folder: newPageFolder };
            setPages(prev => [...prev, pageWithFolder]);
            setSelectedPageId(newPage.id);
            setDraftContent(initialContent);
            setIsEditing(true);
            setShowNewPageForm(false);
            setNewPageTitle('');
            setNewPageFolder('General');
            addToast({ title: 'Page Created', description: `"${trimmed}" has been added to ${newPageFolder}.`, variant: 'success' });
        } catch (err: any) {
            addToast({ title: 'Error', description: err.message ?? 'Failed to create page.', variant: 'error' });
        } finally {
            setIsCreating(false);
        }
    };

    const toggleSetting = (key: 'readOnly' | 'archived' | 'visible') => {
        if (!activePage) return;
        setPageSettings(prev => ({
            ...prev,
            [activePage.id]: {
                ...currentSettings,
                [key]: !currentSettings[key],
            },
        }));
    };

    const handleEditToggle = async () => {
        if (!activePage) return;
        if (isEditing) {
            setIsSaving(true);
            try {
                const updated = await api.wiki.updatePage(activePage.id, { content: draftContent });
                setPages(prev => prev.map(p => p.id === activePage.id ? { ...p, ...updated, folder: p.folder } : p));
                addToast({ title: 'Saved', description: 'Page changes saved successfully.', variant: 'success' });
            } catch (err: any) {
                addToast({ title: 'Save Failed', description: err.message ?? 'Could not save page.', variant: 'error' });
            } finally {
                setIsSaving(false);
            }
            setIsEditing(false);
        } else {
            setDraftContent(activePage.content ?? '');
            setIsEditing(true);
        }
    };

    // Wiki search - debounced client-side search across pages
    useEffect(() => {
        if (!wikiSearchQuery.trim()) {
            setWikiSearchResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        const timer = setTimeout(() => {
            const q = wikiSearchQuery.trim().toLowerCase();
            const results = pages
                .filter(p => {
                    const title = (p.title ?? '').toLowerCase();
                    const content = (p.content ?? '').toLowerCase();
                    return title.includes(q) || content.includes(q);
                })
                .map(p => {
                    const content = p.content ?? '';
                    const idx = content.toLowerCase().indexOf(q);
                    let snippet = '';
                    if (idx >= 0) {
                        const start = Math.max(0, idx - 40);
                        const end = Math.min(content.length, idx + q.length + 60);
                        snippet = (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '');
                    } else {
                        snippet = content.slice(0, 100) + (content.length > 100 ? '...' : '');
                    }
                    return { id: p.id, title: p.title, snippet, folder: p.folder ?? 'General' };
                });
            setWikiSearchResults(results);
            setIsSearching(false);
        }, 300);
        return () => clearTimeout(timer);
    }, [wikiSearchQuery, pages]);

    const handleSelectPage = (pageId: string) => {
        setSelectedPageId(pageId);
        setIsEditing(false);
        setShowHistory(false);
        setShowSettings(false);
        setWikiSearchQuery('');
        setWikiSearchResults([]);
        const page = pages.find(p => p.id === pageId);
        if (page) setDraftContent(page.content ?? '');
    };

    // ── Loading / Error states ───────────────────────────────────────────

    if (loading) {
        return (
            <main className={`main-view ${hasCustomBg ? 'has-custom-bg' : ''}`} style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
                <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Loading wiki...</p>
            </main>
        );
    }

    if (error) {
        return (
            <main className={`main-view ${hasCustomBg ? 'has-custom-bg' : ''}`} style={{ alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: 'var(--error)', fontSize: '15px' }}>{error}</p>
                <button
                    onClick={() => { setError(null); setLoading(true); api.wiki.listPages(channelId!).then(setPages).catch(() => { setError('Failed to reload wiki pages'); }).finally(() => setLoading(false)); }}
                    className="auth-button"
                    style={{ marginTop: '16px', width: 'auto', padding: '0 24px', height: '36px' }}
                >
                    Retry
                </button>
            </main>
        );
    }

    return (
        <main className={`main-view ${hasCustomBg ? 'has-custom-bg' : ''}`} style={{ flexDirection: 'row', padding: 0 }}>
            {/* Wiki Sidebar */}
            <div style={{ width: '280px', borderRight: '1px solid var(--stroke)', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '24px 16px', borderBottom: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={20} color="var(--accent-primary)" />
                        Guild Wiki
                    </h2>
                    <button onClick={() => setShowNewPageForm(prev => !prev)} style={{ background: 'transparent', border: 'none', color: showNewPageForm ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
                        {showNewPageForm ? <X size={18} /> : <Plus size={18} />}
                    </button>
                </div>

                {showNewPageForm && (
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-tertiary)' }}>
                        <input
                            type="text"
                            value={newPageTitle}
                            onChange={e => setNewPageTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleCreatePage(); }}
                            placeholder="Page title..."
                            autoFocus
                            style={{
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--stroke)',
                                borderRadius: '6px',
                                padding: '8px 12px',
                                color: 'var(--text-primary)',
                                fontSize: '14px',
                                outline: 'none',
                            }}
                        />
                        <select
                            value={newPageFolder}
                            onChange={e => setNewPageFolder(e.target.value)}
                            style={{
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--stroke)',
                                borderRadius: '6px',
                                padding: '8px 12px',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                outline: 'none',
                                cursor: 'pointer',
                            }}
                        >
                            {FOLDERS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <button
                            onClick={handleCreatePage}
                            disabled={isCreating}
                            style={{
                                background: 'var(--accent-primary)',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '8px 12px',
                                color: 'white',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: isCreating ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                opacity: isCreating ? 0.7 : 1,
                            }}
                        >
                            {isCreating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                            {isCreating ? 'Creating...' : 'Create Page'}
                        </button>
                    </div>
                )}

                {/* Wiki Search */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--stroke)' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '6px 10px',
                        border: '1px solid var(--stroke)',
                    }}>
                        <Search size={14} color="var(--text-muted)" />
                        <input
                            type="text"
                            placeholder="Search wiki..."
                            value={wikiSearchQuery}
                            onChange={e => setWikiSearchQuery(e.target.value)}
                            style={{
                                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                                color: 'var(--text-primary)', fontSize: '13px',
                            }}
                        />
                        {wikiSearchQuery && (
                            <button onClick={() => { setWikiSearchQuery(''); setWikiSearchResults([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
                    {/* Search Results */}
                    {wikiSearchQuery.trim() && (
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                                {isSearching ? 'Searching...' : `${wikiSearchResults.length} result${wikiSearchResults.length !== 1 ? 's' : ''}`}
                            </div>
                            {wikiSearchResults.map(result => (
                                <div
                                    key={result.id}
                                    onClick={() => handleSelectPage(result.id)}
                                    style={{
                                        padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
                                        marginBottom: '4px', background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--stroke)',
                                    }}
                                    onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                                    onMouseOut={e => e.currentTarget.style.borderColor = 'var(--stroke)'}
                                >
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                                        {result.title}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                        {result.folder}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                                        {result.snippet}
                                    </div>
                                </div>
                            ))}
                            {wikiSearchResults.length === 0 && !isSearching && (
                                <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                    No pages match your search.
                                </div>
                            )}
                        </div>
                    )}

                    {!wikiSearchQuery.trim() && pages.length === 0 && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '24px' }}>
                            No pages yet. Create the first one!
                        </p>
                    )}
                    {!wikiSearchQuery.trim() && FOLDERS.map(folder => {
                        const folderPages = pages.filter(p => (p.folder ?? 'General') === folder);
                        if (folderPages.length === 0) return null;
                        return (
                            <div key={folder} style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                                    <Folder size={14} /> {folder}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {folderPages.map(page => (
                                        <div
                                            key={page.id}
                                            onClick={() => handleSelectPage(page.id)}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                background: selectedPageId === page.id ? 'var(--bg-tertiary)' : 'transparent',
                                                color: selectedPageId === page.id ? 'white' : 'var(--text-secondary)',
                                            }}
                                        >
                                            {page.title}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                    {/* Pages without a matching folder */}
                    {!wikiSearchQuery.trim() && (() => {
                        const ungrouped = pages.filter(p => !FOLDERS.includes(p.folder ?? ''));
                        if (ungrouped.length === 0) return null;
                        return (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                                    <Folder size={14} /> Other
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {ungrouped.map(page => (
                                        <div
                                            key={page.id}
                                            onClick={() => handleSelectPage(page.id)}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '14px',
                                                background: selectedPageId === page.id ? 'var(--bg-tertiary)' : 'transparent',
                                                color: selectedPageId === page.id ? 'white' : 'var(--text-secondary)',
                                            }}
                                        >
                                            {page.title}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Main Editor/Viewer Area */}
            {activePage ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
                    {/* Top Toolbar */}
                    <div style={{ height: '64px', borderBottom: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', background: 'var(--bg-elevated)' }}>
                        <div>
                            <h1 style={{ fontSize: '20px', fontWeight: 600 }}>{activePage.title}</h1>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span>Last edited by {activePage.author ?? activePage.authorId ?? 'Unknown'}</span>
                                <span>•</span>
                                <span>{activePage.lastEdited ?? activePage.updatedAt ?? activePage.createdAt ?? ''}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => { setShowHistory(prev => !prev); setShowSettings(false); }} className="icon-button" style={{ background: showHistory ? 'var(--bg-tertiary)' : 'transparent', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '8px', color: showHistory ? 'var(--accent-primary)' : 'var(--text-secondary)' }} title="History">
                                <History size={18} />
                            </button>
                            <button onClick={() => { setShowSettings(prev => !prev); setShowHistory(false); }} className="icon-button" style={{ background: showSettings ? 'var(--bg-tertiary)' : 'transparent', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '8px', color: showSettings ? 'var(--accent-primary)' : 'var(--text-secondary)' }} title="Page Settings">
                                <Settings size={18} />
                            </button>
                            <button
                                onClick={handleEditToggle}
                                disabled={isSaving}
                                className="auth-button"
                                style={{ margin: 0, padding: '8px 16px', height: 'auto', background: isEditing ? 'var(--success)' : 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px', opacity: isSaving ? 0.7 : 1 }}
                            >
                                {isSaving
                                    ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
                                    : isEditing
                                        ? <><Save size={16} /> Save Changes</>
                                        : <><Edit3 size={16} /> Edit Page</>
                                }
                            </button>
                        </div>
                    </div>

                    {/* Editor Content */}
                    <div style={{ flex: 1, display: 'flex', overflowY: 'auto' }}>
                        <div style={{ flex: 1, padding: '40px 60px', overflowY: 'auto' }}>
                            {isEditing ? (
                                <textarea
                                    value={draftContent}
                                    onChange={(e) => setDraftContent(e.target.value)}
                                    style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', color: 'white', fontSize: '16px', lineHeight: '1.6', outline: 'none', fontFamily: 'var(--font-mono)', resize: 'none' }}
                                    placeholder="Start typing in Markdown..."
                                />
                            ) : (
                                <div style={{ color: 'var(--text-primary)', fontSize: '16px', lineHeight: '1.8' }}>
                                    {(activePage.content ?? '').split('\n').map((line: string, i: number) => (
                                        <p key={i} style={{ marginBottom: line.startsWith('#') ? '16px' : '8px', fontSize: line.startsWith('#') ? '28px' : '16px', fontWeight: line.startsWith('#') ? 700 : 400 }}>
                                            {line}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Revision History Panel */}
                        {showHistory && (
                            <div style={{ width: '320px', borderLeft: '1px solid var(--stroke)', background: 'var(--bg-elevated)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Clock size={16} color="var(--accent-primary)" /> Revision History
                                    </h3>
                                    <button onClick={() => setShowHistory(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                        <X size={16} />
                                    </button>
                                </div>
                                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {revisionsLoading && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                                            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
                                        </div>
                                    )}
                                    {!revisionsLoading && revisions.length === 0 && (
                                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>No revisions yet.</p>
                                    )}
                                    {revisions.map((rev, idx) => (
                                        <div
                                            key={rev.id}
                                            style={{
                                                padding: '12px 14px',
                                                borderRadius: '8px',
                                                background: selectedRevisionForDiff?.id === rev.id ? 'rgba(99,102,241,0.12)' : idx === 0 ? 'var(--bg-tertiary)' : 'transparent',
                                                border: selectedRevisionForDiff?.id === rev.id ? '1px solid var(--accent-primary)' : idx === 0 ? '1px solid var(--accent-primary)' : '1px solid transparent',
                                                cursor: idx === 0 ? 'default' : 'pointer',
                                            }}
                                        >
                                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                                {rev.summary ?? rev.changeNote ?? 'Edit'}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <User size={12} /> {rev.author ?? rev.authorId ?? 'Unknown'}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                {rev.date ?? rev.createdAt ?? ''}
                                            </div>
                                            {idx === 0 ? (
                                                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', marginTop: '6px', display: 'inline-block' }}>
                                                    Current
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => { setSelectedRevisionForDiff(rev); setShowDiff(true); }}
                                                    style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                                >
                                                    <Columns size={11} /> View Diff
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Page Settings Panel */}
                        {showSettings && (
                            <div style={{ width: '320px', borderLeft: '1px solid var(--stroke)', background: 'var(--bg-elevated)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Settings size={16} color="var(--accent-primary)" /> Page Settings
                                    </h3>
                                    <button onClick={() => setShowSettings(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                        <X size={16} />
                                    </button>
                                </div>
                                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {/* Read-Only Toggle */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Lock size={16} color="var(--text-muted)" />
                                            <div>
                                                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Read-Only</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Prevent edits to this page</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleSetting('readOnly')}
                                            style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: currentSettings.readOnly ? 'var(--accent-primary)' : 'var(--bg-tertiary)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
                                        >
                                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: currentSettings.readOnly ? '23px' : '3px', transition: 'left 0.2s' }} />
                                        </button>
                                    </div>

                                    {/* Archived Toggle */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Archive size={16} color="var(--text-muted)" />
                                            <div>
                                                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Archived</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Hide from active pages</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleSetting('archived')}
                                            style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: currentSettings.archived ? 'var(--accent-primary)' : 'var(--bg-tertiary)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
                                        >
                                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: currentSettings.archived ? '23px' : '3px', transition: 'left 0.2s' }} />
                                        </button>
                                    </div>

                                    {/* Visible Toggle */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            {currentSettings.visible ? <Eye size={16} color="var(--text-muted)" /> : <EyeOff size={16} color="var(--text-muted)" />}
                                            <div>
                                                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Visible to Members</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Show this page to all guild members</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleSetting('visible')}
                                            style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: currentSettings.visible ? 'var(--accent-primary)' : 'var(--bg-tertiary)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
                                        >
                                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: currentSettings.visible ? '23px' : '3px', transition: 'left 0.2s' }} />
                                        </button>
                                    </div>

                                    <div style={{ borderTop: '1px solid var(--stroke)', paddingTop: '16px', marginTop: '4px' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', fontWeight: 600 }}>Page Info</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div>Created by: <span style={{ color: 'var(--text-primary)' }}>{activePage.author ?? activePage.authorId ?? 'Unknown'}</span></div>
                                            <div>Last edited: <span style={{ color: 'var(--text-primary)' }}>{activePage.lastEdited ?? activePage.updatedAt ?? activePage.createdAt ?? 'Unknown'}</span></div>
                                            <div>Folder: <span style={{ color: 'var(--text-primary)' }}>{activePage.folder ?? 'General'}</span></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: '12px' }}>
                    <FileText size={48} style={{ opacity: 0.3 }} />
                    <p style={{ fontSize: '15px' }}>No pages yet. Create one to get started.</p>
                </div>
            )}
            {/* Revision Diff Modal */}
            {diffData && showDiff && selectedRevisionForDiff && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                    <div style={{ width: '100%', maxWidth: '1100px', height: '80vh', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Columns size={16} color="var(--accent-primary)" />
                                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Diff — {activePage?.title}</h3>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    {selectedRevisionForDiff.date ?? selectedRevisionForDiff.createdAt ?? ''} · {selectedRevisionForDiff.author ?? selectedRevisionForDiff.authorId ?? 'Unknown'}
                                </span>
                                <button onClick={() => setShowDiff(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--stroke)', flexShrink: 0 }}>
                            <div style={{ flex: 1, padding: '6px 16px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#f87171', background: 'rgba(239,68,68,0.05)', letterSpacing: '0.05em' }}>← Older Revision</div>
                            <div style={{ width: 1, background: 'var(--stroke)' }} />
                            <div style={{ flex: 1, padding: '6px 16px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#4ade80', background: 'rgba(34,197,94,0.05)', letterSpacing: '0.05em' }}>Current Version →</div>
                        </div>
                        <div style={{ flex: 1, display: 'flex', overflowY: 'auto', fontFamily: 'var(--font-mono, monospace)', fontSize: '13px', lineHeight: '20px' }}>
                            <div style={{ flex: 1, overflowX: 'hidden' }}>
                                {diffData.rows.map((row, i) => (
                                    <div key={i} style={{
                                        padding: '1px 16px', minHeight: '22px',
                                        background: row.left === null ? 'transparent' : (row.rowType === 'remove' || row.rowType === 'change') ? 'rgba(239,68,68,0.1)' : 'transparent',
                                        color: (row.rowType === 'remove' || row.rowType === 'change') && row.left !== null ? '#f87171' : 'var(--text-secondary)',
                                        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                                    }}>
                                        {row.left !== null ? ((row.rowType === 'remove' || row.rowType === 'change') ? '- ' : '  ') + row.left : ''}
                                    </div>
                                ))}
                            </div>
                            <div style={{ width: 1, background: 'var(--stroke)', flexShrink: 0 }} />
                            <div style={{ flex: 1, overflowX: 'hidden' }}>
                                {diffData.rows.map((row, i) => (
                                    <div key={i} style={{
                                        padding: '1px 16px', minHeight: '22px',
                                        background: row.right === null ? 'transparent' : (row.rowType === 'add' || row.rowType === 'change') ? 'rgba(34,197,94,0.1)' : 'transparent',
                                        color: (row.rowType === 'add' || row.rowType === 'change') && row.right !== null ? '#4ade80' : 'var(--text-secondary)',
                                        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                                    }}>
                                        {row.right !== null ? ((row.rowType === 'add' || row.rowType === 'change') ? '+ ' : '  ') + row.right : ''}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--stroke)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                            <div>
                                <span style={{ color: '#f87171', fontWeight: 600 }}>{diffData.diff.filter(d => d.type === 'remove').length}</span> removed &nbsp;
                                <span style={{ color: '#4ade80', fontWeight: 600 }}>{diffData.diff.filter(d => d.type === 'add').length}</span> added
                            </div>
                            <button onClick={() => setShowDiff(false)} className="auth-button" style={{ margin: 0, width: 'auto', padding: '0 16px', height: '32px', fontSize: '13px' }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default WikiChannel;
