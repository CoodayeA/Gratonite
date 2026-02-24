import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { GuildIcon } from '@/components/ui/GuildIcon';
import { api } from '@/lib/api';
import { useUiStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { getErrorMessage } from '@/lib/utils';

interface OverviewSectionProps {
  guildId: string;
}

export function OverviewSection({ guildId }: OverviewSectionProps) {
  const openModal = useUiStore((s) => s.openModal);
  const guilds = useGuildsStore((s) => s.guilds);
  const updateGuildStore = useGuildsStore((s) => s.updateGuild);
  const queryClient = useQueryClient();

  const guild = guilds.get(guildId);
  const guildName = guild?.name ?? 'Portal';

  const [error, setError] = useState('');
  const [uploadingGuildIcon, setUploadingGuildIcon] = useState(false);
  const [uploadingGuildBanner, setUploadingGuildBanner] = useState(false);

  async function handleGuildIconUpload(file: File | null) {
    if (!file) return;
    setError('');
    setUploadingGuildIcon(true);
    try {
      const result = await api.guilds.uploadIcon(guildId, file);
      updateGuildStore(guildId, {
        iconHash: result.iconHash,
        iconAnimated: result.iconAnimated,
      });
      await queryClient.invalidateQueries({ queryKey: ['guilds', '@me'] });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingGuildIcon(false);
    }
  }

  async function handleGuildIconRemove() {
    setError('');
    setUploadingGuildIcon(true);
    try {
      await api.guilds.deleteIcon(guildId);
      updateGuildStore(guildId, { iconHash: null, iconAnimated: false });
      await queryClient.invalidateQueries({ queryKey: ['guilds', '@me'] });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingGuildIcon(false);
    }
  }

  async function handleGuildBannerUpload(file: File | null) {
    if (!file) return;
    setError('');
    setUploadingGuildBanner(true);
    try {
      const result = await api.guilds.uploadBanner(guildId, file);
      updateGuildStore(guildId, {
        bannerHash: result.bannerHash,
        bannerAnimated: result.bannerAnimated,
      });
      await queryClient.invalidateQueries({ queryKey: ['guilds', '@me'] });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingGuildBanner(false);
    }
  }

  async function handleGuildBannerRemove() {
    setError('');
    setUploadingGuildBanner(true);
    try {
      await api.guilds.deleteBanner(guildId);
      updateGuildStore(guildId, { bannerHash: null, bannerAnimated: false });
      await queryClient.invalidateQueries({ queryKey: ['guilds', '@me'] });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingGuildBanner(false);
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-shell-section-heading">Overview</h2>
      <p className="server-settings-muted">
        Configure this portal's profile and media settings.
      </p>

      {error && <div className="modal-error">{error}</div>}

      <div className="profile-media-grid">
        <div className="profile-media-card">
          <div className="profile-media-preview">
            <GuildIcon
              name={guildName}
              iconHash={guild?.iconHash ?? null}
              guildId={guildId}
              size={56}
            />
            <div>
              <div className="profile-media-title">Portal Icon</div>
              <div className="profile-media-subtitle">Shown in portal rail and gallery.</div>
            </div>
          </div>
          <div className="profile-media-actions">
            <label className="btn btn-ghost btn-sm">
              {uploadingGuildIcon ? 'Uploading...' : 'Upload'}
              <input
                type="file"
                accept="image/*"
                className="file-input"
                onChange={(e) => handleGuildIconUpload(e.target.files?.[0] ?? null)}
                disabled={uploadingGuildIcon}
              />
            </label>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleGuildIconRemove}
              disabled={uploadingGuildIcon || !guild?.iconHash}
            >
              Remove
            </button>
          </div>
        </div>

        <div className="profile-media-card">
          <div
            className="profile-banner-preview"
            style={
              guild?.bannerHash
                ? { backgroundImage: `url(/api/v1/files/${guild.bannerHash})` }
                : undefined
            }
          >
            {!guild?.bannerHash && <span className="profile-banner-placeholder">No banner set</span>}
          </div>
          <div className="profile-media-actions">
            <label className="btn btn-ghost btn-sm">
              {uploadingGuildBanner ? 'Uploading...' : 'Upload Banner'}
              <input
                type="file"
                accept="image/*"
                className="file-input"
                onChange={(e) => handleGuildBannerUpload(e.target.files?.[0] ?? null)}
                disabled={uploadingGuildBanner}
              />
            </label>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleGuildBannerRemove}
              disabled={uploadingGuildBanner || !guild?.bannerHash}
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      <div className="server-settings-actions" style={{ marginTop: 16 }}>
        <Button onClick={() => openModal('settings', { type: 'server', guildId, initialSection: 'overview' })}>
          Open Portal Profile
        </Button>
      </div>
    </section>
  );
}
