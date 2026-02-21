import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { useUiStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { useGuildsStore } from '@/stores/guilds.store';

export function EditServerProfileModal() {
  const activeModal = useUiStore((s) => s.activeModal);
  const modalData = useUiStore((s) => s.modalData);
  const closeModal = useUiStore((s) => s.closeModal);
  const user = useAuthStore((s) => s.user);
  const guilds = useGuildsStore((s) => s.guilds);

  const guildId = (modalData?.['guildId'] as string | undefined) ?? undefined;
  const guildName = guildId ? guilds.get(guildId)?.name ?? 'Server' : 'Server';

  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [avatarHash, setAvatarHash] = useState<string | null>(null);
  const [bannerHash, setBannerHash] = useState<string | null>(null);
  const [initial, setInitial] = useState({ nickname: '', bio: '' });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeModal !== 'edit-server-profile' || !guildId || !user) return;
    setLoadingProfile(true);
    setError('');
    api.profiles.getMemberProfile(guildId, user.id)
      .then((profile) => {
        const next = {
          nickname: profile?.nickname ?? '',
          bio: profile?.bio ?? '',
        };
        setNickname(next.nickname);
        setBio(next.bio);
        setAvatarHash(profile?.avatarHash ?? null);
        setBannerHash(profile?.bannerHash ?? null);
        setInitial(next);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoadingProfile(false));
  }, [activeModal, guildId, user]);

  function handleClose() {
    closeModal();
    setError('');
    setSaving(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!guildId) return;
    setError('');
    setSaving(true);
    try {
      const payload: { nickname?: string | null; bio?: string | null } = {};
      if (nickname.trim() !== initial.nickname) {
        payload.nickname = nickname.trim() || null;
      }
      if (bio.trim() !== initial.bio) {
        payload.bio = bio.trim() || null;
      }
      if (Object.keys(payload).length > 0) {
        await api.profiles.updateMemberProfile(guildId, payload);
        setInitial({ nickname: payload.nickname ?? nickname.trim(), bio: payload.bio ?? bio.trim() });
      }
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(file: File | null) {
    if (!file || !guildId) return;
    setUploadingAvatar(true);
    setError('');
    try {
      const profile = await api.profiles.uploadMemberAvatar(guildId, file);
      setAvatarHash(profile?.avatarHash ?? null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleBannerUpload(file: File | null) {
    if (!file || !guildId) return;
    setUploadingBanner(true);
    setError('');
    try {
      const profile = await api.profiles.uploadMemberBanner(guildId, file);
      setBannerHash(profile?.bannerHash ?? null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handleAvatarRemove() {
    if (!guildId) return;
    setUploadingAvatar(true);
    setError('');
    try {
      const profile = await api.profiles.deleteMemberAvatar(guildId);
      setAvatarHash(profile?.avatarHash ?? null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleBannerRemove() {
    if (!guildId) return;
    setUploadingBanner(true);
    setError('');
    try {
      const profile = await api.profiles.deleteMemberBanner(guildId);
      setBannerHash(profile?.bannerHash ?? null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingBanner(false);
    }
  }

  return (
    <Modal id="edit-server-profile" title={`${guildName} Profile`} onClose={handleClose} size="md">
      <form className="modal-form" onSubmit={handleSubmit}>
        {error && <div className="modal-error">{error}</div>}

        <div className="profile-modal-header">
          {user && (
            <Avatar
              name={nickname || user.displayName}
              hash={avatarHash ?? user.avatarHash ?? null}
              userId={user.id}
              size={48}
            />
          )}
          <div className="profile-modal-header-text">
            <span className="profile-modal-name">Server Profile</span>
            <span className="profile-modal-subtitle">Overrides your defaults in {guildName}.</span>
          </div>
        </div>

        <Input
          label="Nickname"
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Optional nickname"
          maxLength={32}
          disabled={loadingProfile}
        />

        <div className="input-group">
          <label className="input-label">Bio</label>
          <div className="input-wrapper">
            <textarea
              className="input-field profile-bio-input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Server-specific bio"
              maxLength={190}
              rows={3}
              disabled={loadingProfile}
            />
          </div>
        </div>

        <div className="profile-media-grid">
          <div className="profile-media-card">
            <div className="profile-media-preview">
              {user && (
                <Avatar
                  name={nickname || user.displayName}
                  hash={avatarHash ?? user.avatarHash ?? null}
                  userId={user.id}
                  size={56}
                />
              )}
              <div>
                <div className="profile-media-title">Server Avatar</div>
                <div className="profile-media-subtitle">Only visible in {guildName}.</div>
              </div>
            </div>
            <div className="profile-media-actions">
              <label className="btn btn-ghost btn-sm">
                {uploadingAvatar ? 'Uploading...' : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  className="file-input"
                  onChange={(e) => handleAvatarUpload(e.target.files?.[0] ?? null)}
                  disabled={uploadingAvatar}
                />
              </label>
              <button className="btn btn-danger btn-sm" onClick={handleAvatarRemove} disabled={uploadingAvatar || !avatarHash}>
                Remove
              </button>
            </div>
          </div>

          <div className="profile-media-card">
            <div className="profile-banner-preview" style={bannerHash ? { backgroundImage: `url(/api/v1/files/${bannerHash})` } : undefined}>
              {!bannerHash && <span className="profile-banner-placeholder">No banner set</span>}
            </div>
            <div className="profile-media-actions">
              <label className="btn btn-ghost btn-sm">
                {uploadingBanner ? 'Uploading...' : 'Upload Banner'}
                <input
                  type="file"
                  accept="image/*"
                  className="file-input"
                  onChange={(e) => handleBannerUpload(e.target.files?.[0] ?? null)}
                  disabled={uploadingBanner}
                />
              </label>
              <button className="btn btn-danger btn-sm" onClick={handleBannerRemove} disabled={uploadingBanner || !bannerHash}>
                Remove
              </button>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <Button variant="ghost" type="button" onClick={handleClose}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={loadingProfile}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
