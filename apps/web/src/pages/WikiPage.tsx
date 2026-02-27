import { useEffect, useState, useRef, CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';

interface WikiPageData {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  channelId: string;
  guildId: string;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  isArchived: boolean;
}

interface WikiRevision {
  id: string;
  pageId: string;
  content: string;
  title: string;
  createdAt: string;
  authorId?: string;
}

const styles = {
  page: {
    display: 'flex',
    height: '100%',
    background: '#2c2c3e',
    color: '#e8e4e0',
    overflow: 'hidden',
  } as CSSProperties,
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    gap: 12,
    color: '#a8a4b8',
  } as CSSProperties,
  spinner: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '3px solid #4a4660',
    borderTopColor: '#d4af37',
    animation: 'spin 0.8s linear infinite',
  } as CSSProperties,
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    gap: 8,
    color: '#a8a4b8',
  } as CSSProperties,
  sidebar: {
    width: 260,
    minWidth: 260,
    background: '#353348',
    borderRight: '1px solid #4a4660',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as CSSProperties,
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 16px 12px',
    borderBottom: '1px solid #4a4660',
  } as CSSProperties,
  sidebarTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#e8e4e0',
  } as CSSProperties,
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: '#d4af37',
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  } as CSSProperties,
  pagesList: {
    flex: 1,
    overflowY: 'auto',
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  } as CSSProperties,
  emptyText: {
    color: '#6e6a80',
    fontSize: 13,
    textAlign: 'center' as const,
    padding: '24px 16px',
    margin: 0,
  } as CSSProperties,
  pageItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: '#a8a4b8',
    fontSize: 14,
    textAlign: 'left' as const,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  } as CSSProperties,
  pageItemActive: {
    background: '#413d58',
    color: '#e8e4e0',
  } as CSSProperties,
  pin: {
    fontSize: 12,
    flexShrink: 0,
  } as CSSProperties,
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  } as CSSProperties,
  contentHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid #4a4660',
  } as CSSProperties,
  contentTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 600,
    color: '#e8e4e0',
  } as CSSProperties,
  contentActions: {
    display: 'flex',
    gap: 8,
  } as CSSProperties,
  actionBtn: {
    padding: '6px 14px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid #4a4660',
    background: 'transparent',
    color: '#a8a4b8',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  } as CSSProperties,
  actionBtnPrimary: {
    padding: '6px 14px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: '#d4af37',
    color: '#1a1a2e',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  } as CSSProperties,
  contentBody: {
    flex: 1,
    overflowY: 'auto',
    padding: 24,
    lineHeight: 1.7,
    fontSize: 15,
    color: '#e8e4e0',
  } as CSSProperties,
  contentFooter: {
    padding: '12px 24px',
    borderTop: '1px solid #4a4660',
    fontSize: 12,
    color: '#6e6a80',
  } as CSSProperties,
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 12,
    color: '#a8a4b8',
  } as CSSProperties,
  emptyStateTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
    color: '#e8e4e0',
  } as CSSProperties,
  emptyStateText: {
    margin: 0,
    fontSize: 14,
    color: '#6e6a80',
  } as CSSProperties,
  createBtn: {
    marginTop: 8,
    padding: '10px 24px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: '#d4af37',
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  } as CSSProperties,
  // Inline add-page input row
  addPageRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '6px 8px',
  } as CSSProperties,
  addPageInput: {
    width: '100%',
    padding: '6px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid #4a4660',
    background: '#2c2c3e',
    color: '#e8e4e0',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  } as CSSProperties,
  addPageBtns: {
    display: 'flex',
    gap: 6,
  } as CSSProperties,
  smallBtn: {
    flex: 1,
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid #4a4660',
    background: 'transparent',
    color: '#a8a4b8',
    fontSize: 12,
    cursor: 'pointer',
  } as CSSProperties,
  smallBtnPrimary: {
    flex: 1,
    padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: '#d4af37',
    color: '#1a1a2e',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  } as CSSProperties,
  // Edit textarea
  editTextarea: {
    flex: 1,
    width: '100%',
    padding: 24,
    background: '#2c2c3e',
    color: '#e8e4e0',
    border: 'none',
    outline: 'none',
    resize: 'none',
    fontSize: 15,
    lineHeight: 1.7,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  } as CSSProperties,
  editTitleInput: {
    margin: 0,
    fontSize: 22,
    fontWeight: 600,
    color: '#e8e4e0',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid #d4af37',
    outline: 'none',
    width: '100%',
    padding: '2px 0',
    fontFamily: 'inherit',
  } as CSSProperties,
  // History panel (right drawer)
  historyPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 320,
    background: '#353348',
    borderLeft: '1px solid #4a4660',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 10,
  } as CSSProperties,
  historyHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid #4a4660',
  } as CSSProperties,
  historyTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: '#e8e4e0',
  } as CSSProperties,
  historyCloseBtn: {
    background: 'transparent',
    border: 'none',
    color: '#a8a4b8',
    fontSize: 18,
    cursor: 'pointer',
    lineHeight: 1,
  } as CSSProperties,
  historyList: {
    flex: 1,
    overflowY: 'auto',
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  } as CSSProperties,
  revisionItem: {
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    background: '#2c2c3e',
    cursor: 'pointer',
    border: '1px solid transparent',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  } as CSSProperties,
  revisionItemActive: {
    border: '1px solid #d4af37',
  } as CSSProperties,
  revisionDate: {
    fontSize: 12,
    color: '#a8a4b8',
  } as CSSProperties,
  revisionTitle: {
    fontSize: 13,
    color: '#e8e4e0',
    fontWeight: 500,
  } as CSSProperties,
  revisionActions: {
    display: 'flex',
    gap: 6,
    marginTop: 4,
  } as CSSProperties,
  previewArea: {
    padding: '12px 16px',
    borderTop: '1px solid #4a4660',
    maxHeight: 200,
    overflowY: 'auto',
    fontSize: 13,
    color: '#c8c4d8',
    lineHeight: 1.6,
  } as CSSProperties,
  // More dropdown
  moreMenuWrapper: {
    position: 'relative',
    display: 'inline-block',
  } as CSSProperties,
  moreDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    background: '#353348',
    border: '1px solid #4a4660',
    borderRadius: 'var(--radius-md)',
    minWidth: 140,
    zIndex: 20,
    overflow: 'hidden',
  } as CSSProperties,
  moreDropdownItem: {
    display: 'block',
    width: '100%',
    padding: '9px 16px',
    border: 'none',
    background: 'transparent',
    color: '#e8e4e0',
    fontSize: 13,
    textAlign: 'left' as const,
    cursor: 'pointer',
  } as CSSProperties,
  moreDropdownItemDanger: {
    display: 'block',
    width: '100%',
    padding: '9px 16px',
    border: 'none',
    background: 'transparent',
    color: '#e05c5c',
    fontSize: 13,
    textAlign: 'left' as const,
    cursor: 'pointer',
  } as CSSProperties,
  // Rename inline input in sidebar
  renameInput: {
    width: '100%',
    padding: '6px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid #d4af37',
    background: '#2c2c3e',
    color: '#e8e4e0',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: 4,
  } as CSSProperties,
};

