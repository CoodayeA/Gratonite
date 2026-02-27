import React, { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DisplayNameText } from '@/components/ui/DisplayNameText';
import { DecorationPicker } from '@/components/profile/DecorationPicker';
import { EffectPicker } from '@/components/profile/EffectPicker';
import { BannerCropModal } from '@/components/profile/BannerCropModal';
import { useAuthStore } from '@/stores/auth.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import {
  createSurpriseStyle,
  DEFAULT_DISPLAY_NAME_PREFS,
  DISPLAY_NAME_EFFECTS,
  DISPLAY_NAME_FONTS,
  type DisplayNameStyle,
  readDisplayNameStylePrefs,
  saveDisplayNameStylePrefs,
  subscribeDisplayNameStyleChanges,
} from '@/lib/displayNameStyles';
import {
  computeExpiryFromPreset,
  DEFAULT_PROFILE_ENHANCEMENTS,
  readProfileEnhancementsPrefs,
  saveProfileEnhancementsPrefs,
  subscribeProfileEnhancementChanges,
  type StatusExpiryPreset,
} from '@/lib/profileEnhancements';

const styles = {
  section: {
    maxWidth: 720,
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
  modalForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    minWidth: 0,
  } as React.CSSProperties,
  modalError: {
    padding: '10px 14px',
    background: 'var(--danger-bg)',
    border: '1px solid rgba(255, 107, 107, 0.25)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--danger)',
    fontSize: 13,
  } as React.CSSProperties,
  profileModalHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 0 4px',
  } as React.CSSProperties,
  profileModalHeaderText: {
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,
  profileModalName: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
  } as React.CSSProperties,
  profileModalSubtitle: {
    fontSize: 12,
    color: 'var(--text-muted)',
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
    background: 'var(--bg-float)',
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
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as React.CSSProperties,
  inputLabel: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: 'var(--text-muted)',
  } as React.CSSProperties,
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  } as React.CSSProperties,
  inputField: {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--bg-input)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
  } as React.CSSProperties,
  bioInput: {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--bg-input)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    fontSize: 14,
    outline: 'none',
    resize: 'vertical',
    minHeight: 72,
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
  } as React.CSSProperties,
  avatarNote: {
    fontSize: 12,
    color: 'var(--text-faint)',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px dashed var(--stroke)',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
  } as React.CSSProperties,
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
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
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 12,
  } as React.CSSProperties,
  dnsPreview: {
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-elevated)',
    padding: 12,
    display: 'grid',
    gap: 6,
  } as React.CSSProperties,
  dnsPreviewLight: {
    border: '1px solid #d3dceb',
    borderRadius: 'var(--radius-md)',
    background: '#f4f7fb',
    padding: 12,
    display: 'grid',
    gap: 6,
  } as React.CSSProperties,
  dnsPreviewLabel: {
    color: 'var(--text-faint)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  dnsPreviewLabelLight: {
    color: '#607089',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  dnsPreviewName: {
    color: 'var(--text)',
    fontSize: 24,
    fontWeight: 700,
  } as React.CSSProperties,
  dnsPreviewNameLight: {
    color: '#101726',
    fontSize: 24,
    fontWeight: 700,
  } as React.CSSProperties,
  dnsEditor: {
    borderTop: '1px solid var(--stroke)',
    paddingTop: 12,
    display: 'grid',
    gap: 10,
  } as React.CSSProperties,
  dnsColors: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 12,
  } as React.CSSProperties,
  dnsColorInput: {
    width: 44,
    height: 30,
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--stroke)',
    background: 'transparent',
    padding: 0,
  } as React.CSSProperties,
  settingsSelect: {
    background: 'var(--bg-float)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    padding: '6px 10px',
    fontFamily: 'inherit',
    fontSize: 13,
  } as React.CSSProperties,
  recentAvatars: {
    marginTop: 12,
  } as React.CSSProperties,
  sectionLabel: {
    fontSize: 12,
    color: 'var(--text-faint)',
  } as React.CSSProperties,
  recentAvatarsStrip: {
    display: 'flex',
    gap: 8,
    marginTop: 6,
  } as React.CSSProperties,
  recentAvatarBtn: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    overflow: 'hidden',
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: 'transparent',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
    background: 'none',
    padding: 0,
  } as React.CSSProperties,
  recentAvatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  } as React.CSSProperties,
};

