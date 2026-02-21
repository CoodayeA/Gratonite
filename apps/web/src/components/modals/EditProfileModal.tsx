import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { useUiStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';

export function EditProfileModal() {
  const activeModal = useUiStore((s) => s.activeModal);
  const closeModal = useUiStore((s) => s.closeModal);
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [avatarHash, setAvatarHash] = useState<string | null>(null);
  const [bannerHash, setBannerHash] = useState<string | null>(null);
  const [initial, setInitial] = useState({ displayName: '', bio: '', pronouns: '' });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (activeModal !== 'edit-profile') return;
    setLoadingProfile(true);
    setError('');
    api.users.getMe()
      .then((me) => {
        const next = {
          displayName: me.profile?.displayName ?? user?.displayName ?? '',
          bio: me.profile?.bio ?? '',
          pronouns: me.profile?.pronouns ?? '',
        };
        setDisplayName(next.displayName);
        setBio(next.bio);
        setPronouns(next.pronouns);
        setAvatarHash(me.profile?.avatarHash ?? user?.avatarHash ?? null);
        setBannerHash(me.profile?.bannerHash ?? null);
        setInitial(next);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoadingProfile(false));
  }, [activeModal, user?.displayName]);

  function handleClose() {
    closeModal();
    setError('');
    setSaving(false);
  }

  async function handleAvatarUpload(file: File | null) {
    if (!file) return;
    setUploadingAvatar(true);
    setError('');
    try {
      const result = await api.users.uploadAvatar(file);
      setAvatarHash(result.avatarHash);
      updateUser({ avatarHash: result.avatarHash });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleBannerUpload(file: File | null) {
    if (!file) return;
    setUploadingBanner(true);
    setError('');
    try {
      const result = await api.users.uploadBanner(file);
      setBannerHash(result.bannerHash);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handleAvatarRemove() {
    setUploadingAvatar(true);
    setError('');
    try {
      await api.users.deleteAvatar();
      setAvatarHash(null);
      updateUser({ avatarHash: null });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleBannerRemove() {
    setUploadingBanner(true);
    setError('');
    try {
      await api.users.deleteBanner();
      setBannerHash(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setError('');
    setSaving(true);
    try {
      const payload: { displayName?: string; bio?: string; pronouns?: string } = {};
      if (displayName.trim() !== initial.displayName) payload.displayName = displayName.trim();
      if (bio.trim() !== initial.bio) payload.bio = bio.trim();
      if (pronouns.trim() !== initial.pronouns) payload.pronouns = pronouns.trim();

      if (Object.keys(payload).length > 0) {
        await api.users.updateProfile(payload);
        if (payload.displayName) {
          updateUser({ displayName: payload.displayName });
        }
        setInitial({
          displayName: payload.displayName ?? displayName.trim(),
          bio: payload.bio ?? bio.trim(),
          pronouns: payload.pronouns ?? pronouns.trim(),
        });
      }
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal id="edit-profile" title="Edit Profile" onClose={handleClose} size="md">
      <form className="modal-form" onSubmit={handleSubmit}>
        {error && <div className="modal-error">{error}</div>}

        <div className="profile-modal-header">
          {user && (
            <Avatar
              name={displayName || user.displayName}
              hash={avatarHash ?? null}
              userId={user.id}
              size={48}
            />
          )}
          <div className="profile-modal-header-text">
            <span className="profile-modal-name">{displayName || user?.displayName}</span>
            <span className="profile-modal-subtitle">Update your profile details</span>
          </div>
        </div>

        <Input
          label="Display Name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your display name"
          maxLength={32}
          required
          disabled={loadingProfile}
        />

        <div className="profile-media-grid">
          <div className="profile-media-card">
            <div className="profile-media-preview">
              {user && (
                <Avatar
                  name={displayName || user.displayName}
                  hash={avatarHash ?? null}
                  userId={user.id}
                  size={56}
                />
              )}
              <div>
                <div className="profile-media-title">Default Avatar</div>
                <div className="profile-media-subtitle">Used unless overridden per server.</div>
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

        <div className="input-group">
          <label className="input-label">Bio</label>
          <div className="input-wrapper">
            <textarea
              className="input-field profile-bio-input"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people a little about you"
              maxLength={190}
              rows={3}
              disabled={loadingProfile}
            />
          </div>
        </div>

        <Input
          label="Pronouns"
          type="text"
          value={pronouns}
          onChange={(e) => setPronouns(e.target.value)}
          placeholder="she/her, they/them, etc."
          maxLength={40}
          disabled={loadingProfile}
        />

        <div className="profile-avatar-note">
          Per-server nickname, avatar, and banner overrides live in the server profile menu.
        </div>

        <div className="modal-footer">
          <Button variant="ghost" type="button" onClick={handleClose}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={loadingProfile || !displayName.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
