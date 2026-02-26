import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGuildsStore } from '@/stores/guilds.store';

type Category = 'featured' | 'portals' | 'bots' | 'themes' | 'gaming' | 'music';

const categories: { id: Category; label: string; icon: string }[] = [
  { id: 'featured', label: 'Featured', icon: '\u2605' },
  { id: 'portals', label: 'Portals', icon: '\u26A1' },
  { id: 'bots', label: 'Bots', icon: '\u2699' },
  { id: 'themes', label: 'Themes', icon: '\u{1F3A8}' },
  { id: 'gaming', label: 'Gaming', icon: '\u{1F3AE}' },
  { id: 'music', label: 'Music', icon: '\u266B' },
];

const portalCardData = [
  {
    id: 'celestial',
    name: 'Celestial Lounge',
    desc: 'Premium gaming & music community',
    members: '2.4k',
    badge: 'Featured',
    gradient: 'linear-gradient(180deg, #5a4a7a 0%, #3e3a5a 100%)',
  },
  {
    id: 'neon',
    name: 'Neon Arcade',
    desc: 'Retro gaming with modern vibes',
    members: '1.8k',
    badge: null,
    gradient: 'linear-gradient(180deg, #4a3a6a 0%, #2a2a4a 100%)',
  },
  {
    id: 'velvet',
    name: 'Velvet Studios',
    desc: 'Art & design creative collective',
    members: '3.1k',
    badge: 'Featured',
    gradient: 'linear-gradient(180deg, #3a4a6a 0%, #2a3a5a 100%)',
  },
];

