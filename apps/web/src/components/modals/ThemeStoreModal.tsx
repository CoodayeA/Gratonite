/**
 * ThemeStoreModal — Community theme marketplace (Items 33-40).
 * Browse, search, rate, install, and share community themes.
 * Features: theme cards with rating/downloads, publishing, creator profiles,
 * update notifications, shareable links, and Theme of the Week.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, Download, Star, Upload, Share2, RefreshCw, Award, User, ExternalLink, Filter } from 'lucide-react';
import { useTheme } from '../ui/ThemeProvider';
import { useToast } from '../ui/ToastManager';
import { useUser } from '../../contexts/UserContext';
import { saveCustomTheme, getCustomThemes, deleteCustomTheme } from '../../themes/registry';
import type { ThemeDefinition, ThemeCategory } from '../../themes/types';
import { api } from '../../lib/api';
import { copyToClipboard } from '../../utils/clipboard';

interface ThemeStoreModalProps {
  onClose: () => void;
  /** Pre-select a theme by ID (for URL sharing, Item 37) */
  preSelectedThemeId?: string;
}

interface StoreTheme {
  id: string;
  name: string;
  description: string | null;
  creatorId: string;
  variables: Record<string, string>;
  tags: string[] | null;
  published: boolean;
  downloads: number;
  rating: string | number;
  reviewCount: number;
  previewImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: string;
    username: string;
    displayName: string | null;
  };
}

/** Check if a community theme is installed locally */
function isInstalled(storeThemeId: string): boolean {
  const customs = getCustomThemes();
  return customs.some(t => t.id === `store-${storeThemeId}` || (t as any)._storeId === storeThemeId);
}

/** Check if installed version is outdated compared to store version */
function isOutdated(storeTheme: StoreTheme): boolean {
  const customs = getCustomThemes();
  const local = customs.find(t => t.id === `store-${storeTheme.id}` || (t as any)._storeId === storeTheme.id);
  if (!local) return false;
  const localUpdated = (local as any)._storeUpdatedAt;
  if (!localUpdated) return false;
  return new Date(storeTheme.updatedAt).getTime() > new Date(localUpdated).getTime();
}

const INSTALLED_THEMES_META_KEY = 'gratonite_installed_theme_meta';

function getInstalledMeta(): Record<string, { storeId: string; installedAt: string; storeUpdatedAt: string }> {
  try {
    const raw = localStorage.getItem(INSTALLED_THEMES_META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setInstalledMeta(meta: Record<string, { storeId: string; installedAt: string; storeUpdatedAt: string }>) {
  localStorage.setItem(INSTALLED_THEMES_META_KEY, JSON.stringify(meta));
}

/** Render rating stars */
function RatingStars({ rating, size = 14, interactive = false, onRate }: {
  rating: number;
  size?: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
}) {
  const [hoverRating, setHoverRating] = useState(0);
  const displayRating = hoverRating || rating;

  return (
    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={size}
          fill={n <= displayRating ? '#FFC107' : 'none'}
          color={n <= displayRating ? '#FFC107' : 'var(--text-muted)'}
          style={{ cursor: interactive ? 'pointer' : 'default', transition: 'color 0.15s' }}
          onClick={interactive && onRate ? () => onRate(n) : undefined}
          onMouseEnter={interactive ? () => setHoverRating(n) : undefined}
          onMouseLeave={interactive ? () => setHoverRating(0) : undefined}
        />
      ))}
    </div>
  );
}