export function WikiPage() {
  const { guildId, channelId } = useParams();
  const [pages, setPages] = useState<WikiPageData[]>([]);
  const [selectedPage, setSelectedPage] = useState<WikiPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // US-005: Add page
  const [showAddPage, setShowAddPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [addPageLoading, setAddPageLoading] = useState(false);

  // US-006a: Edit
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  // US-006b: History
  const [showHistory, setShowHistory] = useState(false);
  const [revisions, setRevisions] = useState<WikiRevision[]>([]);
  const [previewRevision, setPreviewRevision] = useState<WikiRevision | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // US-006c: More menu
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [renameMode, setRenameMode] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close the More dropdown when clicking outside
  useEffect(() => {
    if (!showMoreMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);

  async function fetchPages() {
    if (!channelId) return;
    try {
      const data = await api.wiki.listPages(channelId);
      setPages(data);
      return data as WikiPageData[];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return [];
    }
  }

  useEffect(() => {
    async function load() {
      if (!channelId) return;
      setLoading(true);
      try {
        const data = await api.wiki.listPages(channelId);
        setPages(data);
        if (data.length > 0) {
          setSelectedPage(data[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [channelId]);

  // US-005: Confirm add page
  async function handleAddPageConfirm() {
    if (!channelId || !newPageTitle.trim()) return;
    setAddPageLoading(true);
    try {
      const newPage = await api.wiki.createPage(channelId, {
        title: newPageTitle.trim(),
        content: '',
      });
      const updated = await fetchPages();
      // Find and select the newly created page by id
      const created = updated?.find((p) => p.id === newPage.id) ?? newPage as WikiPageData;
      setSelectedPage(created);
      setShowAddPage(false);
      setNewPageTitle('');
    } catch (err) {
      // silently ignore — page list will still refresh
    } finally {
      setAddPageLoading(false);
    }
  }

  function handleAddPageCancel() {
    setShowAddPage(false);
    setNewPageTitle('');
  }

  // US-006a: Edit handlers
  function handleEditClick() {
    if (!selectedPage) return;
    setEditMode(true);
    setEditContent(selectedPage.content);
    setEditTitle(selectedPage.title);
    setShowHistory(false);
    setShowMoreMenu(false);
  }

  async function handleSave() {
    if (!selectedPage) return;
    setSaveLoading(true);
    try {
      const updated = await api.wiki.updatePage(selectedPage.id, {
        title: editTitle,
        content: editContent,
      });
      setSelectedPage(updated as WikiPageData);
      setPages((prev) =>
        prev.map((p) => (p.id === updated.id ? (updated as WikiPageData) : p)),
      );
      setEditMode(false);
    } catch (err) {
      // keep edit mode open on failure
    } finally {
      setSaveLoading(false);
    }
  }

  function handleCancelEdit() {
    setEditMode(false);
  }

  // US-006b: History handlers
  async function handleHistoryClick() {
    if (!selectedPage) return;
    setShowMoreMenu(false);
    setEditMode(false);
    setHistoryLoading(true);
    try {
      const data = await api.wiki.getRevisions(selectedPage.id);
      setRevisions(data as WikiRevision[]);
      setPreviewRevision(null);
      setShowHistory(true);
    } catch (err) {
      // silently ignore
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleRevert(revisionId: string) {
    if (!selectedPage) return;
    try {
      const updated = await api.wiki.revertRevision(selectedPage.id, revisionId);
      setSelectedPage(updated as WikiPageData);
      setPages((prev) =>
        prev.map((p) => (p.id === updated.id ? (updated as WikiPageData) : p)),
      );
      setShowHistory(false);
      setPreviewRevision(null);
    } catch (err) {
      // silently ignore
    }
  }

  // US-006c: More menu handlers
  function handleRenameClick() {
    if (!selectedPage) return;
    setShowMoreMenu(false);
    setRenameTitle(selectedPage.title);
    setRenameMode(true);
  }

  async function handleRenameConfirm() {
    if (!selectedPage || !renameTitle.trim()) return;
    try {
      const updated = await api.wiki.updatePage(selectedPage.id, {
        title: renameTitle.trim(),
      });
      setSelectedPage(updated as WikiPageData);
      setPages((prev) =>
        prev.map((p) => (p.id === updated.id ? (updated as WikiPageData) : p)),
      );
    } catch (err) {
      // silently ignore
    } finally {
      setRenameMode(false);
      setRenameTitle('');
    }
  }

  function handleRenameCancel() {
    setRenameMode(false);
    setRenameTitle('');
  }

  async function handleDeleteClick() {
    if (!selectedPage) return;
    setShowMoreMenu(false);
    const confirmed = window.confirm('Delete this page?');
    if (!confirmed) return;
    try {
      await api.wiki.deletePage(selectedPage.id);
      const updated = await fetchPages();
      const remaining = updated ?? [];
      setSelectedPage(remaining.length > 0 ? (remaining[0] ?? null) : null);
    } catch (err) {
      // silently ignore
    }
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <p>Loading wiki...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.error}>
          <p>Unable to load wiki</p>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={styles.sidebarTitle}>Wiki</h2>
          <button
            style={styles.addBtn}
            title="New page"
            onClick={() => {
              setShowAddPage(true);
              setRenameMode(false);
            }}
          >
            +
          </button>
        </div>

        <div style={styles.pagesList}>
          {/* US-005: Inline add-page form */}
          {showAddPage && (
            <div style={styles.addPageRow}>
              <input
                style={styles.addPageInput}
                autoFocus
                placeholder="Page title..."
                value={newPageTitle}
                onChange={(e) => setNewPageTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddPageConfirm();
                  if (e.key === 'Escape') handleAddPageCancel();
                }}
              />
              <div style={styles.addPageBtns}>
                <button
                  style={styles.smallBtnPrimary}
                  onClick={handleAddPageConfirm}
                  disabled={addPageLoading || !newPageTitle.trim()}
                >
                  {addPageLoading ? '...' : 'Add'}
                </button>
                <button style={styles.smallBtn} onClick={handleAddPageCancel}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {pages.length === 0 ? (
            <p style={styles.emptyText}>No wiki pages yet</p>
          ) : (
            pages.map((page) => {
              const isActive = selectedPage?.id === page.id;
              // US-006c: Rename inline input for the active page
              if (isActive && renameMode) {
                return (
                  <div key={page.id} style={{ padding: '4px 8px' }}>
                    <input
                      style={styles.renameInput}
                      autoFocus
                      value={renameTitle}
                      onChange={(e) => setRenameTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameConfirm();
                        if (e.key === 'Escape') handleRenameCancel();
                      }}
                    />
                    <div style={styles.addPageBtns}>
                      <button
                        style={styles.smallBtnPrimary}
                        onClick={handleRenameConfirm}
                        disabled={!renameTitle.trim()}
                      >
                        Save
                      </button>
                      <button style={styles.smallBtn} onClick={handleRenameCancel}>
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <button
                  key={page.id}
                  style={{
                    ...styles.pageItem,
                    ...(isActive ? styles.pageItemActive : {}),
                  }}
                  onClick={() => {
                    setSelectedPage(page);
                    setEditMode(false);
                    setShowHistory(false);
                    setShowMoreMenu(false);
                    setRenameMode(false);
                  }}
                >
                  {page.isPinned && <span style={styles.pin}>📌</span>}
                  {page.title}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={styles.content}>
        {selectedPage ? (
          <>
            <div style={styles.contentHeader}>
              {/* Title: editable input in edit mode, plain heading otherwise */}
              {editMode ? (
                <input
                  style={styles.editTitleInput}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Page title"
                />
              ) : (
                <h1 style={styles.contentTitle}>{selectedPage.title}</h1>
              )}

              <div style={styles.contentActions}>
                {editMode ? (
                  <>
                    <button
                      style={styles.actionBtnPrimary}
                      onClick={handleSave}
                      disabled={saveLoading}
                    >
                      {saveLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button style={styles.actionBtn} onClick={handleCancelEdit}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      style={styles.actionBtn}
                      title="Edit"
                      onClick={handleEditClick}
                    >
                      Edit
                    </button>
                    <button
                      style={styles.actionBtn}
                      title="History"
                      onClick={handleHistoryClick}
                      disabled={historyLoading}
                    >
                      {historyLoading ? '...' : 'History'}
                    </button>
                    {/* US-006c: More dropdown */}
                    <div style={styles.moreMenuWrapper} ref={moreMenuRef}>
                      <button
                        style={styles.actionBtn}
                        title="More"
                        onClick={() => setShowMoreMenu((v) => !v)}
                      >
                        &bull;&bull;&bull;
                      </button>
                      {showMoreMenu && (
                        <div style={styles.moreDropdown}>
                          <button
                            style={styles.moreDropdownItem}
                            onClick={handleRenameClick}
                          >
                            Rename
                          </button>
                          <button
                            style={styles.moreDropdownItemDanger}
                            onClick={handleDeleteClick}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Content body */}
            {editMode ? (
              <textarea
                style={styles.editTextarea}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Write page content here..."
              />
            ) : (
              <div style={styles.contentBody}>{selectedPage.content}</div>
            )}

            {!editMode && (
              <div style={styles.contentFooter}>
                <span>
                  Last updated: {new Date(selectedPage.updatedAt).toLocaleDateString()}
                </span>
              </div>
            )}

            {/* US-006b: History panel */}
            {showHistory && (
              <div style={styles.historyPanel}>
                <div style={styles.historyHeader}>
                  <h3 style={styles.historyTitle}>Page History</h3>
                  <button
                    style={styles.historyCloseBtn}
                    onClick={() => {
                      setShowHistory(false);
                      setPreviewRevision(null);
                    }}
                  >
                    &times;
                  </button>
                </div>
                <div style={styles.historyList}>
                  {revisions.length === 0 ? (
                    <p style={{ color: '#6e6a80', fontSize: 13, padding: '16px', margin: 0 }}>
                      No revision history available.
                    </p>
                  ) : (
                    revisions.map((rev) => (
                      <div
                        key={rev.id}
                        style={{
                          ...styles.revisionItem,
                          ...(previewRevision?.id === rev.id
                            ? styles.revisionItemActive
                            : {}),
                        }}
                        onClick={() =>
                          setPreviewRevision(
                            previewRevision?.id === rev.id ? null : rev,
                          )
                        }
                      >
                        <span style={styles.revisionTitle}>{rev.title}</span>
                        <span style={styles.revisionDate}>
                          {new Date(rev.createdAt).toLocaleString()}
                        </span>
                        <div style={styles.revisionActions}>
                          <button
                            style={styles.smallBtnPrimary}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRevert(rev.id);
                            }}
                          >
                            Revert
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {previewRevision && (
                  <div style={styles.previewArea}>
                    <strong style={{ fontSize: 12, color: '#a8a4b8', display: 'block', marginBottom: 6 }}>
                      Preview
                    </strong>
                    {previewRevision.content || <em style={{ color: '#6e6a80' }}>No content</em>}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={styles.emptyState}>
            <h2 style={styles.emptyStateTitle}>Welcome to Wiki</h2>
            <p style={styles.emptyStateText}>Create your first wiki page to get started</p>
            <button
              style={styles.createBtn}
              onClick={() => setShowAddPage(true)}
            >
              Create Page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