export function ProfileSection() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const guilds = useGuildsStore((s) => s.guilds);
  const guildOrder = useGuildsStore((s) => s.guildOrder);

  // --- Edit profile form state (from EditProfileModal) ---
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [avatarHash, setAvatarHash] = useState<string | null>(null);
  const [bannerHash, setBannerHash] = useState<string | null>(null);
  const [previousAvatarHashes, setPreviousAvatarHashes] = useState<string[]>([]);
  const [initial, setInitial] = useState({ displayName: '', bio: '', pronouns: '' });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [profileError, setProfileError] = useState('');

  // --- Cosmetic picker modals ---
  const [decorationPickerOpen, setDecorationPickerOpen] = useState(false);
  const [effectPickerOpen, setEffectPickerOpen] = useState(false);
  const [bannerCropFile, setBannerCropFile] = useState<File | null>(null);

  // --- Profile theme colors ---
  const [primaryColor, setPrimaryColor] = useState<number | null>(null);
  const [accentColor, setAccentColor] = useState<number | null>(null);

  // --- Display name styles state (from SettingsPage customization) ---
  const [styleVersion, setStyleVersion] = useState(0);
  const [styleEditorOpen, setStyleEditorOpen] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<'dark' | 'light'>('dark');
  const [styleScope, setStyleScope] = useState<'global' | string>('global');

  // --- Profile enhancements ---
  const [profileEnhancementsVersion, setProfileEnhancementsVersion] = useState(0);
  const [statusInput, setStatusInput] = useState('');
  const [statusExpiryPreset, setStatusExpiryPreset] = useState<StatusExpiryPreset>('4h');

  // --- Hover state for recent avatar buttons ---
  const [hoveredAvatarHash, setHoveredAvatarHash] = useState<string | null>(null);

  useEffect(() => subscribeDisplayNameStyleChanges(() => setStyleVersion((v) => v + 1)), []);
  useEffect(() => subscribeProfileEnhancementChanges(() => setProfileEnhancementsVersion((v) => v + 1)), []);

  const stylePrefs = useMemo(
    () => (user ? readDisplayNameStylePrefs(user.id) : DEFAULT_DISPLAY_NAME_PREFS),
    [user, styleVersion],
  );

  const profileEnhancements = useMemo(
    () => (user ? readProfileEnhancementsPrefs(user.id) : DEFAULT_PROFILE_ENHANCEMENTS),
    [user, profileEnhancementsVersion],
  );

  const activeStyle: DisplayNameStyle = useMemo(() => {
    if (styleScope === 'global') return stylePrefs.global;
    return stylePrefs.perServer[styleScope] ?? stylePrefs.global;
  }, [stylePrefs, styleScope]);

  useEffect(() => {
    setStatusInput(profileEnhancements.statusText);
  }, [profileEnhancements.statusText]);

  // Load profile data
  useEffect(() => {
    setLoadingProfile(true);
    setProfileError('');
    api.users
      .getMe()
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
        setPreviousAvatarHashes(me.profile?.previousAvatarHashes ?? []);
        setPrimaryColor((me.profile as any)?.primaryColor ?? null);
        setAccentColor((me.profile as any)?.accentColor ?? null);
        setInitial(next);
      })
      .catch((err) => setProfileError(getErrorMessage(err)))
      .finally(() => setLoadingProfile(false));
  }, [user?.displayName, user?.avatarHash]);

  async function handleAvatarUpload(file: File | null) {
    if (!file) return;
    setUploadingAvatar(true);
    setProfileError('');
    try {
      const result = await api.users.uploadAvatar(file);
      setAvatarHash(result.avatarHash);
      updateUser({ avatarHash: result.avatarHash });
    } catch (err) {
      setProfileError(getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleBannerUpload(file: File | null) {
    if (!file) return;
    setBannerCropFile(file);
  }

  async function handleBannerCropComplete(bannerHash: string) {
    setBannerHash(bannerHash);
    setBannerCropFile(null);
  }

  async function handleSaveColors() {
    try {
      await api.users.updateProfile({
        primaryColor: primaryColor != null ? `#${primaryColor.toString(16).padStart(6, '0')}` : undefined,
        accentColor: accentColor != null ? `#${accentColor.toString(16).padStart(6, '0')}` : undefined,
      });
    } catch (err) {
      setProfileError(getErrorMessage(err));
    }
  }

  async function handleAvatarRemove() {
    setUploadingAvatar(true);
    setProfileError('');
    try {
      await api.users.deleteAvatar();
      setAvatarHash(null);
      updateUser({ avatarHash: null });
    } catch (err) {
      setProfileError(getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleRestoreAvatar(hash: string) {
    try {
      await fetch(`/api/v1/users/@me/avatar/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ hash }),
      });
      const me = await api.users.getMe();
      setAvatarHash(me.profile?.avatarHash ?? null);
      setPreviousAvatarHashes(me.profile?.previousAvatarHashes ?? []);
      updateUser({ avatarHash: me.profile?.avatarHash ?? null });
    } catch (err) {
      console.error('Failed to restore avatar', err);
    }
  }

  async function handleBannerRemove() {
    setUploadingBanner(true);
    setProfileError('');
    try {
      await api.users.deleteBanner();
      setBannerHash(null);
    } catch (err) {
      setProfileError(getErrorMessage(err));
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setProfileError('');
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
    } catch (err) {
      setProfileError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function updateStyle(next: DisplayNameStyle) {
    if (!user) return;
    const nextPrefs = {
      ...stylePrefs,
      ...(styleScope === 'global'
        ? { global: next }
        : { perServer: { ...stylePrefs.perServer, [styleScope]: next } }),
    };
    saveDisplayNameStylePrefs(user.id, nextPrefs);
  }

  function handleSurpriseMe() {
    updateStyle(createSurpriseStyle());
  }

  function setServerTag(guildId: string | null) {
    if (!user) return;
    saveProfileEnhancementsPrefs(user.id, {
      ...profileEnhancements,
      serverTagGuildId: guildId,
    });
  }

  function handleSaveStatus() {
    if (!user) return;
    saveProfileEnhancementsPrefs(user.id, {
      ...profileEnhancements,
      statusText: statusInput.trim().slice(0, 100),
      statusExpiresAt: computeExpiryFromPreset(statusExpiryPreset),
    });
  }

  function updateWidgets(raw: string) {
    if (!user) return;
    const widgets = raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
    saveProfileEnhancementsPrefs(user.id, {
      ...profileEnhancements,
      widgets,
    });
  }

  if (!user) return null;

  const isLight = previewTheme === 'light';

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
          Profile
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Manage your display name, avatar, banner, and profile appearance.
        </p>
      </div>

      {/* --- Profile Edit Form (from EditProfileModal) --- */}
      <div style={styles.card}>
        <form style={styles.modalForm} onSubmit={handleSubmit}>
          {profileError && <div style={styles.modalError}>{profileError}</div>}

          <div style={styles.profileModalHeader}>
            <Avatar
              name={displayName || user.displayName}
              hash={avatarHash ?? null}
              userId={user.id}
              size={48}
            />
            <div style={styles.profileModalHeaderText}>
              <span style={styles.profileModalName}>{displayName || user.displayName}</span>
              <span style={styles.profileModalSubtitle}>Update your profile details</span>
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

          <div style={styles.mediaGrid}>
            <div style={styles.mediaCard}>
              <div style={styles.mediaPreview}>
                <Avatar
                  name={displayName || user.displayName}
                  hash={avatarHash ?? null}
                  userId={user.id}
                  size={56}
                />
                <div>
                  <div style={styles.mediaTitle}>Default Avatar</div>
                  <div style={styles.mediaSubtitle}>Used unless overridden per portal.</div>
                </div>
              </div>
              <div style={styles.mediaActions}>
                <label className="btn btn-ghost btn-sm">
                  {uploadingAvatar ? 'Uploading...' : 'Upload'}
                  <input
                    type="file"
                    accept="image/*"
                    style={styles.fileInput}
                    onChange={(e) => handleAvatarUpload(e.target.files?.[0] ?? null)}
                    disabled={uploadingAvatar}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleAvatarRemove}
                  disabled={uploadingAvatar || !avatarHash}
                >
                  Remove
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDecorationPickerOpen(true)}
                >
                  Change Decoration
                </button>
              </div>
              {previousAvatarHashes && previousAvatarHashes.length > 0 && (
                <div style={styles.recentAvatars}>
                  <p style={styles.sectionLabel}>Recent Avatars</p>
                  <div style={styles.recentAvatarsStrip}>
                    {previousAvatarHashes.slice(0, 5).map((hash: string) => (
                      <button
                        key={hash}
                        type="button"
                        style={{
                          ...styles.recentAvatarBtn,
                          borderColor: hoveredAvatarHash === hash ? 'var(--accent)' : 'transparent',
                        }}
                        onClick={() => handleRestoreAvatar(hash)}
                        onMouseEnter={() => setHoveredAvatarHash(hash)}
                        onMouseLeave={() => setHoveredAvatarHash(null)}
                        title="Restore this avatar"
                      >
                        <img
                          src={`/api/v1/files/${hash}`}
                          alt="Previous avatar"
                          style={styles.recentAvatarImg}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={styles.mediaCard}>
              <div
                style={bannerHash ? { ...styles.bannerPreview, backgroundImage: `url(/api/v1/files/${bannerHash})` } : styles.bannerPreview}
              >
                {!bannerHash && <span style={styles.bannerPlaceholder}>No banner set</span>}
              </div>
              <div style={styles.mediaActions}>
                <label className="btn btn-ghost btn-sm">
                  {uploadingBanner ? 'Uploading...' : 'Upload Banner'}
                  <input
                    type="file"
                    accept="image/*"
                    style={styles.fileInput}
                    onChange={(e) => handleBannerUpload(e.target.files?.[0] ?? null)}
                    disabled={uploadingBanner}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleBannerRemove}
                  disabled={uploadingBanner || !bannerHash}
                >
                  Remove
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEffectPickerOpen(true)}
                >
                  Change Effect
                </button>
              </div>
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.inputLabel}>Bio</label>
            <div style={styles.inputWrapper}>
              <textarea
                style={styles.bioInput}
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

          <div style={styles.avatarNote}>
            Per-portal nickname, avatar, and banner overrides live in the portal profile menu.
          </div>

          <div style={styles.modalFooter}>
            <Button type="submit" loading={saving} disabled={loadingProfile || !displayName.trim()}>
              Save Changes
            </Button>
          </div>
        </form>
      </div>

      {/* --- Display Name Styles (from SettingsPage customization) --- */}
      <div style={styles.card}>
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Display Name Styles</div>
          <div style={styles.fieldValue}>Customize font, effect, and colors.</div>
        </div>
        <div style={isLight ? styles.dnsPreviewLight : styles.dnsPreview}>
          <div style={isLight ? styles.dnsPreviewLabelLight : styles.dnsPreviewLabel}>Preview</div>
          <div style={isLight ? styles.dnsPreviewNameLight : styles.dnsPreviewName}>
            <DisplayNameText
              text={displayName || user.displayName}
              userId={user.id}
              guildId={styleScope === 'global' ? null : styleScope}
              context="profile"
            />
          </div>
        </div>
        <div style={styles.fieldRow}>
          <Button
            variant="ghost"
            onClick={() => setPreviewTheme((p) => (p === 'dark' ? 'light' : 'dark'))}
          >
            {previewTheme === 'dark' ? 'Light Mode Preview' : 'Dark Mode Preview'}
          </Button>
          <Button variant="ghost" onClick={handleSurpriseMe}>
            Surprise Me
          </Button>
          <Button onClick={() => setStyleEditorOpen((v) => !v)}>
            {styleEditorOpen ? 'Close Style Menu' : 'Change Style'}
          </Button>
        </div>

        {styleEditorOpen && (
          <div style={styles.dnsEditor}>
            <div style={styles.field}>
              <div style={styles.fieldLabel}>Style Scope</div>
              <div style={styles.fieldControl}>
                <select
                  style={styles.settingsSelect}
                  value={styleScope}
                  onChange={(e) => setStyleScope(e.target.value)}
                >
                  <option value="global">Global</option>
                  {guildOrder.map((id) => {
                    const guild = guilds.get(id);
                    if (!guild) return null;
                    return (
                      <option key={id} value={id}>
                        Per-Portal: {guild.name}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            <div style={styles.field}>
              <div style={styles.fieldLabel}>Font</div>
              <div style={styles.fieldControl}>
                <select
                  style={styles.settingsSelect}
                  value={activeStyle.font}
                  onChange={(e) =>
                    updateStyle({ ...activeStyle, font: e.target.value as DisplayNameStyle['font'] })
                  }
                >
                  {DISPLAY_NAME_FONTS.map((font) => (
                    <option key={font.id} value={font.id}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={styles.field}>
              <div style={styles.fieldLabel}>Effect</div>
              <div style={styles.fieldControl}>
                <select
                  style={styles.settingsSelect}
                  value={activeStyle.effect}
                  onChange={(e) =>
                    updateStyle({
                      ...activeStyle,
                      effect: e.target.value as DisplayNameStyle['effect'],
                    })
                  }
                >
                  {DISPLAY_NAME_EFFECTS.map((effect) => (
                    <option key={effect.id} value={effect.id}>
                      {effect.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={styles.dnsColors}>
              <div style={styles.field}>
                <div style={styles.fieldLabel}>Primary Color</div>
                <div style={styles.fieldControl}>
                  <input
                    type="color"
                    style={styles.dnsColorInput}
                    value={activeStyle.colorA}
                    onChange={(e) => updateStyle({ ...activeStyle, colorA: e.target.value })}
                  />
                </div>
              </div>
              <div style={styles.field}>
                <div style={styles.fieldLabel}>Secondary Color</div>
                <div style={styles.fieldControl}>
                  <input
                    type="color"
                    style={styles.dnsColorInput}
                    value={activeStyle.colorB}
                    onChange={(e) => updateStyle({ ...activeStyle, colorB: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Profile Enhancements --- */}
        <div style={styles.dnsEditor}>
          <div style={styles.field}>
            <div style={styles.fieldLabel}>Portal Tag</div>
            <div style={styles.fieldControl}>
              <select
                style={styles.settingsSelect}
                value={profileEnhancements.serverTagGuildId ?? ''}
                onChange={(e) => setServerTag(e.target.value || null)}
              >
                <option value="">None</option>
                {guildOrder.map((id) => {
                  const guild = guilds.get(id);
                  if (!guild) return null;
                  return (
                    <option key={id} value={id}>
                      {guild.name}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div style={styles.field}>
            <div style={styles.fieldLabel}>Status Message</div>
            <div style={styles.fieldRow}>
              <Input
                type="text"
                value={statusInput}
                onChange={(e) => setStatusInput(e.target.value.slice(0, 100))}
                placeholder="What's on your mind?"
              />
              <select
                style={styles.settingsSelect}
                value={statusExpiryPreset}
                onChange={(e) => setStatusExpiryPreset(e.target.value as StatusExpiryPreset)}
              >
                <option value="1h">1 hour</option>
                <option value="4h">4 hours</option>
                <option value="today">Today</option>
                <option value="never">Never</option>
              </select>
              <Button onClick={handleSaveStatus}>Save</Button>
            </div>
          </div>

          <div style={styles.field}>
            <div style={styles.fieldLabel}>Profile Widgets</div>
            <div style={styles.fieldControl}>
              <Input
                type="text"
                value={profileEnhancements.widgets.join(', ')}
                onChange={(e) => updateWidgets(e.target.value)}
                placeholder="Example: Backlog - Hollow Knight, Persona 3 Reload"
              />
            </div>
          </div>
        </div>

        {/* --- Profile Theme (Two-Color) --- */}
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Profile Theme</div>
          <div style={styles.fieldValue}>Customize your profile card colors.</div>
        </div>
        <div style={styles.dnsColors}>
          <div style={styles.field}>
            <div style={styles.fieldLabel}>Primary Color</div>
            <div style={styles.fieldControl}>
              <input
                type="color"
                style={styles.dnsColorInput}
                value={primaryColor != null ? `#${primaryColor.toString(16).padStart(6, '0')}` : '#000000'}
                onChange={(e) => setPrimaryColor(parseInt(e.target.value.slice(1), 16))}
              />
              <input
                type="text"
                style={styles.inputField}
                value={primaryColor != null ? `#${primaryColor.toString(16).padStart(6, '0')}` : ''}
                onChange={(e) => {
                  const val = e.target.value.replace('#', '');
                  if (/^[0-9a-fA-F]{6}$/.test(val)) {
                    setPrimaryColor(parseInt(val, 16));
                  }
                }}
                placeholder="#000000"
                maxLength={7}
              />
            </div>
          </div>
          <div style={styles.field}>
            <div style={styles.fieldLabel}>Accent Color</div>
            <div style={styles.fieldControl}>
              <input
                type="color"
                style={styles.dnsColorInput}
                value={accentColor != null ? `#${accentColor.toString(16).padStart(6, '0')}` : '#000000'}
                onChange={(e) => setAccentColor(parseInt(e.target.value.slice(1), 16))}
              />
              <input
                type="text"
                style={styles.inputField}
                value={accentColor != null ? `#${accentColor.toString(16).padStart(6, '0')}` : ''}
                onChange={(e) => {
                  const val = e.target.value.replace('#', '');
                  if (/^[0-9a-fA-F]{6}$/.test(val)) {
                    setAccentColor(parseInt(val, 16));
                  }
                }}
                placeholder="#000000"
                maxLength={7}
              />
            </div>
          </div>
        </div>
        <div style={styles.fieldControl}>
          <Button onClick={handleSaveColors}>Save Theme Colors</Button>
        </div>
      </div>

      {decorationPickerOpen && (
        <DecorationPicker
          onClose={() => setDecorationPickerOpen(false)}
          currentDecorationId={user.avatarDecorationId ?? null}
        />
      )}

      {effectPickerOpen && (
        <EffectPicker
          onClose={() => setEffectPickerOpen(false)}
          currentEffectId={user.profileEffectId ?? null}
        />
      )}

      {bannerCropFile && (
        <BannerCropModal
          file={bannerCropFile}
          onClose={() => setBannerCropFile(null)}
          onComplete={handleBannerCropComplete}
        />
      )}
    </section>
  );
}
