import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import {
  type Theme,
  BUILT_IN_THEMES,
  applyTheme,
  getCurrentThemeId,
} from '@/lib/themes';

// ─── Discover portals type ──────────────────────────────────────────────────

type DiscoverGuild = {
  id: string;
  name: string;
  description: string | null;
  iconHash: string | null;
  bannerHash: string | null;
  memberCount: number;
  tags: string[];
  categories: string[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CDN_BASE = (import.meta.env['VITE_CDN_URL'] as string | undefined) ?? '';

function guildIconUrl(guildId: string, iconHash: string) {
  return `${CDN_BASE}/server-icons/${guildId}/${iconHash}`;
}

function guildBannerUrl(guildId: string, bannerHash: string) {
  return `${CDN_BASE}/banners/${guildId}/${bannerHash}`;
}

function formatMemberCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ─── Mini theme preview component ────────────────────────────────────────────

function ThemePreview({ theme }: { theme: Theme }) {
  const v = theme.vars;
  return (
    <div style={{
      width: '100%',
      height: 120,
      borderRadius: '8px 8px 0 0',
      overflow: 'hidden',
      display: 'flex',
      flexShrink: 0,
      border: `1px solid ${v['--stroke']}`,
      borderBottom: 'none',
    }}>
      {/* Mini sidebar */}
      <div style={{
        width: 40,
        background: v['--bg-float'],
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 6,
        gap: 4,
        borderRight: `1px solid ${v['--stroke']}`,
      }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 24,
            height: 24,
            borderRadius: i === 0 ? 8 : 12,
            background: i === 0 ? v['--accent'] : v['--bg-soft'],
          }} />
        ))}
      </div>
      {/* Channel sidebar */}
      <div style={{
        width: 56,
        background: v['--bg-elevated'],
        padding: '6px 4px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        borderRight: `1px solid ${v['--stroke']}`,
      }}>
        <div style={{ height: 8, width: 36, borderRadius: 4, background: v['--text-faint'], opacity: 0.6 }} />
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            height: 6,
            width: i === 0 ? 44 : i === 1 ? 36 : i === 2 ? 48 : 32,
            borderRadius: 3,
            background: i === 0 ? v['--accent'] + '40' : v['--bg-soft'],
          }} />
        ))}
      </div>
      {/* Main chat area */}
      <div style={{
        flex: 1,
        background: v['--bg'],
        padding: 6,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        {[32, 24, 40, 20].map((w, i) => (
          <div key={i} style={{
            display: 'flex',
            gap: 4,
            alignItems: 'center',
          }}>
            {i % 2 === 0 && <div style={{ width: 12, height: 12, borderRadius: 6, background: v['--bg-soft'], flexShrink: 0 }} />}
            <div style={{ height: 6, width: `${w}%`, borderRadius: 3, background: i === 0 ? v['--text'] + '60' : v['--text-faint'] + '50' }} />
          </div>
        ))}
        {/* Accent button */}
        <div style={{ marginTop: 'auto', display: 'flex', gap: 4 }}>
          <div style={{ flex: 1, height: 12, borderRadius: 6, background: v['--bg-elevated'], border: `1px solid ${v['--stroke']}` }} />
          <div style={{ width: 20, height: 12, borderRadius: 4, background: v['--accent'] }} />
        </div>
      </div>
    </div>
  );
}

// ─── Portal card (Issue 1: moved to module scope) ─────────────────────────────

