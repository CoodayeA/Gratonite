import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { GuildIcon } from '@/components/ui/GuildIcon';
import { api } from '@/lib/api';
import { useUiStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { getErrorMessage } from '@/lib/utils';

const styles = {
  section: {
    maxWidth: 720,
  } as React.CSSProperties,
  heading: {
    fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 4,
  } as React.CSSProperties,
  muted: {
    fontSize: 13,
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  modalError: {
    padding: '10px 14px',
    background: 'var(--danger-bg)',
    border: '1px solid rgba(255, 107, 107, 0.25)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--danger)',
    fontSize: 13,
  } as React.CSSProperties,
  mediaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12,
  } as React.CSSProperties,
  mediaCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 12,
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--stroke)',
    background: 'rgba(12, 18, 30, 0.7)',
  } as React.CSSProperties,
  mediaPreview: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  } as React.CSSProperties,
  mediaTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
  } as React.CSSProperties,
  mediaSubtitle: {
    fontSize: 11,
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  mediaActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  } as React.CSSProperties,
  bannerPreview: {
    width: '100%',
    height: 100,
    borderRadius: 'var(--radius-md)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(0, 0, 0, 0.25)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--text-faint)',
    fontSize: 12,
  } as React.CSSProperties,
  bannerPlaceholder: {
    opacity: 0.8,
  } as React.CSSProperties,
  fileInput: {
    display: 'none',
  } as React.CSSProperties,
  actions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  } as React.CSSProperties,
};

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
    <section style={styles.section}>
      <h2 style={styles.heading}>Overview</h2>
      <p style={styles.muted}>
        Configure this portal's profile and media settings.
      </p>

      {error && <div style={styles.modalError}>{error}</div>}

      <div style={styles.mediaGrid}>
        <div style={styles.mediaCard}>
          <div style={styles.mediaPreview}>
            <GuildIcon
              name={guildName}
              iconHash={guild?.iconHash ?? null}
              guildId={guildId}
              size={56}
            />
            <div>
              <div style={styles.mediaTitle}>Portal Icon</div>
              <div style={styles.mediaSubtitle}>Shown in portal rail and gallery.</div>
            </div>
          </div>
          <div style={styles.mediaActions}>
            <label className="btn btn-ghost btn-sm">
              {uploadingGuildIcon ? 'Uploading...' : 'Upload'}
              <input
                type="file"
                accept="image/*"
                style={styles.fileInput}
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

        <div style={styles.mediaCard}>
          <div
            style={
              guild?.bannerHash
                ? { ...styles.bannerPreview, backgroundImage: `url(/api/v1/files/${guild.bannerHash})` }
                : styles.bannerPreview
            }
          >
            {!guild?.bannerHash && <span style={styles.bannerPlaceholder}>No banner set</span>}
          </div>
          <div style={styles.mediaActions}>
            <label className="btn btn-ghost btn-sm">
              {uploadingGuildBanner ? 'Uploading...' : 'Upload Banner'}
              <input
                type="file"
                accept="image/*"
                style={styles.fileInput}
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

      <div style={{ ...styles.actions, marginTop: 16 }}>
        <Button onClick={() => openModal('settings', { type: 'server', guildId, initialSection: 'overview' })}>
          Open Portal Profile
        </Button>
      </div>
    </section>
  );
}
