import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useGuilds } from '@/hooks/useGuilds';
import { useGuildsStore } from '@/stores/guilds.store';
import { GuildIcon } from '@/components/ui/GuildIcon';

const MEDIA_FIT_STORAGE_KEY = 'gratonite_server_gallery_media_fit_v1';
const MEDIA_ANIMATED_STORAGE_KEY = 'gratonite_server_gallery_animated_v1';
const FAVORITES_STORAGE_KEY = 'gratonite_portal_gallery_favorites_v1';

type MediaFitMode = 'cover' | 'contain';
type SortMode = 'recent' | 'alphabetical' | 'members';

interface ServerGalleryProps {
  onOpenDirectMessages?: () => void;
}

function readMediaFitPreference(): MediaFitMode {
  if (typeof window === 'undefined') return 'cover';
  const value = window.localStorage.getItem(MEDIA_FIT_STORAGE_KEY);
  return value === 'contain' ? 'contain' : 'cover';
}

function readAnimatedMediaPreference(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(MEDIA_ANIMATED_STORAGE_KEY) !== 'off';
}

function readFavoriteMap(): Record<string, true> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return {};
    return Object.fromEntries(parsed.filter((id) => typeof id === 'string').map((id) => [id, true]));
  } catch {
    return {};
  }
}

function getGuildHue(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 360;
  }
  return hash;
}

function inferPortalThemeLabel(name: string, description?: string | null) {
  const text = `${name} ${description ?? ''}`.toLowerCase();
  if (/(rank|fps|raid|pvp|game|legends|valorant|apex)/.test(text)) return 'Gaming';
  if (/(study|focus|school|class|learn)/.test(text)) return 'Study';
  if (/(build|dev|code|lab|script|tech)/.test(text)) return 'Build';
  if (/(chill|social|hang|friends|lounge)/.test(text)) return 'Chill';
  if (/(art|music|design|creator|photo)/.test(text)) return 'Creative';
  return 'Community';
}

