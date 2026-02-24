import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ServerGallery } from '@/components/home/ServerGallery';

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

  const botCards = useMemo(
    () => [
      { id: 'mod', name: 'Portal Guard', desc: 'Moderation workflows, logs, and safety automations.', tags: ['safety', 'moderation'] },
      { id: 'music', name: 'Pulse', desc: 'Voice-room music and sound queue controls.', tags: ['audio', 'voice'] },
      { id: 'ops', name: 'Patchnote', desc: 'Release announcements, status posts, and deploy reminders.', tags: ['ops', 'productivity'] },
    ],
    [],
  );
  const themeCards = useMemo(
    () => [
      { id: 'ice', name: 'Ice Glass', desc: 'Cool cyan accents and clean glass surfaces.', tags: ['light', 'glass'] },
      { id: 'ember', name: 'Ember', desc: 'Warm amber accents with premium contrast.', tags: ['warm', 'glass'] },
      { id: 'soul', name: 'Soul Aurora', desc: 'Faceted neon highlights inspired by the Soul prototype.', tags: ['aurora', 'premium'] },
    ],
    [],
  );

  const activeTags = tab === 'portals'
    ? ['gaming', 'productivity', 'creative', 'study', 'social']
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

  return (
    <div className="discover-page">
      <header className="discover-header">
        <div>
          <div className="discover-eyebrow">Discover</div>
          <h1 className="discover-title">Find Portals, Bots, and Themes</h1>
          <p className="discover-subtitle">
            Streaming-style browsing for communities today, with bots and shared themes expanding next.
          </p>
        </div>
        <div className="discover-tabs" role="tablist" aria-label="Discover sections">
          {([
            ['portals', 'Portals'],
            ['bots', 'Bots'],
            ['themes', 'Themes'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`discover-tab ${tab === value ? 'active' : ''}`}
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
      </header>

      <section className="discover-panel">
        <div className="discover-controls">
          <div className="discover-controls-row">
            <input
              className="discover-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                tab === 'portals' ? 'Search portals' : tab === 'bots' ? 'Search bots' : 'Search themes'
              }
            />
            <label className="discover-sort">
              <span>Sort</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'trending' | 'new' | 'name')}>
                <option value="trending">Trending</option>
                <option value="new">Newest</option>
                <option value="name">Name</option>
              </select>
            </label>
          </div>
          <div className="discover-tag-row" role="group" aria-label="Popular tags">
            <button
              type="button"
              className={`discover-tag ${tag === 'all' ? 'active' : ''}`}
              onClick={() => setTag('all')}
            >
              #all
            </button>
            {activeTags.map((t) => (
              <button
                key={t}
                type="button"
                className={`discover-tag ${tag === t ? 'active' : ''}`}
                onClick={() => setTag(t)}
              >
                #{t}
              </button>
            ))}
          </div>
          <div className="discover-inline-meta">
            <span className="discover-inline-pill discover-inline-pill-strong">{tabSummary}</span>
            {tab === 'portals' ? (
              <>
                <span className="discover-inline-pill">{portalStats.lanes} browse lanes</span>
                <span className="discover-inline-pill">{portalStats.curated} curated portal cards</span>
                <span className="discover-inline-pill">{portalStats.botPackPreviews} bot previews</span>
                <span className="discover-inline-pill">{portalStats.liveThemes} theme packs</span>
              </>
            ) : (
              <span className="discover-inline-pill">
                Placeholder catalog with production-ready routing + filters
              </span>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                className="discover-reset-btn"
                onClick={() => {
                  setQuery('');
                  setTag('all');
                  setSortBy('trending');
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {tab === 'portals' ? (
          <ServerGallery />
        ) : (
          <div className="discover-card-grid">
            {filteredCards.map((card) => (
              <article key={card.id} className="discover-card">
                <div className="discover-card-icon">{tab === 'bots' ? 'B' : 'T'}</div>
                <div className="discover-card-body">
                  <h3>{card.name}</h3>
                  <p>{card.desc}</p>
                  <div className="discover-card-tags">
                    {card.tags.map((t) => (
                      <span key={t} className="discover-card-tag">#{t}</span>
                    ))}
                  </div>
                  <div className="discover-card-status">
                    {tab === 'bots' ? 'Preview install flow' : 'Theme preview only'}
                  </div>
                </div>
                <button type="button" className="discover-card-cta" disabled>
                  {tab === 'bots' ? 'Install (Soon)' : 'Preview (Soon)'}
                </button>
              </article>
            ))}
            {filteredCards.length === 0 && (
              <div className="discover-empty-inline">
                <strong>No results yet.</strong>
                <span>Try a different search, clear the tag filter, or switch tabs.</span>
                <div className="discover-empty-actions">
                  <button
                    type="button"
                    className="discover-reset-btn"
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
          </div>
        )}
      </section>
    </div>
  );
}
