import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import {
  type Theme,
  BUILT_IN_THEMES,
  applyTheme,
  getCurrentThemeId,
} from '@/lib/themes';
import { ThemeCard } from '@/components/ui/ThemeCard';
import { SearchInput } from '@/components/ui/SearchInput';

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

// ─── Portal card (Issue 1: moved to module scope) ─────────────────────────────

function PortalCard({ guild }: { guild: DiscoverGuild }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden',
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
            background: 'rgba(212,175,55,0.15)', padding: '2px 8px', borderRadius: 'var(--radius-pill)', whiteSpace: 'nowrap',
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
              <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--bg-soft)', color: 'var(--text-faint)' }}>
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
            marginTop: 'auto', height: 34, borderRadius: 'var(--radius-md)',
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
      gap: 12, padding: '64px 32px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)',
      color: 'var(--text-muted)', textAlign: 'center',
    }}>
      <span style={{ fontSize: 40 }}>{icon}</span>
      <strong style={{ fontSize: 16, color: 'var(--text)' }}>{title}</strong>
      <span style={{ fontSize: 13 }}>{sub}</span>
      {onReset && (
        <button type="button" onClick={onReset}
          style={{ marginTop: 4, border: '1px solid var(--stroke)', background: 'rgba(255,255,255,0.04)', color: 'var(--text)', borderRadius: 'var(--radius-pill)', padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
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
      borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: active ? 600 : 400,
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

    tagsRow: { display: 'flex', gap: 8, flexWrap: 'wrap' as const, justifyContent: 'center' } as React.CSSProperties,
    tagPill: (active: boolean): React.CSSProperties => ({
      padding: '6px 16px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: active ? 600 : 400,
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
            <SearchInput
              ref={searchRef}
              size="large"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={heading.placeholder}
              onClear={() => setQuery('')}
              style={{ maxWidth: 560 }}
            />
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
                    <div key={i} style={{ height: 220, borderRadius: 'var(--radius-lg)', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', opacity: 0.5 }} />
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <h2 style={s.sectionLabel}>
                  {filteredThemes.length} {filteredThemes.length === 1 ? 'Theme' : 'Themes'}
                </h2>
                <Link
                  to="/themes/create"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--accent)',
                    color: '#1a1a2e',
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: 'none',
                    flexShrink: 0,
                  }}
                >
                  + Create Theme
                </Link>
              </div>
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
