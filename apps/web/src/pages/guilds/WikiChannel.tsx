import { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { FileText, Folder, History, Edit3, Settings, Save, Plus, X, Check, Clock, User, Lock, Archive, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

const FOLDERS = ['General', 'Engineering', 'Design'];

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

    const handleSelectPage = (pageId: string) => {
        setSelectedPageId(pageId);
        setIsEditing(false);
        setShowHistory(false);
        setShowSettings(false);
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
                    onClick={() => { setError(null); setLoading(true); api.wiki.listPages(channelId!).then(setPages).catch(() => {}).finally(() => setLoading(false)); }}
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

                <div style={{ overflowY: 'auto', flex: 1, padding: '16px' }}>
                    {pages.length === 0 && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '24px' }}>
                            No pages yet. Create the first one!
                        </p>
                    )}
                    {FOLDERS.map(folder => {
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
                    {(() => {
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
                                                background: idx === 0 ? 'var(--bg-tertiary)' : 'transparent',
                                                border: idx === 0 ? '1px solid var(--accent-primary)' : '1px solid transparent',
                                                cursor: 'pointer',
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
                                            {idx === 0 && (
                                                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', marginTop: '6px', display: 'inline-block' }}>
                                                    Current
                                                </span>
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
        </main>
    );
};

export default WikiChannel;
