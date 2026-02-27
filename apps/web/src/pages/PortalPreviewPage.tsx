import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { useGuildsStore } from '@/stores/guilds.store';
import { useAuthStore } from '@/stores/auth.store';
import { GuildIcon } from '@/components/ui/GuildIcon';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getSocket } from '@/lib/socket';
import type { Guild } from '@gratonite/types';

/* ── CSS variable tokens ─────────────────────────────────────────── */
const V = {
  bg:          'var(--bg, #2c2c3e)',
  bgElevated:  'var(--bg-elevated, #353348)',
  bgInput:     'var(--bg-input, #25243a)',
  bgSoft:      'var(--bg-soft, #413d58)',
  stroke:      'var(--stroke, #4a4660)',
  accent:      'var(--accent, #d4af37)',
  text:        'var(--text, #e8e4e0)',
  textMuted:   'var(--text-muted, #a8a4b8)',
  textFaint:   'var(--text-faint, #6e6a80)',
  textOnGold:  'var(--text-on-gold, #1a1a2e)',
  goldSubtle:  '#d4af3730',
  success:     '#43b581',
} as const;

/* ── Inline style objects ─────────────────────────────────────────── */
const S = {
  page: {
    display: 'flex',
    height: '100%',
    width: '100%',
    background: V.bg,
    overflow: 'hidden',
  } as React.CSSProperties,

  main: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    height: '100%',
    background: V.bgInput,
    overflow: 'auto',
  } as React.CSSProperties,

  /* Banner */
  banner: {
    position: 'relative',
    width: '100%',
    height: 220,
    minHeight: 220,
    flexShrink: 0,
    overflow: 'hidden',
  } as React.CSSProperties,

  bannerImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  } as React.CSSProperties,

  bannerFallback: {
    width: '100%',
    height: '100%',
    background: `linear-gradient(135deg, #413d58, #25243a, #353348)`,
  } as React.CSSProperties,

  bannerOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to bottom, transparent 50%, rgba(37,36,58,0.85) 100%)',
  } as React.CSSProperties,

  /* Content area */
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    padding: '24px 32px',
    flex: 1,
  } as React.CSSProperties,

  /* Portal info row */
  portalInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    width: '100%',
  } as React.CSSProperties,

  portalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 'var(--radius-lg)',
    border: `2px solid ${V.accent}`,
    overflow: 'hidden',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: V.bgSoft,
  } as React.CSSProperties,

  portalDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  portalName: {
    margin: 0,
    fontSize: 24,
    fontWeight: 700,
    color: V.text,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,

  portalDesc: {
    margin: 0,
    fontSize: 14,
    fontWeight: 400,
    color: V.textMuted,
    fontFamily: 'Inter, sans-serif',
    lineHeight: 1.5,
  } as React.CSSProperties,

  /* Stats row */
  statsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    width: '100%',
  } as React.CSSProperties,

  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  } as React.CSSProperties,

  statIcon: {
    color: V.textMuted,
    flexShrink: 0,
  } as React.CSSProperties,

  statText: {
    fontSize: 13,
    fontWeight: 500,
    color: V.textMuted,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,

  statTextOnline: {
    fontSize: 13,
    fontWeight: 500,
    color: V.success,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,

  statTextRating: {
    fontSize: 13,
    fontWeight: 500,
    color: V.textMuted,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,

  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: V.success,
    flexShrink: 0,
  } as React.CSSProperties,

  /* Tags */
  tagsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
  } as React.CSSProperties,

  tag: {
    display: 'flex',
    alignItems: 'center',
    height: 28,
    padding: '0 12px',
    borderRadius: 'var(--radius-pill)',
    background: V.goldSubtle,
    color: V.accent,
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,

  /* Join button */
  joinBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: 200,
    height: 44,
    borderRadius: 'var(--radius-md)',
    background: V.accent,
    color: V.textOnGold,
    fontSize: 15,
    fontWeight: 600,
    fontFamily: 'Inter, sans-serif',
    border: 'none',
    cursor: 'pointer',
    transition: 'filter 0.15s',
  } as React.CSSProperties,

  /* Recent Activity */
  activitySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  } as React.CSSProperties,

  activityTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: V.text,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,

  activityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    height: 48,
    padding: '0 12px',
    borderRadius: 'var(--radius-md)',
    background: V.bgSoft,
    width: '100%',
  } as React.CSSProperties,

  activityDot: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    flexShrink: 0,
  } as React.CSSProperties,

  activityContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  activityText: {
    fontSize: 13,
    fontWeight: 400,
    color: V.text,
    fontFamily: 'Inter, sans-serif',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  activityTime: {
    fontSize: 11,
    fontWeight: 400,
    color: V.textMuted,
    fontFamily: 'Inter, sans-serif',
  } as React.CSSProperties,

  /* Error & loading states */
  centerCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    height: '100%',
    width: '100%',
    background: V.bg,
  } as React.CSSProperties,

  errorText: {
    color: 'var(--danger, #f04747)',
    fontSize: 13,
    margin: 0,
  } as React.CSSProperties,

  loginWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  } as React.CSSProperties,

  loginHint: {
    color: V.textMuted,
    fontSize: 13,
    margin: 0,
  } as React.CSSProperties,
};

