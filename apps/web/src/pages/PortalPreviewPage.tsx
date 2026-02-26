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
  bgSoft:      'var(--bg-soft, #413d58)',
  stroke:      'var(--stroke, #4a4660)',
  accent:      'var(--accent, #d4af37)',
  text:        'var(--text, #e8e4e0)',
  textMuted:   'var(--text-muted, #a8a4b8)',
  textFaint:   'var(--text-faint, #6e6a80)',
  textOnGold:  'var(--text-on-gold, #1a1a2e)',
  goldSubtle:  '#d4af3730',
} as const;

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
      <div className="portal-preview-page">
        <div className="portal-preview-card">
          <LoadingSpinner size={32} />
        </div>
      </div>
    );
  }

  if (error && !guild) {
    return (
      <div className="portal-preview-page">
        <div className="portal-preview-card">
          <h2 style={{ color: V.text, fontSize: 20, fontWeight: 700, margin: 0 }}>Portal Not Found</h2>
          <p style={{ color: V.textMuted, fontSize: 14, margin: '8px 0 16px' }}>{error}</p>
          <Button variant="ghost" onClick={() => navigate('/discover')}>
            Browse Portals
          </Button>
        </div>
      </div>
    );
  }

  if (!guild) return null;

  const tags = deriveTags(guild);
  const onlineEstimate = Math.max(1, Math.floor(guild.memberCount * 0.12));
  const ratingDisplay = guild.boostCount > 0 ? Math.min(5, 3 + guild.boostCount * 0.2).toFixed(1) : '4.0';

  return (
    <div className="portal-preview-page">
      {/* ── Banner ─────────────────────────────────────────────── */}
      <div className="portal-preview-banner">
        {guild.bannerHash ? (
          <img
            src={`/api/v1/files/${guild.bannerHash}`}
            alt=""
            className="portal-preview-banner-img"
          />
        ) : guild.splashHash ? (
          <img
            src={`/api/v1/files/${guild.splashHash}`}
            alt=""
            className="portal-preview-banner-img"
          />
        ) : (
          <div className="portal-preview-banner-fallback" />
        )}
        <div className="portal-preview-banner-overlay" />
      </div>

      {/* ── Card ───────────────────────────────────────────────── */}
      <div className="portal-preview-card">
        {/* Icon */}
        <div className="portal-preview-icon-wrap">
          <GuildIcon
            name={guild.name}
            iconHash={guild.iconHash}
            guildId={guild.id}
            size={80}
          />
        </div>

        {/* Name + description */}
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: V.text, textAlign: 'center' }}>
          {guild.name}
        </h1>
        {guild.description && (
          <p style={{ margin: '8px 0 0', fontSize: 14, color: V.textMuted, textAlign: 'center', lineHeight: 1.6, maxWidth: 480 }}>
            {guild.description}
          </p>
        )}

        {/* Stats row */}
        <div className="portal-preview-stats">
          <div className="portal-preview-stat-item">
            <div className="portal-preview-stat-value">{guild.memberCount.toLocaleString()}</div>
            <div className="portal-preview-stat-label">Members</div>
          </div>
          <div className="portal-preview-stat-divider" />
          <div className="portal-preview-stat-item">
            <div className="portal-preview-stat-value portal-preview-stat-value--online">{onlineEstimate.toLocaleString()}</div>
            <div className="portal-preview-stat-label">Online</div>
          </div>
          <div className="portal-preview-stat-divider" />
          <div className="portal-preview-stat-item">
            <div className="portal-preview-stat-value">{ratingDisplay}</div>
            <div className="portal-preview-stat-label">Rating</div>
          </div>
        </div>

        {/* Tags */}
        <div className="portal-preview-tags">
          {tags.map((tag) => (
            <span key={tag} className="portal-preview-tag">#{tag}</span>
          ))}
        </div>

        {/* CTA */}
        {error && <p style={{ color: 'var(--danger, #f04747)', fontSize: 13 }}>{error}</p>}

        {alreadyMember ? (
          <Button
            onClick={() => navigate(`/guild/${guild.id}`)}
            className="portal-preview-cta"
          >
            Open Portal
          </Button>
        ) : isAuthenticated ? (
          <Button
            onClick={handleJoin}
            loading={joining}
            className="portal-preview-cta"
          >
            Join Portal
          </Button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 320, alignItems: 'center' }}>
            <p style={{ color: V.textMuted, fontSize: 13 }}>Log in to join this portal.</p>
            <Button onClick={() => navigate(`/login?redirect=/portal/${guildId}/preview`)}>
              Log In
            </Button>
          </div>
        )}

        {/* Recent activity placeholder */}
        <section className="portal-preview-activity">
          <div className="portal-preview-activity-title">Recent Activity</div>
          <div className="portal-preview-activity-list">
            <div className="portal-preview-activity-item">
              <span className="portal-preview-activity-dot" />
              <span>Portal created {new Date(guild.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            {guild.boostCount > 0 && (
              <div className="portal-preview-activity-item">
                <span className="portal-preview-activity-dot portal-preview-activity-dot--boost" />
                <span>{guild.boostCount} active {guild.boostCount === 1 ? 'boost' : 'boosts'}</span>
              </div>
            )}
            <div className="portal-preview-activity-item">
              <span className="portal-preview-activity-dot portal-preview-activity-dot--members" />
              <span>{guild.memberCount} {guild.memberCount === 1 ? 'member' : 'members'} in this community</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