function PortalCard({ guild }: { guild: DiscoverGuild }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderRadius: 12, overflow: 'hidden',
      background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
      cursor: 'pointer', transition: 'border-color 140ms',
    }}>
      {/* Banner */}
      <div style={{ position: 'relative', height: 100, background: 'linear-gradient(135deg, #353348 0%, #25243a 100%)' }}>
        {guild.bannerHash && !imgErr && (
          <img
            src={guildBannerUrl(guild.id, guild.bannerHash)}
            alt=""
            onError={() => setImgErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        {/* Guild icon */}
        <div style={{
          position: 'absolute', bottom: -20, left: 16,
          width: 40, height: 40, borderRadius: 10,
          background: 'var(--bg-soft)',
          border: '3px solid var(--bg-elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, overflow: 'hidden',
        }}>
          {guild.iconHash
            ? <img src={guildIconUrl(guild.id, guild.iconHash)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : guild.name.charAt(0).toUpperCase()
          }
        </div>
      </div>
      {/* Body */}
      <div style={{ padding: '28px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{guild.name}</span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--accent)',
            background: 'rgba(212,175,55,0.15)', padding: '2px 8px', borderRadius: 100, whiteSpace: 'nowrap',
          }}>
            {formatMemberCount(guild.memberCount)} members
          </span>
        </div>
        {guild.description && (
          <span style={{ fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
            {guild.description}
          </span>
        )}
        {guild.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {guild.tags.slice(0, 3).map(t => (
              <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: 'var(--bg-soft)', color: 'var(--text-faint)' }}>
                #{t}
              </span>
            ))}
          </div>
        )}
        {/* Issue 5: Join button disabled until join flow is implemented */}
        <button
          type="button"
          disabled
          style={{
            marginTop: 'auto', height: 34, borderRadius: 8,
            background: 'var(--bg-soft)', color: 'var(--text-faint)',
            fontSize: 13, fontWeight: 600, border: '1px solid var(--stroke)',
            cursor: 'not-allowed', opacity: 0.6,
          }}
        >
          Join (coming soon)
        </button>
      </div>
    </div>
  );
}

// ─── Theme card (Issue 1: moved to module scope) ──────────────────────────────

type ThemeCardProps = {
  theme: Theme;
  appliedId: string | null;
  onApply: (theme: Theme) => void;
};

function ThemeCard({ theme, appliedId, onApply }: ThemeCardProps) {
  const isApplied = appliedId === theme.id;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderRadius: 12, overflow: 'hidden',
      background: 'var(--bg-elevated)',
      border: `1px solid ${isApplied ? 'var(--accent)' : 'var(--stroke)'}`,
      boxShadow: isApplied ? '0 0 0 2px rgba(212,175,55,0.25)' : 'none',
      transition: 'border-color 140ms',
    }}>
      <ThemePreview theme={theme} />
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{theme.name}</span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>v{theme.version}</span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{theme.description}</span>
        {/* Color swatches */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[theme.vars['--bg'], theme.vars['--bg-elevated'], theme.vars['--accent'], theme.vars['--text']].map((c, i) => (
            <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: c, border: '1px solid rgba(255,255,255,0.15)' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {theme.tags.map(t => (
            <span key={t} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 100, background: 'var(--bg-soft)', color: 'var(--text-faint)' }}>#{t}</span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onApply(theme)}
          style={{
            height: 32, borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
            background: isApplied ? 'rgba(212,175,55,0.2)' : 'var(--accent)',
            color: isApplied ? 'var(--accent)' : '#1a1a2e',
            transition: 'all 140ms',
          }}
        >
          {isApplied ? '✓ Applied' : 'Apply Theme'}
        </button>
      </div>
    </div>
  );
}

// ─── Empty state (Issue 1: moved to module scope) ─────────────────────────────

type EmptyStateProps = {
  icon: string;
  title: string;
  sub: string;
  onReset?: () => void;
};

function EmptyState({ icon, title, sub, onReset }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: '64px 32px', borderRadius: 14, border: '1px solid var(--stroke)',
      color: 'var(--text-muted)', textAlign: 'center',
    }}>
      <span style={{ fontSize: 40 }}>{icon}</span>
      <strong style={{ fontSize: 16, color: 'var(--text)' }}>{title}</strong>
      <span style={{ fontSize: 13 }}>{sub}</span>
      {onReset && (
        <button type="button" onClick={onReset}
          style={{ marginTop: 4, border: '1px solid var(--stroke)', background: 'rgba(255,255,255,0.04)', color: 'var(--text)', borderRadius: 999, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Reset filters
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'portals' | 'bots' | 'themes' | null) ?? 'portals';
  const [tab, setTab] = useState<'portals' | 'bots' | 'themes'>(
    ['portals', 'bots', 'themes'].includes(initialTab) ? initialTab : 'portals',
  );
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [activeTag, setActiveTag] = useState<string>(searchParams.get('tag') ?? 'all');
  const [portals, setPortals] = useState<DiscoverGuild[]>([]);
  const [portalsLoading, setPortalsLoading] = useState(true);
  const [appliedId, setAppliedId] = useState<string | null>(getCurrentThemeId);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sync URL params
  useEffect(() => {
    const next = new URLSearchParams();
    next.set('tab', tab);
    if (query.trim()) next.set('q', query.trim());
    if (activeTag !== 'all') next.set('tag', activeTag);
    setSearchParams(next, { replace: true });
  }, [tab, query, activeTag, setSearchParams]);

  // Fetch discoverable portals
  useEffect(() => {
    setPortalsLoading(true);
    api.guilds.discover()
      .then(setPortals)
      .catch(() => setPortals([]))
      .finally(() => setPortalsLoading(false));
  }, []);

  // Compute tags from portals
  const portalTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of portals) {
      for (const t of [...g.tags, ...g.categories]) {
        if (t) counts.set(t.toLowerCase(), (counts.get(t.toLowerCase()) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t)
      .slice(0, 8);
  }, [portals]);

  const themeAllTags = useMemo(() => {
    const set = new Set<string>();
    for (const t of BUILT_IN_THEMES) for (const tag of t.tags) set.add(tag);
    return Array.from(set);
  }, []);

  const activeTags = tab === 'portals' ? portalTags : tab === 'themes' ? themeAllTags : ['moderation', 'music', 'fun', 'productivity'];

  // Issue 2: Filter portals with case-insensitive tag comparison
  const filteredPortals = useMemo(() => {
    const q = query.trim().toLowerCase();
    return portals.filter(g => {
      const matchQ = !q || g.name.toLowerCase().includes(q) || (g.description ?? '').toLowerCase().includes(q);
      const matchTag = activeTag === 'all' ||
        g.tags.some(t => t.toLowerCase() === activeTag) ||
        g.categories.some(c => c.toLowerCase() === activeTag);
      return matchQ && matchTag;
    });
  }, [portals, query, activeTag]);

  // Filter themes
  const filteredThemes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BUILT_IN_THEMES.filter(t => {
      const matchQ = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
      const matchTag = activeTag === 'all' || t.tags.includes(activeTag);
      return matchQ && matchTag;
    });
  }, [query, activeTag]);

  function handleApplyTheme(theme: Theme) {
    applyTheme(theme);
    setAppliedId(theme.id);
  }

  function switchTab(newTab: 'portals' | 'bots' | 'themes') {
    setTab(newTab);
    setActiveTag('all');
    setQuery('');
  }

  function handleResetFilters() {
    setQuery('');
    setActiveTag('all');
  }

  // ─── Tab content labels ───────────────────────────────────────────────────
  const headings: Record<string, { title: string; subtitle: string; placeholder: string }> = {
    portals: { title: 'Discover Portals', subtitle: 'Find communities to join and explore.', placeholder: 'Search portals...' },
    bots: { title: 'Discover Bots', subtitle: 'Add powerful bots to your portals.', placeholder: 'Search bots...' },
    themes: { title: 'Discover Themes', subtitle: 'Personalize your Gratonite experience.', placeholder: 'Search themes...' },
  };
  const heading = headings[tab]!;

  // ─── Styles ───────────────────────────────────────────────────────────────
  const s = {
    page: { display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' } as React.CSSProperties,
    sidebar: {
      width: 232, minWidth: 232, background: 'var(--bg-float)',
      display: 'flex', flexDirection: 'column' as const, padding: '20px 12px',
      borderRight: '1px solid var(--stroke)', overflowY: 'auto' as const, gap: 2,
    } as React.CSSProperties,
    sidebarTitle: { margin: '0 0 16px 8px', fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: 0.2 } as React.CSSProperties,
    navItem: (active: boolean): React.CSSProperties => ({
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
      borderRadius: 8, fontSize: 14, fontWeight: active ? 600 : 400,
      color: active ? 'var(--accent)' : 'var(--text-muted)',
      background: active ? 'rgba(212,175,55,0.1)' : 'transparent',
      border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' as const,
      transition: 'background 140ms, color 140ms',
    }),
    main: {
      flex: 1, minWidth: 0, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column' as const,
      overflowY: 'auto' as const,
    } as React.CSSProperties,
    mainInner: {
      maxWidth: 1100, width: '100%', margin: '0 auto',
      padding: '40px 40px 60px', display: 'flex', flexDirection: 'column' as const, gap: 28,
    } as React.CSSProperties,
    hero: { display: 'flex', flexDirection: 'column' as const, gap: 8, alignItems: 'center', textAlign: 'center' as const } as React.CSSProperties,
    heroTitle: { margin: 0, fontSize: 32, fontWeight: 700, color: 'var(--text)' } as React.CSSProperties,
    heroSub: { margin: 0, fontSize: 15, color: 'var(--text-muted)' } as React.CSSProperties,
    searchWrap: {
      display: 'flex', alignItems: 'center', gap: 10,
      width: '100%', maxWidth: 560, height: 48, padding: '0 18px',
      borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
      fontSize: 14, color: 'var(--text-faint)',
    } as React.CSSProperties,
    searchInput: {
      flex: 1, border: 'none', background: 'transparent',
      color: 'var(--text)', fontSize: 14, outline: 'none',
    } as React.CSSProperties,
    tagsRow: { display: 'flex', gap: 8, flexWrap: 'wrap' as const, justifyContent: 'center' } as React.CSSProperties,
    tagPill: (active: boolean): React.CSSProperties => ({
      padding: '6px 16px', borderRadius: 100, fontSize: 13, fontWeight: active ? 600 : 400,
      background: active ? 'var(--accent)' : 'var(--bg-elevated)',
      color: active ? '#1a1a2e' : 'var(--text-muted)',
      border: active ? 'none' : '1px solid var(--stroke)',
      cursor: 'pointer', transition: 'all 140ms',
    }),
    sectionLabel: { margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' } as React.CSSProperties,
    grid4: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: 20, width: '100%',
    } as React.CSSProperties,
    grid3: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 20, width: '100%',
    } as React.CSSProperties,
  };

  // ─── Sidebar nav items ────────────────────────────────────────────────────
  const navItems = [
    { id: 'portals' as const, label: 'Portals', icon: '⚡' },
    { id: 'bots' as const, label: 'Bots', icon: '⚙️' },
    { id: 'themes' as const, label: 'Themes', icon: '🎨' },
  ];

  const hasActiveFilters = !!(query || activeTag !== 'all');

  return (
    <div style={s.page}>
      {/* Sidebar */}
      <div style={s.sidebar}>
        <h2 style={s.sidebarTitle}>Discover</h2>
        {navItems.map(item => (
          <button key={item.id} type="button" style={s.navItem(tab === item.id)} onClick={() => switchTab(item.id)}>
            <span style={{ fontSize: 15, width: 20, textAlign: 'center' }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Main */}
      <div style={s.main}>
        <div style={s.mainInner}>
          {/* Hero */}
          <div style={s.hero}>
            <h1 style={s.heroTitle}>{heading.title}</h1>
            <p style={s.heroSub}>{heading.subtitle}</p>
            <div style={s.searchWrap}>
              <span style={{ fontSize: 15 }}>🔍</span>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={heading.placeholder}
                style={s.searchInput}
              />
              {query && (
                <button type="button" onClick={() => setQuery('')}
                  style={{ border: 'none', background: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Tags */}
          {activeTags.length > 0 && (
            <div style={s.tagsRow}>
              <button type="button" style={s.tagPill(activeTag === 'all')} onClick={() => setActiveTag('all')}>All</button>
              {activeTags.map(t => (
                <button key={t} type="button" style={s.tagPill(activeTag === t)} onClick={() => setActiveTag(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          )}

          {/* Portals tab */}
          {tab === 'portals' && (
            <>
              <h2 style={s.sectionLabel}>
                {portalsLoading ? 'Loading portals...' : `${filteredPortals.length} ${filteredPortals.length === 1 ? 'Portal' : 'Portals'}`}
              </h2>
              {portalsLoading ? (
                <div style={{ ...s.grid4 }}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} style={{ height: 220, borderRadius: 12, background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', opacity: 0.5 }} />
                  ))}
                </div>
              ) : filteredPortals.length === 0 ? (
                <EmptyState
                  icon="⚡"
                  title="No portals found"
                  sub={portals.length === 0 ? 'No discoverable portals yet. Enable discovery in your portal settings.' : 'Try a different search or tag.'}
                  onReset={hasActiveFilters ? handleResetFilters : undefined}
                />
              ) : (
                <div style={s.grid4}>
                  {filteredPortals.map(g => <PortalCard key={g.id} guild={g} />)}
                </div>
              )}
            </>
          )}

          {/* Bots tab */}
          {tab === 'bots' && (
            <EmptyState icon="⚙️" title="Bots coming soon" sub="We're building the bot marketplace. Check back soon!" />
          )}

          {/* Themes tab */}
          {tab === 'themes' && (
            <>
              <h2 style={s.sectionLabel}>{filteredThemes.length} {filteredThemes.length === 1 ? 'Theme' : 'Themes'}</h2>
              {filteredThemes.length === 0 ? (
                <EmptyState
                  icon="🎨"
                  title="No themes found"
                  sub="Try a different search or tag."
                  onReset={hasActiveFilters ? handleResetFilters : undefined}
                />
              ) : (
                <div style={s.grid3}>
                  {filteredThemes.map(t => (
                    <ThemeCard key={t.id} theme={t} appliedId={appliedId} onApply={handleApplyTheme} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
