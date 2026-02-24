import { useEffect, useMemo, useState, type FormEvent } from 'react';
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

  return (
    <section className="settings-section">
      <h2 className="settings-shell-section-heading">Profile</h2>

      {/* --- Profile Edit Form (from EditProfileModal) --- */}
      <div className="settings-card">
        <form className="modal-form" onSubmit={handleSubmit}>
          {profileError && <div className="modal-error">{profileError}</div>}

          <div className="profile-modal-header">
            <Avatar
              name={displayName || user.displayName}
              hash={avatarHash ?? null}
              userId={user.id}
              size={48}
            />
            <div className="profile-modal-header-text">
              <span className="profile-modal-name">{displayName || user.displayName}</span>
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
                <Avatar
                  name={displayName || user.displayName}
                  hash={avatarHash ?? null}
                  userId={user.id}
                  size={56}
                />
                <div>
                  <div className="profile-media-title">Default Avatar</div>
                  <div className="profile-media-subtitle">Used unless overridden per portal.</div>
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
                <div className="profile-recent-avatars">
                  <p className="profile-section-label">Recent Avatars</p>
                  <div className="profile-recent-avatars-strip">
                    {previousAvatarHashes.slice(0, 5).map((hash: string) => (
                      <button
                        key={hash}
                        type="button"
                        className="profile-recent-avatar-btn"
                        onClick={() => handleRestoreAvatar(hash)}
                        title="Restore this avatar"
                      >
                        <img
                          src={`/api/v1/files/${hash}`}
                          alt="Previous avatar"
                          className="profile-recent-avatar-img"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="profile-media-card">
              <div
                className="profile-banner-preview"
                style={bannerHash ? { backgroundImage: `url(/api/v1/files/${bannerHash})` } : undefined}
              >
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
            Per-portal nickname, avatar, and banner overrides live in the portal profile menu.
          </div>

          <div className="modal-footer">
            <Button type="submit" loading={saving} disabled={loadingProfile || !displayName.trim()}>
              Save Changes
            </Button>
          </div>
        </form>
      </div>

      {/* --- Display Name Styles (from SettingsPage customization) --- */}
      <div className="settings-card">
        <div className="settings-field">
          <div className="settings-field-label">Display Name Styles</div>
          <div className="settings-field-value">Customize font, effect, and colors.</div>
        </div>
        <div className={`dns-preview ${previewTheme === 'light' ? 'dns-preview-light' : ''}`}>
          <div className="dns-preview-label">Preview</div>
          <div className="dns-preview-name">
            <DisplayNameText
              text={displayName || user.displayName}
              userId={user.id}
              guildId={styleScope === 'global' ? null : styleScope}
              context="profile"
            />
          </div>
        </div>
        <div className="settings-field-control settings-field-row">
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
          <div className="dns-editor">
            <div className="settings-field">
              <div className="settings-field-label">Style Scope</div>
              <div className="settings-field-control">
                <select
                  className="settings-select"
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
            <div className="settings-field">
              <div className="settings-field-label">Font</div>
              <div className="settings-field-control">
                <select
                  className="settings-select"
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
            <div className="settings-field">
              <div className="settings-field-label">Effect</div>
              <div className="settings-field-control">
                <select
                  className="settings-select"
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
            <div className="settings-field-grid dns-colors">
              <div className="settings-field">
                <div className="settings-field-label">Primary Color</div>
                <div className="settings-field-control">
                  <input
                    type="color"
                    className="dns-color-input"
                    value={activeStyle.colorA}
                    onChange={(e) => updateStyle({ ...activeStyle, colorA: e.target.value })}
                  />
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Secondary Color</div>
                <div className="settings-field-control">
                  <input
                    type="color"
                    className="dns-color-input"
                    value={activeStyle.colorB}
                    onChange={(e) => updateStyle({ ...activeStyle, colorB: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- Profile Enhancements --- */}
        <div className="dns-editor">
          <div className="settings-field">
            <div className="settings-field-label">Portal Tag</div>
            <div className="settings-field-control">
              <select
                className="settings-select"
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

          <div className="settings-field">
            <div className="settings-field-label">Status Message</div>
            <div className="settings-field-control settings-field-row">
              <Input
                type="text"
                value={statusInput}
                onChange={(e) => setStatusInput(e.target.value.slice(0, 100))}
                placeholder="What's on your mind?"
              />
              <select
                className="settings-select"
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

          <div className="settings-field">
            <div className="settings-field-label">Profile Widgets</div>
            <div className="settings-field-control">
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
        <div className="settings-field">
          <div className="settings-field-label">Profile Theme</div>
          <div className="settings-field-value">Customize your profile card colors.</div>
        </div>
        <div className="settings-field-grid dns-colors">
          <div className="settings-field">
            <div className="settings-field-label">Primary Color</div>
            <div className="settings-field-control">
              <input
                type="color"
                className="dns-color-input"
                value={primaryColor != null ? `#${primaryColor.toString(16).padStart(6, '0')}` : '#000000'}
                onChange={(e) => setPrimaryColor(parseInt(e.target.value.slice(1), 16))}
              />
              <input
                type="text"
                className="input-field"
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
          <div className="settings-field">
            <div className="settings-field-label">Accent Color</div>
            <div className="settings-field-control">
              <input
                type="color"
                className="dns-color-input"
                value={accentColor != null ? `#${accentColor.toString(16).padStart(6, '0')}` : '#000000'}
                onChange={(e) => setAccentColor(parseInt(e.target.value.slice(1), 16))}
              />
              <input
                type="text"
                className="input-field"
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
        <div className="settings-field-control">
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
