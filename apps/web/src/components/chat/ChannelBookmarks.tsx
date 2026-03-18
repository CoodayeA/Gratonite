import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Pencil,
  Trash2,
  GripVertical,
  Link,
  X,
} from 'lucide-react';
import { api } from '../../lib/api';

interface Bookmark {
  id: string;
  title: string;
  url: string;
  favicon: string | null;
  position: number;
}

interface ChannelBookmarksProps {
  channelId: string;
  canManage: boolean;
}

export function ChannelBookmarks({ channelId, canManage }: ChannelBookmarksProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchBookmarks = useCallback(async () => {
    try {
      const res = await api.channelBookmarks.list(channelId);
      setBookmarks((res ?? []).sort((a: Bookmark, b: Bookmark) => a.position - b.position));
    } catch {
      // Ignore
    }
  }, [channelId]);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const addBookmark = useCallback(async () => {
    const url = formUrl.trim();
    const title = formTitle.trim() || url;
    if (!url) return;

    try {
      await api.channelBookmarks.create(channelId, { title, url });
      setFormTitle('');
      setFormUrl('');
      setShowAdd(false);
      fetchBookmarks();
    } catch {
      // Ignore
    }
  }, [channelId, formTitle, formUrl, fetchBookmarks]);

  const updateBookmark = useCallback(async (id: string) => {
    const url = formUrl.trim();
    const title = formTitle.trim() || url;
    if (!url) return;

    try {
      await api.channelBookmarks.update(channelId, id, { title, url });
      setEditingId(null);
      setFormTitle('');
      setFormUrl('');
      fetchBookmarks();
    } catch {
      // Ignore
    }
  }, [channelId, formTitle, formUrl, fetchBookmarks]);

  const deleteBookmark = useCallback(async (id: string) => {
    try {
      await api.channelBookmarks.delete(channelId, id);
      setContextMenu(null);
      fetchBookmarks();
    } catch {
      // Ignore
    }
  }, [channelId, fetchBookmarks]);

  const startEdit = useCallback((bm: Bookmark) => {
    setEditingId(bm.id);
    setFormTitle(bm.title);
    setFormUrl(bm.url);
    setContextMenu(null);
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (!canManage) return;
      e.preventDefault();
      setContextMenu({ id, x: e.clientX, y: e.clientY });
    },
    [canManage],
  );

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  // Drag-and-drop reorder
  const handleDragStart = useCallback((id: string) => {
    setDraggedId(id);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (!draggedId || draggedId === targetId) return;
      setBookmarks(prev => {
        const next = [...prev];
        const dragIdx = next.findIndex(b => b.id === draggedId);
        const targetIdx = next.findIndex(b => b.id === targetId);
        if (dragIdx < 0 || targetIdx < 0) return prev;
        const [moved] = next.splice(dragIdx, 1);
        next.splice(targetIdx, 0, moved);
        return next;
      });
    },
    [draggedId],
  );

  const handleDragEnd = useCallback(async () => {
    if (!draggedId) return;
    setDraggedId(null);
    // Save new order
    try {
      const order = bookmarks.map((b, i) => ({ id: b.id, position: i }));
      await api.channelBookmarks.reorder(channelId, order);
    } catch {
      // Ignore
    }
  }, [draggedId, bookmarks, channelId]);

  const getFavicon = (url: string): string => {
    try {
      const u = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=16`;
    } catch {
      return '';
    }
  };

  if (bookmarks.length === 0 && !canManage) return null;

  return (
    <div
      style={{
        borderBottom: '1px solid var(--stroke)',
        background: 'var(--bg-secondary)',
      }}
    >
      {/* Toggle + bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 12px',
          minHeight: 32,
        }}
      >
        <button
          onClick={() => setCollapsed(v => !v)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: 2,
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>

        {!collapsed && (
          <>
            <div
              ref={scrollRef}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flex: 1,
                overflowX: 'auto',
                scrollbarWidth: 'none',
              }}
            >
              <AnimatePresence>
                {bookmarks.map(bm => (
                  <motion.div
                    key={bm.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    draggable={canManage}
                    onDragStart={() => handleDragStart(bm.id)}
                    onDragOver={e => handleDragOver(e, bm.id)}
                    onDragEnd={handleDragEnd}
                    onContextMenu={e => handleContextMenu(e, bm.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3px 10px',
                      borderRadius: 14,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--stroke)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      opacity: draggedId === bm.id ? 0.5 : 1,
                    }}
                    onClick={() => window.open(bm.url, '_blank', 'noopener')}
                  >
                    {canManage && (
                      <GripVertical
                        size={10}
                        style={{ color: 'var(--text-muted)', cursor: 'grab' }}
                      />
                    )}
                    <img
                      src={bm.favicon || getFavicon(bm.url)}
                      alt=""
                      width={14}
                      height={14}
                      style={{ borderRadius: 2 }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        maxWidth: 120,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {bm.title}
                    </span>
                    <ExternalLink size={10} style={{ color: 'var(--text-muted)' }} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {canManage && (
              <button
                onClick={() => {
                  setShowAdd(v => !v);
                  setEditingId(null);
                  setFormTitle('');
                  setFormUrl('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <Plus size={16} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Add / Edit form */}
      <AnimatePresence>
        {(showAdd || editingId) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px 8px',
              }}
            >
              <Link size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <input
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="Title"
                style={{
                  flex: '0 0 120px',
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--stroke)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <input
                value={formUrl}
                onChange={e => setFormUrl(e.target.value)}
                placeholder="https://..."
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    editingId ? updateBookmark(editingId) : addBookmark();
                  }
                }}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--stroke)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => (editingId ? updateBookmark(editingId) : addBookmark())}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {editingId ? 'Save' : 'Add'}
              </button>
              <button
                onClick={() => { setShowAdd(false); setEditingId(null); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--stroke)',
            borderRadius: 6,
            padding: 4,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 999,
            minWidth: 140,
          }}
        >
          <button
            onClick={() => startEdit(bookmarks.find(b => b.id === contextMenu.id)!)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '6px 10px',
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 13,
              cursor: 'pointer',
            }}
            className="hover-bg-secondary"
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            onClick={() => deleteBookmark(contextMenu.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '6px 10px',
              border: 'none',
              borderRadius: 4,
              background: 'transparent',
              color: '#ed4245',
              fontSize: 13,
              cursor: 'pointer',
            }}
            className="hover-bg-secondary"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
