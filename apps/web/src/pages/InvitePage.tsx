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
      <div className="invite-page">
        <div className="invite-card">
          <LoadingSpinner size={32} />
        </div>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="invite-page">
        <div className="invite-card">
          <div className="invite-error-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--danger, #f04747)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 className="invite-heading">Invalid Invite</h2>
          <p className="invite-error">{error}</p>
          <p className="invite-subtext">
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
    <div className="invite-page">
      <div className="invite-card">
        {/* Inviter line */}
        {invite.inviter && (
          <p className="invite-inviter">
            <strong>{invite.inviter.displayName}</strong> invited you to join
          </p>
        )}

        {/* Guild icon */}
        <GuildIcon
          name={invite.guild.name}
          iconHash={invite.guild.iconHash}
          guildId={invite.guild.id}
          size={80}
          className="invite-guild-icon"
        />

        {/* Guild name */}
        <h2 className="invite-guild-name">{invite.guild.name}</h2>

        {/* Description */}
        {invite.guild.description && (
          <p className="invite-description">{invite.guild.description}</p>
        )}

        {/* Stats */}
        <div className="invite-stats">
          <div className="invite-stat-chip">
            <span className="invite-stat-dot invite-stat-dot--members" />
            {invite.guild.memberCount} {invite.guild.memberCount === 1 ? 'Member' : 'Members'}
          </div>
          {expiresLabel && (
            <div className="invite-stat-chip invite-stat-chip--expiry">
              {expiresLabel}
            </div>
          )}
        </div>

        {/* Error */}
        {error && <p className="invite-error">{error}</p>}

        {/* Actions */}
        {isAuthenticated ? (
          <Button onClick={handleAccept} loading={accepting} className="invite-accept-btn">
            Accept Invite
          </Button>
        ) : (
          <div className="invite-auth-prompt">
            <p>You need to log in to accept this invite.</p>
            <div className="invite-auth-buttons">
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