export default function ThemeStoreModal({ onClose, preSelectedThemeId }: ThemeStoreModalProps) {
  const { setTheme } = useTheme();
  const toast = useToast();
  const { user } = useUser();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const [themes, setThemes] = useState<StoreTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<StoreTheme | null>(null);
  const [ratingMap, setRatingMap] = useState<Record<string, number>>({}); // user's ratings
  const [sortBy, setSortBy] = useState<'downloads' | 'rating' | 'newest'>('downloads');

  // Fetch themes from API
  const fetchThemes = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await api.themes.browse({ q: searchQuery || undefined, tag: tagFilter || undefined }) as any;
      // API may return { items, nextCursor, hasMore } or plain array
      const data: StoreTheme[] = Array.isArray(raw) ? raw : (raw.items || []);
      setThemes(data);

      // If pre-selected, find and open it
      if (preSelectedThemeId && !selectedTheme) {
        const found = data.find(t => t.id === preSelectedThemeId);
        if (found) setSelectedTheme(found);
      }
    } catch (err) {
      toast.addToast({ title: 'Failed to load theme store', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, tagFilter, preSelectedThemeId]);

  useEffect(() => {
    fetchThemes();
  }, [fetchThemes]);

  // Sort themes
  const sortedThemes = [...themes].sort((a, b) => {
    switch (sortBy) {
      case 'downloads': return (b.downloads || 0) - (a.downloads || 0);
      case 'rating': return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      default: return 0;
    }
  });

  // Theme of the Week (Item 40): the highest-rated theme with at least 1 review
  const themeOfTheWeek = themes.find(t => t.reviewCount > 0 && Number(t.rating) >= 4);

  // Install theme (Item 36)
  const installTheme = useCallback(async (storeTheme: StoreTheme) => {
    const localId = `store-${storeTheme.id}`;

    // Build a ThemeDefinition from the store variables
    const vars = storeTheme.variables || {};
    const darkVars: Record<string, any> = {};
    const lightVars: Record<string, any> = {};

    for (const [key, val] of Object.entries(vars)) {
      if (key.startsWith('dark.')) {
        darkVars[key.replace('dark.', '')] = val;
      } else if (key.startsWith('light.')) {
        lightVars[key.replace('light.', '')] = val;
      } else {
        darkVars[key] = val;
        lightVars[key] = val;
      }
    }

    // Ensure colorScheme is set
    if (!darkVars.colorScheme) darkVars.colorScheme = 'dark';
    if (!lightVars.colorScheme) lightVars.colorScheme = 'light';

    const themeDef: ThemeDefinition & { _storeId: string; _storeUpdatedAt: string } = {
      id: localId,
      name: storeTheme.name,
      description: storeTheme.description || 'Community theme from the store',
      category: ((storeTheme.tags as string[]) || [])[0] as ThemeCategory || 'dark',
      author: storeTheme.creator?.displayName || storeTheme.creator?.username || 'Community',
      isDark: true,
      preview: {
        bg: darkVars.bgApp || '#111214',
        sidebar: darkVars.bgSidebar || '#1a1b1e',
        accent: darkVars.accentPrimary || '#5865f2',
        text: darkVars.textSecondary || '#b5bac1',
      },
      dark: darkVars as any,
      light: lightVars as any,
      _storeId: storeTheme.id,
      _storeUpdatedAt: storeTheme.updatedAt,
    };

    saveCustomTheme(themeDef as ThemeDefinition);

    // Track install metadata
    const meta = getInstalledMeta();
    meta[localId] = {
      storeId: storeTheme.id,
      installedAt: new Date().toISOString(),
      storeUpdatedAt: storeTheme.updatedAt,
    };
    setInstalledMeta(meta);

    // Increment download counter
    try {
      await api.themes.download(storeTheme.id);
    } catch {
      // Non-critical
    }

    setTheme(localId);
    toast.addToast({ title: `Installed "${storeTheme.name}"!`, variant: 'success' });
  }, [setTheme, toast]);

  // Rate theme (Item 35)
  const rateTheme = useCallback(async (themeId: string, rating: number) => {
    try {
      await api.themes.rate(themeId, rating);
      setRatingMap(prev => ({ ...prev, [themeId]: rating }));
      toast.addToast({ title: `Rated ${rating} stars!`, variant: 'success' });
      // Refresh to get updated average
      fetchThemes();
    } catch {
      toast.addToast({ title: 'Failed to submit rating', variant: 'error' });
    }
  }, [toast, fetchThemes]);

  // Share theme (Item 37)
  const shareTheme = useCallback((themeId: string) => {
    const url = `${window.location.origin}${window.location.pathname}?theme=${themeId}`;
    copyToClipboard(url).then(() => {
      toast.addToast({ title: 'Theme link copied to clipboard!', variant: 'success' });
    });
  }, [toast]);

  return (
    <div className="modal-backdrop" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" style={{
        background: 'var(--bg-primary)',
        borderRadius: '16px',
        width: '90vw',
        maxWidth: '960px',
        height: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--stroke)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--stroke)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Theme Store
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', padding: '6px', display: 'flex',
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Search + Sort bar */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid var(--stroke)',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search community themes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="auth-input"
              style={{ width: '100%', padding: '8px 12px 8px 36px', margin: 0, fontSize: '13px' }}
            />
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="auth-input"
            style={{ padding: '8px 12px', margin: 0, fontSize: '12px', width: 'auto' }}
          >
            <option value="downloads">Most Downloads</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '14px' }}>
              Loading themes...
            </div>
          ) : selectedTheme ? (
            /* Theme detail view */
            <div>
              <button
                onClick={() => setSelectedTheme(null)}
                style={{
                  background: 'none', border: 'none', color: 'var(--accent-primary)',
                  cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: 0, marginBottom: '16px',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}
              >
                Back to Store
              </button>

              <div style={{ display: 'flex', gap: '24px' }}>
                {/* Preview */}
                <div style={{
                  width: '300px', flexShrink: 0,
                  borderRadius: '12px', overflow: 'hidden',
                  border: '1px solid var(--stroke)',
                  background: 'var(--bg-elevated)',
                }}>
                  <ThemeMiniPreview vars={selectedTheme.variables} height={200} />
                </div>

                {/* Details */}
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                    {selectedTheme.name}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
                    {selectedTheme.description || 'No description'}
                  </p>

                  {/* Creator profile (Item 38) */}
                  {selectedTheme.creator && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '10px 12px', background: 'var(--bg-elevated)',
                      borderRadius: '8px', marginBottom: '16px',
                    }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: 'var(--accent-primary)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <User size={14} color="#fff" />
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {selectedTheme.creator.displayName || selectedTheme.creator.username}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          @{selectedTheme.creator.username}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Download size={14} color="var(--text-muted)" />
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {selectedTheme.downloads || 0} downloads
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Star size={14} color="#FFC107" fill={Number(selectedTheme.rating) > 0 ? '#FFC107' : 'none'} />
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {Number(selectedTheme.rating).toFixed(1)} ({selectedTheme.reviewCount} reviews)
                      </span>
                    </div>
                  </div>

                  {/* Tags */}
                  {selectedTheme.tags && (selectedTheme.tags as string[]).length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      {(selectedTheme.tags as string[]).map(tag => (
                        <span key={tag} style={{
                          padding: '3px 8px', borderRadius: '12px',
                          background: 'var(--bg-tertiary)', fontSize: '11px',
                          color: 'var(--text-muted)', textTransform: 'capitalize',
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Rating (Item 35) */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' }}>
                      Rate this theme
                    </div>
                    <RatingStars
                      rating={ratingMap[selectedTheme.id] || 0}
                      size={20}
                      interactive
                      onRate={(r) => rateTheme(selectedTheme.id, r)}
                    />
                  </div>

                  {/* Update notification (Item 39) */}
                  {isOutdated(selectedTheme) && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '10px 12px', background: 'rgba(254, 231, 92, 0.1)',
                      border: '1px solid rgba(254, 231, 92, 0.3)', borderRadius: '8px',
                      marginBottom: '16px',
                    }}>
                      <RefreshCw size={14} color="var(--warning)" />
                      <span style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 600 }}>Update Available</span>
                      <button
                        onClick={() => installTheme(selectedTheme)}
                        style={{
                          marginLeft: 'auto', padding: '4px 10px', borderRadius: '6px',
                          background: 'var(--warning)', color: '#000', border: 'none',
                          fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Update
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => installTheme(selectedTheme)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'var(--accent-primary)', color: '#fff',
                        border: 'none', borderRadius: '8px', padding: '10px 20px',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      <Download size={14} />
                      {isInstalled(selectedTheme.id) ? 'Reinstall' : 'Install'}
                    </button>
                    <button
                      onClick={() => shareTheme(selectedTheme.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                        border: '1px solid var(--stroke)', borderRadius: '8px', padding: '10px 16px',
                        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      <Share2 size={14} /> Share
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Theme grid */
            <div>
              {/* Theme of the Week (Item 40) */}
              {themeOfTheWeek && (
                <div style={{
                  marginBottom: '24px',
                  padding: '16px',
                  background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-tertiary))',
                  borderRadius: '12px',
                  border: '1px solid var(--accent-primary)',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', top: '8px', right: '8px',
                    background: 'var(--accent-primary)', padding: '4px 10px',
                    borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    <Award size={12} color="#fff" />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}>Theme of the Week</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{
                      width: '180px', height: '100px', borderRadius: '8px',
                      overflow: 'hidden', flexShrink: 0, border: '1px solid var(--stroke)',
                    }}>
                      <ThemeMiniPreview vars={themeOfTheWeek.variables} height={100} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                        {themeOfTheWeek.name}
                      </h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
                        {themeOfTheWeek.description || 'Featured community theme'}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <RatingStars rating={Number(themeOfTheWeek.rating)} size={12} />
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {themeOfTheWeek.downloads} downloads
                        </span>
                        <button
                          onClick={() => setSelectedTheme(themeOfTheWeek)}
                          style={{
                            padding: '4px 12px', borderRadius: '6px',
                            background: 'var(--accent-primary)', color: '#fff',
                            border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                          }}
                        >
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Grid */}
              {sortedThemes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '14px' }}>
                  {searchQuery ? `No themes found for "${searchQuery}"` : 'No community themes yet. Be the first to publish!'}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                  {sortedThemes.map(t => {
                    const installed = isInstalled(t.id);
                    const outdated = isOutdated(t);
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTheme(t)}
                        style={{
                          background: 'var(--bg-elevated)',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          border: '1px solid var(--stroke)',
                          cursor: 'pointer',
                          transition: 'transform 0.15s, box-shadow 0.15s',
                          position: 'relative',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLDivElement).style.transform = 'none';
                          (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                        }}
                      >
                        {/* Preview */}
                        <ThemeMiniPreview vars={t.variables} height={90} />

                        {/* Badges */}
                        {installed && (
                          <div style={{
                            position: 'absolute', top: '6px', left: '6px',
                            background: 'var(--success)', padding: '2px 6px',
                            borderRadius: '4px', fontSize: '9px', fontWeight: 700, color: '#000',
                          }}>
                            Installed
                          </div>
                        )}
                        {outdated && (
                          <div style={{
                            position: 'absolute', top: '6px', right: '6px',
                            background: 'var(--warning)', padding: '2px 6px',
                            borderRadius: '4px', fontSize: '9px', fontWeight: 700, color: '#000',
                          }}>
                            Update
                          </div>
                        )}

                        {/* Info */}
                        <div style={{ padding: '10px 12px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.name}
                          </div>

                          {/* Creator (Item 38) */}
                          {t.creator && (
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <User size={10} />
                              {t.creator.displayName || t.creator.username}
                            </div>
                          )}

                          {/* Stats */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <RatingStars rating={Math.round(Number(t.rating))} size={10} />
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                ({t.reviewCount})
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Download size={10} color="var(--text-muted)" />
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t.downloads}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Mini preview showing a simplified app layout using theme variables */
function ThemeMiniPreview({ vars, height = 90 }: { vars: Record<string, string>; height?: number }) {
  const darkVars: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) {
    const key = k.startsWith('dark.') ? k.replace('dark.', '') : k;
    if (!key.startsWith('light.')) darkVars[key] = v;
  }

  const bg = darkVars.bgApp || '#111214';
  const sidebar = darkVars.bgSidebar || '#1a1b1e';
  const accent = darkVars.accentPrimary || '#5865f2';
  const text = darkVars.textSecondary || '#b5bac1';
  const channel = darkVars.bgChannel || '#17181b';

  return (
    <div style={{
      height, background: bg, display: 'flex', gap: '2px', padding: '4px',
      overflow: 'hidden',
    }}>
      <div style={{ width: '16px', background: sidebar, borderRadius: '3px', flexShrink: 0 }} />
      <div style={{ width: '40px', background: sidebar, borderRadius: '3px', flexShrink: 0, opacity: 0.8, display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px' }}>
        <div style={{ height: '4px', width: '80%', background: text, borderRadius: '2px', opacity: 0.4 }} />
        <div style={{ height: '4px', width: '60%', background: accent, borderRadius: '2px', opacity: 0.6 }} />
        <div style={{ height: '4px', width: '70%', background: text, borderRadius: '2px', opacity: 0.3 }} />
      </div>
      <div style={{ flex: 1, background: channel, borderRadius: '3px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '4px', gap: '3px' }}>
        <div style={{ height: '4px', width: '60%', background: text, borderRadius: '2px', opacity: 0.5 }} />
        <div style={{ height: '4px', width: '40%', background: text, borderRadius: '2px', opacity: 0.3 }} />
        <div style={{ height: '6px', background: sidebar, borderRadius: '3px', marginTop: '2px' }} />
      </div>
    </div>
  );
}
