import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, ApiRequestError } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { GuildIcon } from '@/components/ui/GuildIcon';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

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
        if (err instanceof ApiRequestError) {
          setError(err.message);
        } else {
          setError('Failed to load invite. It may be invalid or expired.');
        }
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
      navigate(`/guild/${guild.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to accept invite.');
      }
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
          <h2>Invalid Invite</h2>
          <p className="invite-error">{error}</p>
          <Link to="/">
            <Button variant="ghost">Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  return (
    <div className="invite-page">
      <div className="invite-card">
        {invite.inviter && (
          <p className="invite-inviter">
            <strong>{invite.inviter.displayName}</strong> invited you to join
          </p>
        )}

        <GuildIcon
          name={invite.guild.name}
          iconHash={invite.guild.iconHash}
          guildId={invite.guild.id}
          size={80}
          className="invite-guild-icon"
        />

        <h2 className="invite-guild-name">{invite.guild.name}</h2>

        {invite.guild.description && (
          <p className="invite-description">{invite.guild.description}</p>
        )}

        <div className="invite-stats">
          <span className="invite-member-count">
            {invite.guild.memberCount} {invite.guild.memberCount === 1 ? 'Member' : 'Members'}
          </span>
        </div>

        {error && <p className="invite-error">{error}</p>}

        {isAuthenticated ? (
          <Button onClick={handleAccept} loading={accepting} className="invite-accept-btn">
            Accept Invite
          </Button>
        ) : (
          <div className="invite-auth-prompt">
            <p>You need to log in to accept this invite.</p>
            <Link to={`/login?redirect=/invite/${code}`}>
              <Button>Log In</Button>
            </Link>
            <Link to={`/register?redirect=/invite/${code}`}>
              <Button variant="ghost">Register</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
