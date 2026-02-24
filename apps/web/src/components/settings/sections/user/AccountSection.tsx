import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { api } from '@/lib/api';
import { getAvatarDecorationById, getProfileEffectById } from '@/lib/profileCosmetics';

export function AccountSection() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const openModal = useUiStore((s) => s.openModal);

  const [profile, setProfile] = useState<{
    displayName: string;
    avatarHash: string | null;
    bannerHash: string | null;
  } | null>(null);

  useEffect(() => {
    api.users
      .getMe()
      .then((me) => {
        setProfile({
          displayName: me.profile.displayName,
          avatarHash: me.profile.avatarHash,
          bannerHash: me.profile.bannerHash,
        });
        updateUser({
          avatarDecorationId: me.profile.avatarDecorationId ?? null,
          profileEffectId: me.profile.profileEffectId ?? null,
          nameplateId: me.profile.nameplateId ?? null,
        });
      })
      .catch(() => undefined);
  }, [updateUser]);

  if (!user) return null;

  const bannerStyle = profile?.bannerHash
    ? { backgroundImage: `url(/api/v1/files/${profile.bannerHash})` }
    : undefined;

  const equippedAvatarDecoration = getAvatarDecorationById(user.avatarDecorationId);
  const equippedProfileEffect = getProfileEffectById(user.profileEffectId);
  const isBugInboxAdmin = user.username === 'ferdinand' || user.username === 'coodaye';

  return (
    <section className="settings-section">
      <h2 className="settings-shell-section-heading">My Account</h2>

      <div className="settings-profile-card">
        <div className="settings-profile-banner" style={bannerStyle} />
        {equippedProfileEffect && (
          <img
            src={`/api/v1/files/${equippedProfileEffect.assetHash}`}
            alt=""
            className="settings-profile-effect"
            aria-hidden="true"
          />
        )}
        <div className="settings-profile-body">
          <Avatar
            name={profile?.displayName ?? user.displayName}
            hash={profile?.avatarHash ?? user.avatarHash}
            decorationHash={equippedAvatarDecoration?.assetHash ?? null}
            userId={user.id}
            size={64}
            className="settings-profile-avatar"
          />
          <div className="settings-profile-info">
            <div className="settings-profile-name">{profile?.displayName ?? user.displayName}</div>
            <div className="settings-profile-username">@{user.username}</div>
          </div>
          <Button variant="ghost" onClick={() => openModal('settings', { type: 'user', initialSection: 'profile' })}>
            Edit Profile
          </Button>
        </div>
      </div>

      <div className="settings-field-grid">
        <div className="settings-field">
          <div className="settings-field-label">Email</div>
          <div className="settings-field-value">{user.email}</div>
        </div>
        <div className="settings-field">
          <div className="settings-field-label">Display Name</div>
          <div className="settings-field-value">{profile?.displayName ?? user.displayName}</div>
        </div>
        <div className="settings-field">
          <div className="settings-field-label">User ID</div>
          <div className="settings-field-value">{user.id}</div>
        </div>
      </div>

      {isBugInboxAdmin && (
        <div className="settings-card">
          <div className="settings-field">
            <div className="settings-field-label">Ops Tools</div>
            <div className="settings-field-value">
              Internal triage tools for beta testing and bug review.
            </div>
          </div>
          <div className="settings-field-control settings-field-row">
            <Link to="/ops/bugs">
              <Button>Open Bug Inbox</Button>
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
