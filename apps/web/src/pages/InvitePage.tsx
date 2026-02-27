import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { GuildIcon } from '@/components/ui/GuildIcon';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getSocket } from '@/lib/socket';

interface InvitePreview {
  code: string;
  guild: {
    id: string;
    name: string;
    iconHash: string | null;
    memberCount: number;
    description: string | null;
  };
  inviter?: { id: string; username: string; displayName: string; avatarHash: string | null };
  expiresAt: string | null;
}

/* ── Style objects ──────────────────────────────────────────────── */

const styles = {
  page: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100%',
    background: '#2c2c3e',
    padding: 24,
  } as React.CSSProperties,

  card: {
    background: '#353348',
    borderRadius: 'var(--radius-lg)',
    padding: 40,
    maxWidth: 420,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
  } as React.CSSProperties,

  inviter: {
    fontSize: 14,
    color: '#a8a4b8',
    margin: '0 0 16px',
  } as React.CSSProperties,

  inviterStrong: {
    color: '#e8e4e0',
    fontWeight: 600,
  } as React.CSSProperties,

  guildIconWrap: {
    marginBottom: 16,
  } as React.CSSProperties,

  guildName: {
    fontSize: 22,
    fontWeight: 700,
    color: '#e8e4e0',
    margin: '0 0 8px',
  } as React.CSSProperties,

  description: {
    fontSize: 14,
    color: '#a8a4b8',
    margin: '0 0 16px',
    lineHeight: 1.5,
  } as React.CSSProperties,

  stats: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  } as React.CSSProperties,

  statChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: '#a8a4b8',
    background: '#25243a',
    padding: '5px 12px',
    borderRadius: 'var(--radius-lg)',
  } as React.CSSProperties,

  statDotMembers: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#43b581',
    flexShrink: 0,
  } as React.CSSProperties,

  statDotExpiry: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: '#d4af37',
    flexShrink: 0,
  } as React.CSSProperties,

  error: {
    fontSize: 14,
    color: '#f04747',
    margin: '0 0 12px',
  } as React.CSSProperties,

  acceptBtn: {
    width: '100%',
    padding: '12px 0',
    background: '#d4af37',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,

  authPrompt: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  } as React.CSSProperties,

  authPromptText: {
    fontSize: 14,
    color: '#a8a4b8',
    margin: 0,
  } as React.CSSProperties,

  authButtons: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
  } as React.CSSProperties,

  errorIcon: {
    marginBottom: 16,
  } as React.CSSProperties,

  heading: {
    fontSize: 22,
    fontWeight: 700,
    color: '#e8e4e0',
    margin: '0 0 8px',
  } as React.CSSProperties,

  subtext: {
    fontSize: 13,
    color: '#6e6a80',
    margin: '0 0 20px',
    lineHeight: 1.5,
  } as React.CSSProperties,
} as const;

/* ── Component ──────────────────────────────────────────────────── */

export function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const addGuild = useGuildsStore((s) => s.addGuild);

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;

    api.invites
      .get(code)
      .then((data) => setInvite(data))
      .catch((err) => {
        setError(getErrorMessage(err));
      })
      .finally(() => setLoading(false));
  }, [code]);

  async function handleAccept() {
    if (!code) return;
    setAccepting(true);
    setError('');

    try {
      const guild = await api.invites.accept(code);
      addGuild(guild);
      getSocket()?.emit('GUILD_SUBSCRIBE', { guildId: guild.id });
      navigate(`/guild/${guild.id}`, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <LoadingSpinner size={32} />
        </div>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f04747" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 style={styles.heading}>Invalid Invite</h2>
          <p style={styles.error}>{error}</p>
          <p style={styles.subtext}>
            This invite may have expired, been revoked, or the link may be incorrect.
          </p>
          <Link to="/">
            <Button variant="ghost">Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  const expiresLabel = invite.expiresAt
    ? `Expires ${new Date(invite.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : null;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Inviter line */}
        {invite.inviter && (
          <p style={styles.inviter}>
            <strong style={styles.inviterStrong}>{invite.inviter.displayName}</strong> invited you to join
          </p>
        )}

        {/* Guild icon */}
        <div style={styles.guildIconWrap}>
          <GuildIcon
            name={invite.guild.name}
            iconHash={invite.guild.iconHash}
            guildId={invite.guild.id}
            size={80}
          />
        </div>

        {/* Guild name */}
        <h2 style={styles.guildName}>{invite.guild.name}</h2>

        {/* Description */}
        {invite.guild.description && (
          <p style={styles.description}>{invite.guild.description}</p>
        )}

        {/* Stats */}
        <div style={styles.stats}>
          <div style={styles.statChip}>
            <span style={styles.statDotMembers} />
            {invite.guild.memberCount} {invite.guild.memberCount === 1 ? 'Member' : 'Members'}
          </div>
          {expiresLabel && (
            <div style={styles.statChip}>
              <span style={styles.statDotExpiry} />
              {expiresLabel}
            </div>
          )}
        </div>

        {/* Error */}
        {error && <p style={styles.error}>{error}</p>}

        {/* Actions */}
        {isAuthenticated ? (
          <Button onClick={handleAccept} loading={accepting} style={styles.acceptBtn}>
            Accept Invite
          </Button>
        ) : (
          <div style={styles.authPrompt}>
            <p style={styles.authPromptText}>You need to log in to accept this invite.</p>
            <div style={styles.authButtons}>
              <Link to={`/login?redirect=/invite/${code}`}>
                <Button>Log In</Button>
              </Link>
              <Link to={`/register?redirect=/invite/${code}`}>
                <Button variant="ghost">Register</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
