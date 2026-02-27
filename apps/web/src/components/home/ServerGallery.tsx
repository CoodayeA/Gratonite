import { Link } from 'react-router-dom';
import React, { useEffect, useMemo, useState } from 'react';
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

/* ---------- styles ---------- */

const styles = {
  gallery: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  } as React.CSSProperties,
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  } as React.CSSProperties,
  heading: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 220,
  } as React.CSSProperties,
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  } as React.CSSProperties,
  subtitle: {
    fontSize: 13,
    color: 'var(--text-muted)',
    margin: 0,
  } as React.CSSProperties,
  controls: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
  } as React.CSSProperties,
  searchInput: {
    height: 34,
    borderRadius: 'var(--radius-pill)',
    border: '1px solid var(--stroke)',
    background: 'rgba(10, 16, 28, 0.58)',
    color: 'var(--text)',
    fontSize: 12,
    minWidth: 170,
    padding: '0 12px',
  } as React.CSSProperties,
  sortSelect: {
    height: 34,
    borderRadius: 'var(--radius-pill)',
    border: '1px solid var(--stroke)',
    background: 'rgba(10, 16, 28, 0.58)',
    color: 'var(--text)',
    fontSize: 12,
    minWidth: 122,
    padding: '0 10px',
  } as React.CSSProperties,
  segmented: {
    display: 'inline-flex',
    borderRadius: 'var(--radius-pill)',
    border: '1px solid var(--stroke)',
    background: 'rgba(10, 16, 28, 0.58)',
    overflow: 'hidden',
  } as React.CSSProperties,
  controlBtn: {
    border: 0,
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.01em',
    padding: '6px 10px',
    cursor: 'pointer',
    transition: 'background 0.15s ease, color 0.15s ease',
  } as React.CSSProperties,
  controlBtnActive: {
    color: 'var(--text)',
    background: 'rgba(102, 220, 255, 0.2)',
  } as React.CSSProperties,
  toggleBtn: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--stroke)',
    borderRadius: 'var(--radius-pill)',
    background: 'rgba(10, 16, 28, 0.58)',
    color: 'var(--text-muted)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.01em',
    padding: '6px 10px',
    cursor: 'pointer',
    transition: 'background 0.15s ease, color 0.15s ease',
  } as React.CSSProperties,
  toggleBtnPaused: {
    color: 'var(--accent)',
    borderColor: 'rgba(212, 175, 55, 0.38)',
  } as React.CSSProperties,
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,
  themeFilters: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    overflowX: 'auto',
    maxWidth: '100%',
  } as React.CSSProperties,
  themeFilter: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(163, 191, 239, 0.12)',
    background: 'rgba(10, 16, 28, 0.44)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius-pill)',
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  themeFilterActive: {
    color: 'var(--text)',
    borderColor: 'rgba(121, 223, 255, 0.22)',
    background: 'rgba(121, 223, 255, 0.1)',
  } as React.CSSProperties,
  sectionHead: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  } as React.CSSProperties,
  sectionTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '0.01em',
  } as React.CSSProperties,
  sectionMeta: {
    color: 'var(--text-faint)',
    fontSize: 11,
  } as React.CSSProperties,
  rail: {
    display: 'grid',
    gap: 10,
  } as React.CSSProperties,
  railScroll: {
    display: 'grid',
    gridAutoFlow: 'column',
    gridAutoColumns: 'minmax(240px, 280px)',
    gap: 12,
    overflowX: 'auto',
    paddingBottom: 4,
  } as React.CSSProperties,
  railCard: {
    minWidth: 0,
  } as React.CSSProperties,
  grid: {
    display: 'grid',
    gap: 16,
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  } as React.CSSProperties,
  card: {
    position: 'relative',
    borderRadius: 'var(--radius-xl)',
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(140, 178, 220, 0.12)',
    background: 'linear-gradient(180deg, rgba(16, 23, 40, 0.8), rgba(12, 18, 31, 0.9)), radial-gradient(circle at 85% -10%, rgba(138, 123, 255, 0.08), transparent 55%)',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
    minHeight: 270,
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
    display: 'block',
  } as React.CSSProperties,
  cardCompact: {
    minHeight: 208,
  } as React.CSSProperties,
  cardHovered: {
    transform: 'translateY(-3px)',
    borderColor: 'rgba(163, 191, 239, 0.24)',
    boxShadow: '0 16px 34px rgba(6, 10, 18, 0.28)',
  } as React.CSSProperties,
  cardBorder: {
    position: 'absolute',
    inset: -1,
    borderRadius: 'var(--radius-xl)',
    zIndex: 0,
    pointerEvents: 'none',
    background: 'linear-gradient(135deg, rgba(121, 223, 255, 0.08), transparent 40%, rgba(138, 123, 255, 0.1))',
    opacity: 0,
    transition: 'opacity 180ms ease',
  } as React.CSSProperties,
  cardBorderFeatured: {
    opacity: 1,
    background: 'linear-gradient(135deg, rgba(121, 223, 255, 0.14), rgba(138, 123, 255, 0.08), rgba(255, 215, 125, 0.12))',
  } as React.CSSProperties,
  cardBorderHovered: {
    opacity: 1,
  } as React.CSSProperties,
  favorite: {
    position: 'absolute',
    zIndex: 3,
    top: 10,
    left: 10,
    width: 26,
    height: 26,
    borderRadius: 'var(--radius-pill)',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.22)',
    background: 'rgba(7, 12, 22, 0.55)',
    color: 'rgba(229, 237, 255, 0.85)',
    fontSize: 14,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  } as React.CSSProperties,
  favoriteActive: {
    color: '#ffd45d',
    borderColor: 'rgba(255, 212, 93, 0.65)',
    background: 'rgba(36, 24, 0, 0.58)',
  } as React.CSSProperties,
  media: {
    position: 'relative',
    height: 148,
    overflow: 'hidden',
  } as React.CSSProperties,
  mediaCompact: {
    height: 108,
  } as React.CSSProperties,
  mediaFallback: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
  } as React.CSSProperties,
  mediaOrb: {
    position: 'absolute',
    width: 120,
    height: 120,
    top: -40,
    right: -28,
    borderRadius: '50%',
    zIndex: 0,
    pointerEvents: 'none',
    background: 'radial-gradient(circle, rgba(121, 223, 255, 0.16), rgba(138, 123, 255, 0.1), transparent 68%)',
    filter: 'blur(12px)',
  } as React.CSSProperties,
  banner: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
  } as React.CSSProperties,
  bannerCover: {
    objectFit: 'cover',
  } as React.CSSProperties,
  bannerContain: {
    objectFit: 'contain',
    background: 'rgba(8, 12, 22, 0.72)',
  } as React.CSSProperties,
  shade: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    background: 'linear-gradient(180deg, rgba(7, 11, 19, 0.08), rgba(7, 11, 19, 0.62))',
  } as React.CSSProperties,
  topline: {
    position: 'absolute',
    top: 10,
    left: 44,
    right: 44,
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  } as React.CSSProperties,
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 8px',
    borderRadius: 'var(--radius-pill)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    background: 'rgba(9, 14, 24, 0.5)',
    color: 'rgba(232, 240, 255, 0.86)',
  } as React.CSSProperties,
  themeChip: {
    borderColor: 'rgba(121, 223, 255, 0.22)',
    background: 'rgba(121, 223, 255, 0.1)',
    color: '#bef6ff',
  } as React.CSSProperties,
  statusChipLive: {
    borderColor: 'rgba(159, 255, 229, 0.2)',
    color: '#b4ffe8',
  } as React.CSSProperties,
  iconWrap: {
    position: 'absolute',
    left: 14,
    bottom: 12,
    zIndex: 2,
    filter: 'drop-shadow(0 10px 18px rgba(0, 0, 0, 0.24))',
  } as React.CSSProperties,
  iconWrapCompact: {
    left: 10,
    bottom: 10,
  } as React.CSSProperties,
  mediaBadge: {
    position: 'absolute',
    zIndex: 2,
    top: 10,
    right: 10,
    borderRadius: 'var(--radius-pill)',
    padding: '4px 8px',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    color: 'rgba(228, 236, 255, 0.86)',
    border: '1px solid rgba(255, 255, 255, 0.16)',
    background: 'rgba(8, 12, 22, 0.58)',
  } as React.CSSProperties,
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    padding: '14px 14px 14px',
    position: 'relative',
    zIndex: 1,
  } as React.CSSProperties,
  bodyCompact: {
    padding: '10px 12px 12px',
  } as React.CSSProperties,
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,
  name: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  } as React.CSSProperties,
  nameCompact: {
    fontSize: 13,
  } as React.CSSProperties,
  featuredBadge: {
    flexShrink: 0,
    borderRadius: 'var(--radius-pill)',
    border: '1px solid rgba(255, 215, 125, 0.28)',
    background: 'rgba(255, 215, 125, 0.08)',
    color: '#ffd98d',
    padding: '2px 7px',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  } as React.CSSProperties,
  meta: {
    fontSize: 12,
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  descriptionLine: {
    fontSize: 12,
    color: 'var(--text-muted)',
    lineHeight: 1.35,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    minHeight: '2.7em',
  } as React.CSSProperties,
  descriptionLineCompact: {
    WebkitLineClamp: 1,
    minHeight: '1.35em',
  } as React.CSSProperties,
  hover: {
    position: 'absolute',
    inset: 0,
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    gap: 8,
    padding: 14,
    color: 'var(--text)',
    background: 'linear-gradient(180deg, rgba(8, 14, 25, 0.05) 20%, rgba(8, 14, 25, 0.72) 55%, rgba(8, 14, 25, 0.92) 100%), rgb(12, 18, 31)',
    opacity: 0,
    transform: 'translateY(10px)',
    transition: 'opacity 160ms ease, transform 160ms ease',
    pointerEvents: 'none',
  } as React.CSSProperties,
  hoverVisible: {
    opacity: 1,
    transform: 'translateY(0)',
    pointerEvents: 'auto',
  } as React.CSSProperties,
  bodyHidden: {
    opacity: 0,
    transition: 'opacity 0.2s ease',
  } as React.CSSProperties,
  hoverTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
  } as React.CSSProperties,
  hoverDescription: {
    fontSize: 12,
    color: 'var(--text-muted)',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  } as React.CSSProperties,
  hoverCta: {
    alignSelf: 'flex-start',
    padding: '6px 10px',
    borderRadius: 'var(--radius-pill)',
    border: '1px solid rgba(121, 223, 255, 0.38)',
    background: 'rgba(121, 223, 255, 0.12)',
    color: 'var(--text)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.02em',
  } as React.CSSProperties,
  hoverFooter: {
    marginTop: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  } as React.CSSProperties,
  hoverMembers: {
    fontSize: 11,
    color: 'var(--text-faint)',
  } as React.CSSProperties,
};

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
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

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
      <section style={styles.gallery}>
        <div style={styles.head}>
          <h2 style={styles.title}>Portal Gallery</h2>
          <p style={styles.subtitle}>Loading your portals...</p>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section style={styles.gallery}>
        <div style={styles.head}>
          <h2 style={styles.title}>Portal Gallery</h2>
          <p style={styles.subtitle}>Create or join a portal to start building your collection.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      style={styles.gallery}
      data-media-fit={mediaFitMode}
      data-animated-banners={animatedMediaEnabled ? 'on' : 'off'}
    >
      <div style={styles.head}>
        <div style={styles.heading}>
          <h2 style={styles.title}>Portal Gallery</h2>
          <p style={styles.subtitle}>A streaming-style entry point for your communities, themes, and live spaces.</p>
        </div>
        <div style={styles.controls}>
          <input
            style={styles.searchInput}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a portal"
            aria-label="Find a portal"
          />
          <select
            style={styles.sortSelect}
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
              style={styles.toggleBtn}
              onClick={onOpenDirectMessages}
            >
              Direct Messages
            </button>
          )}
          <div style={styles.segmented} role="group" aria-label="Portal card media fit">
            <button
              type="button"
              style={{
                ...styles.controlBtn,
                ...(mediaFitMode === 'cover' ? styles.controlBtnActive : {}),
              }}
              aria-pressed={mediaFitMode === 'cover'}
              onClick={() => setMediaFitMode('cover')}
            >
              Fill cards
            </button>
            <button
              type="button"
              style={{
                ...styles.controlBtn,
                ...(mediaFitMode === 'contain' ? styles.controlBtnActive : {}),
              }}
              aria-pressed={mediaFitMode === 'contain'}
              onClick={() => setMediaFitMode('contain')}
            >
              Fit media
            </button>
          </div>
          <button
            type="button"
            style={{
              ...styles.toggleBtn,
              ...(!animatedMediaEnabled ? styles.toggleBtnPaused : {}),
            }}
            aria-pressed={animatedMediaEnabled}
            onClick={() => setAnimatedMediaEnabled((enabled) => !enabled)}
          >
            {animatedMediaEnabled ? 'Animated banners on' : 'Animated banners off'}
          </button>
        </div>
      </div>
      <div style={styles.filterBar}>
        <div style={styles.themeFilters} role="group" aria-label="Portal themes">
          {themeOptions.map((option) => (
            <button
              key={option}
              type="button"
              style={{
                ...styles.themeFilter,
                ...(themeFilter === option ? styles.themeFilterActive : {}),
              }}
              aria-pressed={themeFilter === option}
              onClick={() => setThemeFilter(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {favoritesLaneItems.length > 0 && (
        <section style={styles.rail} aria-label="Starred portals">
          <div style={styles.sectionHead}>
            <h3 style={styles.sectionTitle}>Starred</h3>
            <span style={styles.sectionMeta}>Quick access to your most important portals</span>
          </div>
          <div style={styles.railScroll}>
            {favoritesLaneItems.map((item) => (
              <div key={`starred-${item.guild.id}`} style={styles.railCard}>
                {renderPortalCard(item.guild, item.themeLabel, { compact: true })}
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={styles.sectionHead}>
        <h3 style={styles.sectionTitle}>Browse All</h3>
        <span style={styles.sectionMeta}>
          {allGridItems.length} portal{allGridItems.length === 1 ? '' : 's'} shown
        </span>
      </div>
      <div style={styles.grid}>
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
    const isHovered = hoveredCardId === guild.id;

    const hue = getGuildHue(guild.id);
    const fallbackBg = `radial-gradient(circle at 78% 16%, hsla(${hue}, 86%, 74%, 0.36), transparent 44%), radial-gradient(circle at 22% 10%, rgba(121, 223, 255, 0.15), transparent 48%), linear-gradient(140deg, hsla(${hue}, 66%, 52%, 0.22), rgba(138, 123, 255, 0.15)), linear-gradient(180deg, rgba(14, 20, 36, 0.76), rgba(11, 16, 29, 0.94))`;

          return (
            <Link
              key={guild.id}
              to={`/guild/${guild.id}`}
              style={{
                ...styles.card,
                ...(compact ? styles.cardCompact : {}),
                ...(isHovered ? styles.cardHovered : {}),
              }}
              onMouseEnter={() => setHoveredCardId(guild.id)}
              onMouseLeave={() => setHoveredCardId(null)}
            >
              <div
                style={{
                  ...styles.cardBorder,
                  ...(featured ? styles.cardBorderFeatured : {}),
                  ...(isHovered ? styles.cardBorderHovered : {}),
                }}
                aria-hidden="true"
              />
              <button
                type="button"
                style={{
                  ...styles.favorite,
                  ...(favoriteIds[guild.id] ? styles.favoriteActive : {}),
                }}
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
              <div style={{
                ...styles.media,
                ...(compact ? styles.mediaCompact : {}),
              }}>
                <div style={{ ...styles.mediaFallback, background: fallbackBg }} />
                <div style={styles.mediaOrb} aria-hidden="true" />
                {showBanner && (
                  <img
                    src={bannerUrl!}
                    alt=""
                    style={{
                      ...styles.banner,
                      ...(mediaFitMode === 'cover' ? styles.bannerCover : styles.bannerContain),
                    }}
                    onError={() =>
                      setBannerLoadErrors((current) => {
                        if (current[guild.id]) return current;
                        return { ...current, [guild.id]: true };
                      })
                    }
                  />
                )}
                <div style={styles.shade} />
                <div style={styles.topline}>
                  <span style={{ ...styles.chip, ...styles.themeChip }}>{themeLabel}</span>
                  <span style={{
                    ...styles.chip,
                    ...((guild.memberCount ?? 0) > 0 ? styles.statusChipLive : {}),
                  }}>
                    {(guild.memberCount ?? 0) > 0 ? 'Active' : 'New'}
                  </span>
                </div>
                <div style={{
                  ...styles.iconWrap,
                  ...(compact ? styles.iconWrapCompact : {}),
                }}>
                  <GuildIcon
                    name={guild.name}
                    guildId={guild.id}
                    iconHash={guild.iconHash}
                    size={compact ? 42 : 56}
                    style={{
                      borderRadius: 'var(--radius-lg)',
                      border: '2px solid rgba(255, 255, 255, 0.22)',
                      boxShadow: '0 8px 20px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                    }}
                  />
                </div>
                {fallbackReason && <div style={styles.mediaBadge}>{fallbackReason}</div>}
              </div>
              <div style={{
                ...styles.body,
                ...(compact ? styles.bodyCompact : {}),
                ...(isHovered ? styles.bodyHidden : {}),
              }}>
                <div style={styles.titleRow}>
                  <div style={{
                    ...styles.name,
                    ...(compact ? styles.nameCompact : {}),
                  }}>{guild.name}</div>
                  {featured && <span style={styles.featuredBadge}>Starred</span>}
                </div>
                <div style={styles.meta}>{members}</div>
                <div style={{
                  ...styles.descriptionLine,
                  ...(compact ? styles.descriptionLineCompact : {}),
                }}>{description}</div>
              </div>
              <div style={{
                ...styles.hover,
                ...(isHovered ? styles.hoverVisible : {}),
              }}>
                <div style={styles.hoverTitle}>{guild.name}</div>
                <div style={styles.hoverDescription}>{description}</div>
                <div style={styles.hoverFooter}>
                  <div style={styles.hoverMembers}>{members}</div>
                  <div style={styles.hoverCta}>Enter Portal</div>
                </div>
              </div>
            </Link>
          );
  }
}