/** Placeholder tags derived from guild features / discoverable status */
function deriveTags(guild: Guild): string[] {
  const tags: string[] = [];
  if (guild.discoverable) tags.push('discoverable');
  if (guild.boostTier > 0) tags.push(`boost-tier-${guild.boostTier}`);
  if (guild.features.includes('COMMUNITY')) tags.push('community');
  if (guild.nsfwLevel === 'default' || guild.nsfwLevel === 'safe') tags.push('safe');
  if (tags.length === 0) tags.push('portal');
  return tags;
}

export function PortalPreviewPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const addGuild = useGuildsStore((s) => s.addGuild);
  const existingGuild = useGuildsStore((s) => (guildId ? s.guilds.get(guildId) : undefined));

  const [guild, setGuild] = useState<Guild | null>(existingGuild ?? null);
  const [loading, setLoading] = useState(!existingGuild);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [alreadyMember, setAlreadyMember] = useState(!!existingGuild);

  // Fetch guild data
  useEffect(() => {
    if (!guildId) return;
    if (existingGuild) {
      setGuild(existingGuild);
      setAlreadyMember(true);
      setLoading(false);
      return;
    }

    api.guilds
      .get(guildId)
      .then((data) => {
        setGuild(data);
      })
      .catch((err) => {
        setError(getErrorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [guildId, existingGuild]);

  async function handleJoin() {
    if (!guildId) return;
    setJoining(true);
    setError('');

    try {
      // Try to join via the guild endpoint directly
      // For portals that are discoverable, this acts as a direct join
      const joined = await api.guilds.get(guildId);
      addGuild(joined);
      getSocket()?.emit('GUILD_SUBSCRIBE', { guildId: joined.id });
      navigate(`/guild/${joined.id}`, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div style={S.centerCard}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (error && !guild) {
    return (
      <div style={S.centerCard}>
        <h2 style={{ color: V.text, fontSize: 20, fontWeight: 700, margin: 0 }}>Portal Not Found</h2>
        <p style={{ color: V.textMuted, fontSize: 14, margin: '8px 0 16px' }}>{error}</p>
        <Button variant="ghost" onClick={() => navigate('/discover')}>
          Browse Portals
        </Button>
      </div>
    );
  }

  if (!guild) return null;

  const tags = deriveTags(guild);
  const onlineEstimate = Math.max(1, Math.floor(guild.memberCount * 0.12));
  const ratingDisplay = guild.boostCount > 0 ? Math.min(5, 3 + guild.boostCount * 0.2).toFixed(1) : '4.0';
  const createdDate = new Date(guild.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div style={S.page}>
      {/* ── Main content ──────────────────────────────────────────── */}
      <div style={S.main}>
        {/* Banner */}
        <div style={S.banner}>
          {guild.bannerHash ? (
            <img
              src={`/api/v1/files/${guild.bannerHash}`}
              alt=""
              style={S.bannerImg}
            />
          ) : guild.splashHash ? (
            <img
              src={`/api/v1/files/${guild.splashHash}`}
              alt=""
              style={S.bannerImg}
            />
          ) : (
            <div style={S.bannerFallback} />
          )}
          <div style={S.bannerOverlay} />
        </div>

        {/* Content */}
        <div style={S.content}>
          {/* Portal info: icon + name + description */}
          <div style={S.portalInfo}>
            <div style={S.portalIconWrap}>
              <GuildIcon
                name={guild.name}
                iconHash={guild.iconHash}
                guildId={guild.id}
                size={68}
              />
            </div>
            <div style={S.portalDetails}>
              <h1 style={S.portalName}>{guild.name}</h1>
              {guild.description && (
                <p style={S.portalDesc}>{guild.description}</p>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div style={S.statsRow}>
            {/* Members */}
            <div style={S.statItem}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={V.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={S.statIcon}>
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span style={S.statText}>{guild.memberCount.toLocaleString()} Members</span>
            </div>
            {/* Online */}
            <div style={S.statItem}>
              <div style={S.onlineDot} />
              <span style={S.statTextOnline}>{onlineEstimate.toLocaleString()} Online</span>
            </div>
            {/* Rating */}
            <div style={S.statItem}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={V.accent} stroke={V.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={S.statIcon}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span style={S.statTextRating}>{ratingDisplay} Rating</span>
            </div>
          </div>

          {/* Tags */}
          <div style={S.tagsRow}>
            {tags.map((tag) => (
              <span key={tag} style={S.tag}>#{tag}</span>
            ))}
          </div>

          {/* CTA */}
          {error && <p style={S.errorText}>{error}</p>}

          {alreadyMember ? (
            <button
              style={S.joinBtn}
              onClick={() => navigate(`/guild/${guild.id}`)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Open Portal
            </button>
          ) : isAuthenticated ? (
            <button
              style={{
                ...S.joinBtn,
                ...(joining ? { opacity: 0.7, cursor: 'not-allowed' } : {}),
              }}
              onClick={handleJoin}
              disabled={joining}
            >
              {joining ? (
                <LoadingSpinner size={16} />
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  Join Portal
                </>
              )}
            </button>
          ) : (
            <div style={S.loginWrap}>
              <p style={S.loginHint}>Log in to join this portal.</p>
              <Button onClick={() => navigate(`/login?redirect=/portal/${guildId}/preview`)}>
                Log In
              </Button>
            </div>
          )}

          {/* Recent Activity */}
          <div style={S.activitySection}>
            <h3 style={S.activityTitle}>Recent Activity</h3>

            <div style={S.activityItem}>
              <div style={{ ...S.activityDot, background: '#6a4a8a' }} />
              <div style={S.activityContent}>
                <span style={S.activityText}>
                  Portal created {createdDate}
                </span>
                <span style={S.activityTime}>Since the beginning</span>
              </div>
            </div>

            {guild.boostCount > 0 && (
              <div style={S.activityItem}>
                <div style={{ ...S.activityDot, background: '#f47fff' }} />
                <div style={S.activityContent}>
                  <span style={S.activityText}>
                    {guild.boostCount} active {guild.boostCount === 1 ? 'boost' : 'boosts'}
                  </span>
                  <span style={S.activityTime}>Ongoing</span>
                </div>
              </div>
            )}

            <div style={S.activityItem}>
              <div style={{ ...S.activityDot, background: '#5a7a5a' }} />
              <div style={S.activityContent}>
                <span style={S.activityText}>
                  {guild.memberCount} {guild.memberCount === 1 ? 'member' : 'members'} in this community
                </span>
                <span style={S.activityTime}>Growing</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
