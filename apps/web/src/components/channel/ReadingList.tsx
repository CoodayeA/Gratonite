import { useState, useEffect, useCallback, useMemo } from 'react';
import { BookOpen, Search, ThumbsUp, Check, Plus, X, ExternalLink, ArrowUpDown, Tag, Clock, TrendingUp, Loader } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';

interface ReadingListProps {
  channelId: string;
  guildId: string;
}

interface ReadingItem {
  id: string;
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  domain: string;
  tags: string[];
  upvotes: number;
  hasUpvoted: boolean;
  isRead: boolean;
  addedBy: { id: string; username: string; avatarHash: string | null };
  addedAt: string;
}

type SortMode = 'top' | 'recent';

const TAG_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4'];

function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function ReadingList({ channelId, guildId }: ReadingListProps) {
  const [items, setItems] = useState<ReadingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('top');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.getReadingList?.(channelId);
        if (!cancelled) setItems(Array.isArray(res) ? res : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [channelId]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    items.forEach((item) => item.tags.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) =>
        item.title.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (selectedTag) {
      result = result.filter((item) => item.tags.includes(selectedTag));
    }
    result = [...result].sort((a, b) => {
      if (sortMode === 'top') return b.upvotes - a.upvotes;
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });
    return result;
  }, [items, searchQuery, selectedTag, sortMode]);

  const handleAddLink = useCallback(async () => {
    if (!newUrl.trim()) return;
    setAdding(true);
    try {
      const res = await api.addToReadingList?.(channelId, { url: newUrl.trim() });
      if (res) setItems((prev) => [res, ...prev]);
      setNewUrl('');
      setShowAddForm(false);
    } catch { /* ignore */ }
    setAdding(false);
  }, [channelId, newUrl]);

  const handleUpvote = useCallback(async (itemId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, hasUpvoted: !item.hasUpvoted, upvotes: item.upvotes + (item.hasUpvoted ? -1 : 1) }
          : item
      )
    );
    try {
      await api.toggleReadingListUpvote?.(channelId, itemId);
    } catch { /* revert on error could be added */ }
  }, [channelId]);

  const handleMarkRead = useCallback(async (itemId: string) => {
    setItems((prev) =>
      prev.map((item) => item.id === itemId ? { ...item, isRead: !item.isRead } : item)
    );
    try {
      await api.toggleReadingListRead?.(channelId, itemId);
    } catch { /* ignore */ }
  }, [channelId]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-primary)',
      borderLeft: '1px solid var(--stroke)',
      width: '360px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--stroke)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={16} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Reading List</span>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              background: 'var(--bg-secondary)',
              color: 'var(--text-muted)',
              borderRadius: '10px',
              padding: '1px 7px',
            }}>
              {filtered.length}
            </span>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 26,
              height: 26,
              borderRadius: '6px',
              border: 'none',
              background: showAddForm ? 'var(--accent-primary)' : 'var(--bg-secondary)',
              color: showAddForm ? '#fff' : 'var(--text-muted)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {showAddForm ? <X size={14} /> : <Plus size={14} />}
          </button>
        </div>

        {/* Add Link Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              style={{ overflow: 'hidden', marginBottom: '8px' }}
            >
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                  placeholder="Paste a URL..."
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--stroke)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleAddLink}
                  disabled={adding || !newUrl.trim()}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--accent-primary)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: adding ? 'not-allowed' : 'pointer',
                    opacity: adding || !newUrl.trim() ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {adding ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={12} />}
                  Add
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search + Sort */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flex: 1,
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            padding: '5px 10px',
          }}>
            <Search size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search links..."
              style={{
                border: 'none',
                background: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '12px',
                width: '100%',
              }}
            />
          </div>
          <button
            onClick={() => setSortMode(sortMode === 'top' ? 'recent' : 'top')}
            title={sortMode === 'top' ? 'Sort by recent' : 'Sort by top'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--bg-secondary)',
              color: 'var(--text-muted)',
              fontSize: '11px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {sortMode === 'top' ? <TrendingUp size={12} /> : <Clock size={12} />}
            {sortMode === 'top' ? 'Top' : 'Recent'}
          </button>
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  border: '1px solid var(--stroke)',
                  background: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
            {allTags.slice(0, 8).map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  border: 'none',
                  background: selectedTag === tag ? getTagColor(tag) : 'var(--bg-secondary)',
                  color: selectedTag === tag ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'all 0.15s',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Items */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ width: 20, height: 20, border: '2px solid var(--stroke)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', gap: '8px' }}>
            <BookOpen size={32} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center' }}>
              {searchQuery || selectedTag ? 'No links match your filter' : 'No links shared yet. Add one!'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <AnimatePresence mode="popLayout">
              {filtered.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--stroke)',
                    borderRadius: '10px',
                    padding: '10px',
                    opacity: item.isRead ? 0.6 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {/* Preview image */}
                  {item.imageUrl && (
                    <div style={{
                      width: '100%',
                      height: '100px',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      marginBottom: '8px',
                      background: 'var(--bg-primary)',
                    }}>
                      <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}

                  {/* Title + link */}
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '6px',
                      textDecoration: 'none',
                      marginBottom: '4px',
                    }}
                  >
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: '1.3',
                      flex: 1,
                    }}>
                      {item.title}
                    </span>
                    <ExternalLink size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
                  </a>

                  <div style={{ fontSize: '10px', color: 'var(--accent-primary)', marginBottom: '4px' }}>
                    {item.domain}
                  </div>

                  {item.description && (
                    <p style={{
                      margin: '0 0 6px',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: '1.4',
                    }}>
                      {item.description}
                    </p>
                  )}

                  {/* Tags */}
                  {item.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {item.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '9px',
                            padding: '1px 6px',
                            borderRadius: '8px',
                            background: getTagColor(tag),
                            color: '#fff',
                            fontWeight: 500,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => handleUpvote(item.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          border: 'none',
                          background: item.hasUpvoted ? 'rgba(99,102,241,0.15)' : 'var(--bg-primary)',
                          color: item.hasUpvoted ? 'var(--accent-primary)' : 'var(--text-muted)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <ThumbsUp size={11} fill={item.hasUpvoted ? 'currentColor' : 'none'} />
                        {item.upvotes}
                      </button>

                      <button
                        onClick={() => handleMarkRead(item.id)}
                        title={item.isRead ? 'Mark as unread' : 'Mark as read'}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          border: 'none',
                          background: item.isRead ? 'rgba(16,185,129,0.15)' : 'var(--bg-primary)',
                          color: item.isRead ? '#10b981' : 'var(--text-muted)',
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        <Check size={11} />
                        {item.isRead ? 'Read' : 'Mark read'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: 'var(--bg-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '8px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        overflow: 'hidden',
                      }}>
                        {item.addedBy.avatarHash ? (
                          <img src={`/avatars/${item.addedBy.id}/${item.addedBy.avatarHash}.webp`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          item.addedBy.username[0]?.toUpperCase()
                        )}
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {timeAgo(item.addedAt)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