export function ServerGallery({ onOpenDirectMessages }: ServerGalleryProps) {
  const { isLoading } = useGuilds();
  const guilds = useGuildsStore((s) => s.guilds);
  const guildOrder = useGuildsStore((s) => s.guildOrder);
  const [mediaFitMode, setMediaFitMode] = useState<MediaFitMode>(() => readMediaFitPreference());
  const [animatedMediaEnabled, setAnimatedMediaEnabled] = useState(() => readAnimatedMediaPreference());
  const [bannerLoadErrors, setBannerLoadErrors] = useState<Record<string, true>>({});
  const [sortMode, setSortMode] = useState<SortMode>('members');
  const [search, setSearch] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<Record<string, true>>(() => readFavoriteMap());
  const [themeFilter, setThemeFilter] = useState<string>('All');

  const items = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const ordered = guildOrder
      .map((id) => guilds.get(id))
      .filter((guild): guild is NonNullable<typeof guild> => Boolean(guild));
    const filtered = normalizedSearch
      ? ordered.filter((guild) =>
        guild.name.toLowerCase().includes(normalizedSearch)
        || (guild.description ?? '').toLowerCase().includes(normalizedSearch),
      )
      : ordered;

    return [...filtered].sort((a, b) => {
      const aFav = favoriteIds[a.id] ? 1 : 0;
      const bFav = favoriteIds[b.id] ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      if (sortMode === 'alphabetical') return a.name.localeCompare(b.name);
      if (sortMode === 'members') return (b.memberCount ?? 0) - (a.memberCount ?? 0);
      return guildOrder.indexOf(a.id) - guildOrder.indexOf(b.id);
    });
  }, [favoriteIds, guildOrder, guilds, search, sortMode]);

  const withMeta = useMemo(() => {
    return items.map((guild) => {
      // Use stored categories first, fall back to inference
      const themeLabel = (guild as any).categories?.length > 0
        ? (guild as any).categories[0]
        : inferPortalThemeLabel(guild.name, guild.description);
      const isFavorite = Boolean(favoriteIds[guild.id]);
      const isActive = (guild.memberCount ?? 0) > 0;
      const isNew = (guild.memberCount ?? 0) === 0;
      return { guild, themeLabel, isFavorite, isActive, isNew };
    });
  }, [favoriteIds, items]);

  const themeOptions = useMemo(() => {
    const set = new Set<string>(['All']);
    withMeta.forEach((item) => set.add(item.themeLabel));
    return Array.from(set);
  }, [withMeta]);

  const filteredByTheme = useMemo(() => {
    if (themeFilter === 'All') return withMeta;
    return withMeta.filter((item) => item.themeLabel === themeFilter);
  }, [themeFilter, withMeta]);

  const favoritesLaneItems = useMemo(() => filteredByTheme.filter((item) => item.isFavorite).slice(0, 10), [filteredByTheme]);
  const allGridItems = filteredByTheme;

  useEffect(() => {
    window.localStorage.setItem(MEDIA_FIT_STORAGE_KEY, mediaFitMode);
  }, [mediaFitMode]);

  useEffect(() => {
    window.localStorage.setItem(MEDIA_ANIMATED_STORAGE_KEY, animatedMediaEnabled ? 'on' : 'off');
  }, [animatedMediaEnabled]);

  useEffect(() => {
    window.localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify(Object.keys(favoriteIds).filter((id) => favoriteIds[id])),
    );
  }, [favoriteIds]);

  function toggleFavorite(guildId: string) {
    setFavoriteIds((current) => {
      if (current[guildId]) {
        const next = { ...current };
        delete next[guildId];
        return next;
      }
      return { ...current, [guildId]: true };
    });
  }

  if (isLoading) {
    return (
      <section className="server-gallery">
        <div className="server-gallery-head">
          <h2 className="server-gallery-title">Portal Gallery</h2>
          <p className="server-gallery-subtitle">Loading your portals...</p>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="server-gallery">
        <div className="server-gallery-head">
          <h2 className="server-gallery-title">Portal Gallery</h2>
          <p className="server-gallery-subtitle">Create or join a portal to start building your collection.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="server-gallery"
      data-media-fit={mediaFitMode}
      data-animated-banners={animatedMediaEnabled ? 'on' : 'off'}
    >
      <div className="server-gallery-head">
        <div className="server-gallery-heading">
          <h2 className="server-gallery-title">Portal Gallery</h2>
          <p className="server-gallery-subtitle">A streaming-style entry point for your communities, themes, and live spaces.</p>
        </div>
        <div className="server-gallery-controls">
          <input
            className="server-gallery-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a portal"
            aria-label="Find a portal"
          />
          <select
            className="server-gallery-sort"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            aria-label="Sort portals"
          >
            <option value="recent">Sort: Recent</option>
            <option value="alphabetical">Sort: A-Z</option>
            <option value="members">Sort: Members</option>
          </select>
          {onOpenDirectMessages && (
            <button
              type="button"
              className="server-gallery-toggle"
              onClick={onOpenDirectMessages}
            >
              Direct Messages
            </button>
          )}
          <div className="server-gallery-segmented" role="group" aria-label="Portal card media fit">
            <button
              type="button"
              className={`server-gallery-control ${mediaFitMode === 'cover' ? 'active' : ''}`}
              aria-pressed={mediaFitMode === 'cover'}
              onClick={() => setMediaFitMode('cover')}
            >
              Fill cards
            </button>
            <button
              type="button"
              className={`server-gallery-control ${mediaFitMode === 'contain' ? 'active' : ''}`}
              aria-pressed={mediaFitMode === 'contain'}
              onClick={() => setMediaFitMode('contain')}
            >
              Fit media
            </button>
          </div>
          <button
            type="button"
            className={`server-gallery-toggle ${animatedMediaEnabled ? '' : 'paused'}`}
            aria-pressed={animatedMediaEnabled}
            onClick={() => setAnimatedMediaEnabled((enabled) => !enabled)}
          >
            {animatedMediaEnabled ? 'Animated banners on' : 'Animated banners off'}
          </button>
        </div>
      </div>
      <div className="server-gallery-filter-bar">
        <div className="server-gallery-theme-filters" role="group" aria-label="Portal themes">
          {themeOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={`server-gallery-theme-filter ${themeFilter === option ? 'active' : ''}`}
              aria-pressed={themeFilter === option}
              onClick={() => setThemeFilter(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {favoritesLaneItems.length > 0 && (
        <section className="server-gallery-rail" aria-label="Starred portals">
          <div className="server-gallery-section-head">
            <h3 className="server-gallery-section-title">Starred</h3>
            <span className="server-gallery-section-meta">Quick access to your most important portals</span>
          </div>
          <div className="server-gallery-rail-scroll">
            {favoritesLaneItems.map((item) => (
              <div key={`starred-${item.guild.id}`} className="server-gallery-rail-card">
                {renderPortalCard(item.guild, item.themeLabel, { compact: true })}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="server-gallery-section-head">
        <h3 className="server-gallery-section-title">Browse All</h3>
        <span className="server-gallery-section-meta">
          {allGridItems.length} portal{allGridItems.length === 1 ? '' : 's'} shown
        </span>
      </div>
      <div className="server-gallery-grid">
        {allGridItems.map(({ guild, themeLabel }) => {
          return renderPortalCard(guild, themeLabel);
        })}
      </div>
    </section>
  );

  function renderPortalCard(
    guild: NonNullable<ReturnType<typeof useGuildsStore.getState>['guilds']> extends Map<string, infer T> ? T : never,
    themeLabel: string,
    options?: { compact?: boolean },
  ) {
    const compact = Boolean(options?.compact);
    const bannerUrl = guild.bannerHash ? `/api/v1/files/${guild.bannerHash}` : null;
    const isAnimatedBannerSuppressed = Boolean(guild.bannerAnimated && !animatedMediaEnabled);
    const hasBannerError = Boolean(bannerUrl && bannerLoadErrors[guild.id]);
    const showBanner = Boolean(bannerUrl && !isAnimatedBannerSuppressed && !hasBannerError);
    const fallbackReason = isAnimatedBannerSuppressed
      ? 'Animation paused'
      : hasBannerError
        ? 'Banner unavailable'
        : null;
    const description = guild.description || 'No description yet.';
    const members = (guild.memberCount ?? 0) > 0 ? `${(guild.memberCount ?? 0).toLocaleString()} members` : 'New portal';
    const featured = Boolean(favoriteIds[guild.id]);
    const mediaStyle = { '--server-gallery-hue': `${getGuildHue(guild.id)}deg` } as CSSProperties;

          return (
            <Link key={guild.id} to={`/guild/${guild.id}`} className={`server-gallery-card ${compact ? 'server-gallery-card-compact' : ''}`}>
              <div className={`server-gallery-card-border ${featured ? 'featured' : ''}`} aria-hidden="true" />
              <button
                type="button"
                className={`server-gallery-favorite ${favoriteIds[guild.id] ? 'active' : ''}`}
                aria-label={favoriteIds[guild.id] ? `Unfavorite ${guild.name}` : `Favorite ${guild.name}`}
                aria-pressed={Boolean(favoriteIds[guild.id])}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleFavorite(guild.id);
                }}
              >
                ★
              </button>
              <div className="server-gallery-media" style={mediaStyle}>
                <div className="server-gallery-media-fallback" />
                <div className="server-gallery-media-orb" aria-hidden="true" />
                {showBanner && (
                  <img
                    src={bannerUrl!}
                    alt=""
                    className={`server-gallery-banner server-gallery-banner-${mediaFitMode}`}
                    onError={() =>
                      setBannerLoadErrors((current) => {
                        if (current[guild.id]) return current;
                        return { ...current, [guild.id]: true };
                      })
                    }
                  />
                )}
                <div className="server-gallery-shade" />
                <div className="server-gallery-topline">
                  <span className="server-gallery-theme-chip">{themeLabel}</span>
                  <span className={`server-gallery-status-chip ${(guild.memberCount ?? 0) > 0 ? 'live' : ''}`}>
                    {(guild.memberCount ?? 0) > 0 ? 'Active' : 'New'}
                  </span>
                </div>
                <div className="server-gallery-icon-wrap">
                  <GuildIcon
                    name={guild.name}
                    guildId={guild.id}
                    iconHash={guild.iconHash}
                    size={56}
                    className="server-gallery-icon"
                  />
                </div>
                {fallbackReason && <div className="server-gallery-media-badge">{fallbackReason}</div>}
              </div>
              <div className="server-gallery-body">
                <div className="server-gallery-title-row">
                  <div className="server-gallery-name">{guild.name}</div>
                  {featured && <span className="server-gallery-featured-badge">Starred</span>}
                </div>
                <div className="server-gallery-meta">{members}</div>
                <div className="server-gallery-description-line">{description}</div>
              </div>
              <div className="server-gallery-hover">
                <div className="server-gallery-hover-title">{guild.name}</div>
                <div className="server-gallery-hover-description">{description}</div>
                <div className="server-gallery-hover-footer">
                  <div className="server-gallery-hover-members">{members}</div>
                  <div className="server-gallery-hover-cta">Enter Portal</div>
                </div>
              </div>
            </Link>
          );
  }
}
