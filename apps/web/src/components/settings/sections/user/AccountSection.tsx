import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { api } from '@/lib/api';
import { getAvatarDecorationById, getProfileEffectById } from '@/lib/profileCosmetics';

const styles = {
  section: {
    maxWidth: 720,
  } as React.CSSProperties,
  profileCard: {
    position: 'relative',
    background: 'var(--bg-float)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    marginBottom: 20,
  } as React.CSSProperties,
  profileBanner: {
    height: 120,
    background: 'linear-gradient(120deg, rgba(212, 175, 55, 0.2), rgba(255, 160, 122, 0.2))',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  } as React.CSSProperties,
  profileEffect: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0.35,
    pointerEvents: 'none',
  } as React.CSSProperties,
  profileBody: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    position: 'relative',
    zIndex: 1,
  } as React.CSSProperties,
  profileAvatar: {
    border: '2px solid rgba(6, 10, 18, 0.7)',
  } as React.CSSProperties,
  profileInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
  } as React.CSSProperties,
  profileName: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
  } as React.CSSProperties,
  profileUsername: {
    fontSize: 13,
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 12,
  } as React.CSSProperties,
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as React.CSSProperties,
  fieldLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  fieldValue: {
    fontSize: 14,
    color: 'var(--text)',
  } as React.CSSProperties,
  card: {
    background: 'var(--bg-float)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-lg)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  } as React.CSSProperties,
  fieldControl: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,
  fieldRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  } as React.CSSProperties,
};

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
          displayName: me.profile?.displayName ?? me.username,
          avatarHash: me.profile?.avatarHash ?? null,
          bannerHash: me.profile?.bannerHash ?? null,
        });
        updateUser({
          avatarDecorationId: me.profile?.avatarDecorationId ?? null,
          profileEffectId: me.profile?.profileEffectId ?? null,
          nameplateId: me.profile?.nameplateId ?? null,
        });
      })
      .catch(() => undefined);
  }, [updateUser]);

  if (!user) return null;

  const bannerStyle = profile?.bannerHash
    ? { ...styles.profileBanner, backgroundImage: `url(/api/v1/files/${profile.bannerHash})` }
    : styles.profileBanner;

  const equippedAvatarDecoration = getAvatarDecorationById(user.avatarDecorationId);
  const equippedProfileEffect = getProfileEffectById(user.profileEffectId);
  const isBugInboxAdmin = user.username === 'ferdinand' || user.username === 'coodaye';

  return (
    <section style={styles.section}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        paddingBottom: 16,
        borderBottom: '1px solid var(--stroke)',
        marginBottom: 8,
      }}>
        <h2 style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--text)',
          margin: 0,
          fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
        }}>
          My Account
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Manage your account settings and preferences.
        </p>
      </div>

      <div style={styles.profileCard}>
        <div style={bannerStyle} />
        {equippedProfileEffect && (
          <img
            src={`/api/v1/files/${equippedProfileEffect.assetHash}`}
            alt=""
            style={styles.profileEffect}
            aria-hidden="true"
          />
        )}
        <div style={styles.profileBody}>
          <Avatar
            name={profile?.displayName ?? user.displayName}
            hash={profile?.avatarHash ?? user.avatarHash}
            decorationHash={equippedAvatarDecoration?.assetHash ?? null}
            userId={user.id}
            size={64}
            className="settings-profile-avatar"
          />
          <div style={styles.profileInfo}>
            <div style={styles.profileName}>{profile?.displayName ?? user.displayName}</div>
            <div style={styles.profileUsername}>@{user.username}</div>
          </div>
          <Button variant="ghost" onClick={() => openModal('settings', { type: 'user', initialSection: 'profile' })}>
            Edit Profile
          </Button>
        </div>
      </div>

      <div style={styles.fieldGrid}>
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Email</div>
          <div style={styles.fieldValue}>{user.email}</div>
        </div>
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Display Name</div>
          <div style={styles.fieldValue}>{profile?.displayName ?? user.displayName}</div>
        </div>
        <div style={styles.field}>
          <div style={styles.fieldLabel}>User ID</div>
          <div style={styles.fieldValue}>{user.id}</div>
        </div>
      </div>

      {isBugInboxAdmin && (
        <div style={styles.card}>
          <div style={styles.field}>
            <div style={styles.fieldLabel}>Ops Tools</div>
            <div style={styles.fieldValue}>
              Internal triage tools for beta testing and bug review.
            </div>
          </div>
          <div style={styles.fieldRow}>
            <Link to="/ops/bugs">
              <Button>Open Bug Inbox</Button>
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