export function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'portals' | 'bots' | 'themes' | null) ?? 'portals';
  const initialSort = (searchParams.get('sort') as 'trending' | 'new' | 'name' | null) ?? 'trending';
  const [tab, setTab] = useState<'portals' | 'bots' | 'themes'>(
    ['portals', 'bots', 'themes'].includes(initialTab) ? initialTab : 'portals',
  );
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [tag, setTag] = useState<string>(searchParams.get('tag') ?? 'all');
  const [sortBy, setSortBy] = useState<'trending' | 'new' | 'name'>(
    ['trending', 'new', 'name'].includes(initialSort) ? initialSort : 'trending',
  );
  const [activeCategory, setActiveCategory] = useState<Category>('featured');

  const botCards = useMemo(
    () => [
      { id: 'music', name: 'MusicBot Pro', desc: 'High-quality music streaming', tags: ['audio', 'voice'], iconColor: '#d4af37', iconBg: '#5a4a7a' },
      { id: 'mod', name: 'GuardianBot', desc: 'Advanced moderation suite', tags: ['safety', 'moderation'], iconColor: '#a8a4b8', iconBg: '#3e3a5a' },
      { id: 'ops', name: 'GameStats', desc: 'Track gaming achievements', tags: ['ops', 'productivity'], iconColor: '#6aea8a', iconBg: '#3a4a3a' },
    ],
    [],
  );
  const themeCards = useMemo(
    () => [
      { id: 'ice', name: 'Ice Glass', desc: 'Cool cyan accents and clean glass surfaces.', tags: ['light', 'glass'], gradient: 'linear-gradient(90deg, #a8d8ea 0%, #5ab9ea 50%, #d4e4f7 100%)' },
      { id: 'ember', name: 'Ember', desc: 'Warm amber accents with premium contrast.', tags: ['warm', 'glass'], gradient: 'linear-gradient(90deg, #e85a3a 0%, #d4622a 50%, #f0a040 100%)' },
      { id: 'soul', name: 'Soul Aurora', desc: 'Faceted neon highlights inspired by the Soul prototype.', tags: ['aurora', 'premium'], gradient: 'linear-gradient(90deg, #2a8a6a 0%, #3aaa8a 50%, #40d0b0 100%)' },
    ],
    [],
  );

  // Dynamic portal tags: extract from actual guild data, fall back to defaults
  const guilds = useGuildsStore((s) => s.guilds);
  const portalTagsFromGuilds = useMemo(() => {
    const tagCount = new Map<string, number>();
    for (const guild of guilds.values()) {
      const guildTags = (guild as any).tags;
      if (Array.isArray(guildTags)) {
        for (const t of guildTags) {
          if (typeof t === 'string') tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
        }
      }
      const guildCats = (guild as any).categories;
      if (Array.isArray(guildCats)) {
        for (const c of guildCats) {
          if (typeof c === 'string') tagCount.set(c.toLowerCase(), (tagCount.get(c.toLowerCase()) ?? 0) + 1);
        }
      }
    }
    // Sort by frequency, take top 8
    const sorted = Array.from(tagCount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t)
      .slice(0, 8);
    return sorted.length > 0 ? sorted : ['gaming', 'music', 'tech', 'art', 'social'];
  }, [guilds]);

  const activeTags = tab === 'portals'
    ? portalTagsFromGuilds
    : tab === 'bots'
      ? ['moderation', 'voice', 'music', 'productivity', 'fun']
      : ['glass', 'light', 'aurora', 'cyber', 'minimal'];

  const filteredCards = useMemo(() => {
    const source = tab === 'bots' ? botCards : themeCards;
    const q = query.trim().toLowerCase();
    const filtered = source.filter((card) => {
      const matchesQ = !q || card.name.toLowerCase().includes(q) || card.desc.toLowerCase().includes(q);
      const matchesTag = tag === 'all' || card.tags.includes(tag);
      return matchesQ && matchesTag;
    });
    if (sortBy === 'name') {
      return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortBy === 'new') {
      return filtered.sort((a, b) => b.id.localeCompare(a.id));
    }
    return filtered;
  }, [botCards, query, sortBy, tab, tag, themeCards]);

  useEffect(() => {
    const next = new URLSearchParams();
    next.set('tab', tab);
    if (query.trim()) next.set('q', query.trim());
    if (tag !== 'all') next.set('tag', tag);
    if (sortBy !== 'trending') next.set('sort', sortBy);
    setSearchParams(next, { replace: true });
  }, [tab, query, tag, sortBy, setSearchParams]);

  const portalStats = useMemo(
    () => ({
      lanes: 5,
      curated: 24,
      liveThemes: 3,
      botPackPreviews: 3,
    }),
    [],
  );
  const hasActiveFilters = query.trim().length > 0 || tag !== 'all' || sortBy !== 'trending';

  const tabSummary =
    tab === 'portals'
      ? `${portalStats.curated} curated portals`
      : `${filteredCards.length} ${tab === 'bots' ? 'bot' : 'theme'} result${filteredCards.length === 1 ? '' : 's'}`;

  // --- Styles ---
  const pageStyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  };

  const sidebarStyle: React.CSSProperties = {
    width: 240,
    minWidth: 240,
    background: '#25243a',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 16,
    overflowY: 'auto',
    borderRight: '1px solid var(--stroke)',
  };

  const mainStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    padding: '32px 40px',
    overflowY: 'auto',
  };

  const catTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
  };

  const catLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 1,
    color: 'var(--text-faint)',
    textTransform: 'uppercase',
  };

  const catItemBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 12px',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 400,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    width: '100%',
    textAlign: 'left',
  };

  const catItemActiveStyle: React.CSSProperties = {
    ...catItemBase,
    background: 'rgba(212, 175, 55, 0.13)',
    color: 'var(--accent)',
    fontWeight: 500,
  };

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  };

  const searchBarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 40,
    width: 320,
    padding: '0 14px',
    borderRadius: 10,
    background: '#25243a',
    border: '1px solid var(--stroke)',
    color: 'var(--text-faint)',
    fontSize: 13,
  };

  const searchInputStyle: React.CSSProperties = {
    flex: 1,
    border: 'none',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: 13,
    outline: 'none',
  };

  const tabsRowStyle: React.CSSProperties = {
    display: 'flex',
    width: '100%',
    gap: 0,
  };

  const tabBaseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    padding: '0 20px',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-muted)',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
  };

  const tabActiveStyle: React.CSSProperties = {
    ...tabBaseStyle,
    color: 'var(--accent)',
    borderBottom: '2px solid var(--accent)',
  };

  const dividerStyle: React.CSSProperties = {
    width: '100%',
    height: 1,
    background: 'var(--stroke)',
    flexShrink: 0,
  };

  const tagRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    width: '100%',
    flexWrap: 'wrap',
  };

  const tagChipBase: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: 100,
    fontSize: 12,
    fontWeight: 400,
    color: 'var(--text-muted)',
    background: '#353348',
    border: 'none',
    cursor: 'pointer',
  };

  const tagChipActiveStyle: React.CSSProperties = {
    ...tagChipBase,
    background: 'var(--accent)',
    color: '#1a1a2e',
    fontWeight: 600,
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
  };

  const sectionTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text)',
  };

  const sortDropdownStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    borderRadius: 6,
    background: '#353348',
    border: '1px solid var(--stroke)',
    color: 'var(--text-muted)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  };

  const cardGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 20,
    width: '100%',
  };

  const portalCardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#353348',
    border: '1px solid var(--stroke)',
    cursor: 'pointer',
  };

  const portalBannerStyle = (gradient: string): React.CSSProperties => ({
    height: 80,
    width: '100%',
    background: gradient,
  });

  const portalBodyStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 16,
  };

  const botGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    width: '100%',
  };

  const botCardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 10,
    background: '#353348',
    border: '1px solid var(--stroke)',
  };

  const botAvatarStyle = (bg: string): React.CSSProperties => ({
    width: 40,
    height: 40,
    minWidth: 40,
    borderRadius: 10,
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  });

  const botInfoStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 0,
  };

  const addBtnGoldStyle: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: 6,
    background: 'var(--accent)',
    color: '#1a1a2e',
    fontSize: 12,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
  };

  const addBtnMutedStyle: React.CSSProperties = {
    padding: '6px 14px',
    borderRadius: 6,
    background: '#413d58',
    color: 'var(--text-muted)',
    fontSize: 12,
    fontWeight: 500,
    border: '1px solid var(--stroke)',
    cursor: 'pointer',
  };

  const themeGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16,
    width: '100%',
  };

  const themeCardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 10,
    overflow: 'hidden',
    background: '#353348',
    border: '1px solid var(--stroke)',
  };

  const themePreviewStyle = (gradient: string): React.CSSProperties => ({
    height: 90,
    width: '100%',
    background: gradient,
  });

  const themeBodyStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 14,
  };

  const previewBtnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 14px',
    borderRadius: 6,
    background: '#413d58',
    color: 'var(--text-faint)',
    fontSize: 12,
    border: 'none',
    cursor: 'pointer',
  };

  return (
    <div style={pageStyle}>
      {/* Category Sidebar */}
      <div style={sidebarStyle}>
        <h2 style={catTitleStyle}>Discover</h2>
        <div style={{ height: 12 }} />
        <span style={catLabelStyle}>CATEGORIES</span>
        <div style={{ height: 4 }} />
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            style={activeCategory === cat.id ? catItemActiveStyle : catItemBase}
            onClick={() => {
              setActiveCategory(cat.id);
              if (cat.id === 'bots') { setTab('bots'); setTag('all'); setQuery(''); }
              else if (cat.id === 'themes') { setTab('themes'); setTag('all'); setQuery(''); }
              else if (cat.id === 'portals' || cat.id === 'featured') { setTab('portals'); setTag('all'); setQuery(''); }
              else if (cat.id === 'gaming') { setTab('portals'); setTag('gaming'); }
              else if (cat.id === 'music') { setTab('portals'); setTag('music'); }
            }}
          >
            <span style={{ fontSize: 14, width: 16, textAlign: 'center' as const }}>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div style={mainStyle}>
        {/* Header row: title + search */}
        <div style={headerRowStyle}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Discover</h1>
          <div style={searchBarStyle}>
            <span style={{ fontSize: 14, color: 'var(--text-faint)' }}>{'\u{1F50D}'}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Discover public portals..."
              style={searchInputStyle}
            />
          </div>
        </div>

        {/* Tab pills */}
        <div>
          <div style={tabsRowStyle} role="tablist" aria-label="Discover sections">
            {([
              ['portals', 'Portals'],
              ['bots', 'Bots'],
              ['themes', 'Themes'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                style={tab === value ? tabActiveStyle : tabBaseStyle}
                role="tab"
                aria-selected={tab === value}
                onClick={() => {
                  setTab(value);
                  setTag('all');
                  setQuery('');
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={dividerStyle} />
        </div>

        {/* Tag chips row */}
        <div style={tagRowStyle} role="group" aria-label="Popular tags">
          <button
            type="button"
            style={tag === 'all' ? tagChipActiveStyle : tagChipBase}
            onClick={() => setTag('all')}
          >
            All
          </button>
          {activeTags.map((t) => (
            <button
              key={t}
              type="button"
              style={tag === t ? tagChipActiveStyle : tagChipBase}
              onClick={() => setTag(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Featured Portals section */}
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Featured Portals</h2>
          <div style={sortDropdownStyle}>
            <span style={{ fontSize: 12 }}>{'\u2195'}</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'trending' | 'new' | 'name')}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: 12,
                fontWeight: 500,
                outline: 'none',
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
                paddingRight: 4,
              } as React.CSSProperties}
            >
              <option value="trending">Trending</option>
              <option value="new">Newest</option>
              <option value="name">Name</option>
            </select>
            <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{'\u25BC'}</span>
          </div>
        </div>

        {tab === 'portals' ? (
          <>
            {/* Portal cards */}
            {(() => {
              const q = query.trim().toLowerCase();
              const visiblePortals = portalCardData.filter((card) =>
                !q || card.name.toLowerCase().includes(q) || card.desc.toLowerCase().includes(q),
              );
              if (visiblePortals.length === 0) {
                return (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    padding: '64px 32px',
                    borderRadius: 14,
                    border: '1px solid var(--stroke)',
                    color: 'var(--text-muted)',
                  } as React.CSSProperties}>
                    <span style={{ fontSize: 36 }}>🔍</span>
                    <strong style={{ fontSize: 16, color: 'var(--text)' }}>No portals found</strong>
                    <span style={{ fontSize: 13 }}>Try a different search term or clear the filter.</span>
                    <button
                      type="button"
                      style={{
                        marginTop: 4,
                        border: '1px solid var(--stroke)',
                        background: 'rgba(255,255,255,0.03)',
                        color: 'var(--text)',
                        borderRadius: 999,
                        padding: '6px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      } as React.CSSProperties}
                      onClick={() => { setQuery(''); setTag('all'); setSortBy('trending'); }}
                    >
                      Reset filters
                    </button>
                  </div>
                );
              }
              return (
            <div style={cardGridStyle}>
              {visiblePortals.map((card) => (
                <div key={card.id} style={portalCardStyle}>
                  <div style={portalBannerStyle(card.gradient)} />
                  <div style={portalBodyStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{card.name}</span>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 100,
                        background: 'rgba(212, 175, 55, 0.18)',
                        color: 'var(--accent)',
                        fontSize: 11,
                        fontWeight: 600,
                        whiteSpace: 'nowrap' as const,
                      }}>
                        {card.members} members
                      </span>
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{card.desc}</span>
                    <button
                      type="button"
                      style={{
                        marginTop: 4,
                        height: 36,
                        width: '100%',
                        borderRadius: 6,
                        background: 'var(--accent)',
                        color: '#1a1a2e',
                        fontSize: 13,
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                      } as React.CSSProperties}
                    >
                      Join
                    </button>
                  </div>
                </div>
              ))}
            </div>
              );
            })()}

            {/* Popular Bots section */}
            <h2 style={sectionTitleStyle}>Popular Bots</h2>
            <div style={botGridStyle}>
              {botCards.map((bot, i) => (
                <div key={bot.id} style={botCardStyle}>
                  <div style={botAvatarStyle(bot.iconBg)}>
                    <span style={{ color: bot.iconColor, fontSize: 16 }}>
                      {bot.id === 'music' ? '\u266B' : bot.id === 'mod' ? '\u{1F6E1}' : '\u{1F3AE}'}
                    </span>
                  </div>
                  <div style={botInfoStyle}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{bot.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{bot.desc}</span>
                  </div>
                  <button type="button" style={i === 0 ? addBtnGoldStyle : addBtnMutedStyle}>
                    Add
                  </button>
                </div>
              ))}
            </div>

            {/* Themes section */}
            <h2 style={sectionTitleStyle}>Themes</h2>
            <div style={themeGridStyle}>
              {themeCards.map((theme) => (
                <div key={theme.id} style={themeCardStyle}>
                  <div style={themePreviewStyle(theme.gradient)} />
                  <div style={themeBodyStyle}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{theme.name}</span>
                    <button type="button" style={previewBtnStyle}>
                      Preview (Soon)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Bots or Themes tab content when selected directly */
          <>
            {tab === 'bots' ? (
              <>
                <h2 style={sectionTitleStyle}>{tabSummary}</h2>
                <div style={botGridStyle}>
                  {filteredCards.map((card, i) => {
                    const bot = card as typeof botCards[number];
                    return (
                      <div key={card.id} style={botCardStyle}>
                        <div style={botAvatarStyle(bot.iconBg ?? '#3e3a5a')}>
                          <span style={{ color: bot.iconColor ?? '#a8a4b8', fontSize: 16 }}>
                            {card.id === 'music' ? '\u266B' : card.id === 'mod' ? '\u{1F6E1}' : '\u{1F3AE}'}
                          </span>
                        </div>
                        <div style={botInfoStyle}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{card.name}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{card.desc}</span>
                        </div>
                        <button type="button" style={i === 0 ? addBtnGoldStyle : addBtnMutedStyle}>
                          Add
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <h2 style={sectionTitleStyle}>{tabSummary}</h2>
                <div style={themeGridStyle}>
                  {filteredCards.map((card) => {
                    const theme = card as typeof themeCards[number];
                    return (
                      <div key={card.id} style={themeCardStyle}>
                        <div style={themePreviewStyle(theme.gradient ?? 'linear-gradient(90deg, #5a4a7a, #3e3a5a)')} />
                        <div style={themeBodyStyle}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{card.name}</span>
                          <button type="button" style={previewBtnStyle}>
                            Preview (Soon)
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {filteredCards.length === 0 && (
              <div style={{
                borderRadius: 14,
                border: '1px solid var(--stroke)',
                padding: 24,
                color: 'var(--text-muted)',
                fontSize: 13,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                <strong style={{ color: 'var(--text)', fontSize: 14 }}>No results yet.</strong>
                <span style={{ fontSize: 12 }}>Try a different search, clear the tag filter, or switch tabs.</span>
                <div style={{ marginTop: 6 }}>
                  <button
                    type="button"
                    style={{
                      border: '1px solid var(--stroke)',
                      background: 'rgba(255,255,255,0.03)',
                      color: 'var(--text)',
                      borderRadius: 999,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      setQuery('');
                      setTag('all');
                      setSortBy('trending');
                    }}
                  >
                    Reset discover filters
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {hasActiveFilters && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              style={{
                border: '1px solid var(--stroke)',
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--text)',
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => {
                setQuery('');
                setTag('all');
                setSortBy('trending');
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
