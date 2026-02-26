import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Input } from '@/components/ui/Input';
import { MfaSettingsCard } from '@/components/settings/MfaSettingsCard';
import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';
import { useGuildsStore } from '@/stores/guilds.store';
import { useChannelsStore } from '@/stores/channels.store';
import { useMessagesStore } from '@/stores/messages.store';
import { useMembersStore } from '@/stores/members.store';
import { useUnreadStore } from '@/stores/unread.store';
import { api, setAccessToken } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import {
  applyUiVisualPreferences,
  clearThemeManifestPreference,
  readThemeManifestPreference,
  readUiGlassModePreference,
  readUiSurfaceBackgroundModePreference,
  readUiContentScrimPreference,
  readUiBackgroundStylePreference,
  readUiLowPowerPreference,
  readUiReducedEffectsPreference,
  UI_PORTAL_BACKGROUND_STYLE_STORAGE_KEY,
  UI_CHANNEL_BACKGROUND_STYLE_STORAGE_KEY,
  UI_DM_BACKGROUND_STYLE_STORAGE_KEY,
  setUiGlassModePreference,
  setUiBackgroundStylePreference,
  setUiSurfaceBackgroundModePreference,
  setUiContentScrimPreference,
  setUiLowPowerPreference,
  setUiReducedEffectsPreference,
  setThemeManifestPreference,
  setUiV2TokensPreference,
  shouldEnableUiV2Tokens,
  type UiGlassMode,
  type UiSurfaceBackgroundMode,
  type UiContentScrim,
  type UiBackgroundStyle,
} from '@/theme/initTheme';
import { applyThemeV2, resolveThemeV2 } from '@/theme/resolveTheme';
import { DEFAULT_THEME_V2 } from '@/theme/tokens-v2';
import { useGuilds } from '@/hooks/useGuilds';
import { DisplayNameText } from '@/components/ui/DisplayNameText';
import { AvatarSprite } from '@/components/ui/AvatarSprite';
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
import {
  getAvatarDecorationById,
  getProfileEffectById,
} from '@/lib/profileCosmetics';
import {
  CLOTHES_COLORS,
  HAIR_COLORS,
  SKIN_TONES,
  DEFAULT_AVATAR_STUDIO_PREFS,
  STARTER_WEARABLES,
  equipStarterWearable,
  readAvatarStudioPrefs,
  saveAvatarStudioPrefs,
  subscribeAvatarStudioChanges,
  type AvatarStudioPrefs,
} from '@/lib/avatarStudio';
import {
  DEFAULT_NOTIFICATION_SOUND_PREFS,
  readNotificationSoundPrefs,
  subscribeNotificationSoundPrefs,
  updateNotificationSoundPrefs,
  type NotificationSoundPrefs,
} from '@/lib/notificationSoundPrefs';
import { playSound, stopSound, type SoundName } from '@/lib/audio';
import {
  DEFAULT_SOUNDBOARD_PREFS,
  readSoundboardPrefs,
  subscribeSoundboardPrefs,
  updateSoundboardPrefs,
  type SoundboardPrefs,
} from '@/lib/soundboardPrefs';

type SettingsSection =
  | 'account'
  | 'customization'
  | 'appearance'
  | 'notifications'
  | 'security'
  | 'accessibility'
  | 'logout';

const THEME_TOKEN_CONTROLS: Array<{ key: string; label: string; type: 'color' | 'text' }> = [
  { key: 'semantic/action/accent', label: 'Primary Accent', type: 'color' },
  { key: 'semantic/action/accent-2', label: 'Secondary Accent', type: 'color' },
  { key: 'semantic/surface/base', label: 'Base Surface', type: 'color' },
  { key: 'semantic/text/primary', label: 'Primary Text', type: 'color' },
  { key: 'semantic/gradient/accent', label: 'Accent Gradient', type: 'text' },
];

const DAYS = [
  { label: 'Sun', bit: 0 },
  { label: 'Mon', bit: 1 },
  { label: 'Tue', bit: 2 },
  { label: 'Wed', bit: 3 },
  { label: 'Thu', bit: 4 },
  { label: 'Fri', bit: 5 },
  { label: 'Sat', bit: 6 },
];

const THEME_PRESETS_V3: Array<{ name: string; description: string; overrides: Record<string, string> }> = [
  {
    name: 'Ice',
    description: 'Lighter cyan/ice glass',
    overrides: {
      'semantic/surface/base': '#10182a',
      'semantic/surface/raised': 'rgba(27, 39, 61, 0.84)',
      'semantic/surface/soft': 'rgba(37, 52, 79, 0.82)',
      'semantic/action/accent': '#7ad8ff',
      'semantic/action/accent-2': '#a3c7ff',
      'semantic/gradient/accent': 'linear-gradient(135deg, #7ad8ff, #a3c7ff 55%, #d3ebff)',
    },
  },
  {
    name: 'Cyberpunk',
    description: 'Indigo + cyan neon glass',
    overrides: {
      'semantic/surface/base': '#12162b',
      'semantic/surface/raised': 'rgba(25, 30, 58, 0.84)',
      'semantic/surface/soft': 'rgba(35, 42, 74, 0.82)',
      'semantic/action/accent': '#7a5cff',
      'semantic/action/accent-2': '#2ee6ff',
      'semantic/gradient/accent': 'linear-gradient(135deg, #7a5cff, #2ee6ff 58%, #a88aff)',
    },
  },
  {
    name: 'Ember',
    description: 'Warm orange + gold glass',
    overrides: {
      'semantic/surface/base': '#1a1411',
      'semantic/surface/raised': 'rgba(42, 26, 20, 0.84)',
      'semantic/surface/soft': 'rgba(55, 34, 25, 0.82)',
      'semantic/action/accent': '#ff7a45',
      'semantic/action/accent-2': '#ffd36b',
      'semantic/gradient/accent': 'linear-gradient(135deg, #ff7a45, #ffd36b)',
    },
  },
  {
    name: 'Toxic',
    description: 'Green neon community theme',
    overrides: {
      'semantic/surface/base': '#0f1510',
      'semantic/surface/raised': 'rgba(18, 33, 22, 0.84)',
      'semantic/surface/soft': 'rgba(27, 45, 31, 0.82)',
      'semantic/action/accent': '#2dff9f',
      'semantic/action/accent-2': '#b8ff62',
      'semantic/gradient/accent': 'linear-gradient(135deg, #2dff9f, #b8ff62)',
    },
  },
];

export function SettingsPage() {
  useGuilds();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);
  const openModal = useUiStore((s) => s.openModal);

  const [section, setSection] = useState<SettingsSection>('account');
  const [profile, setProfile] = useState<{ displayName: string; avatarHash: string | null; bannerHash: string | null } | null>(null);
  const [fontScale, setFontScale] = useState(1);
  const [messageDisplay, setMessageDisplay] = useState('cozy');
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndStart, setDndStart] = useState('22:00');
  const [dndEnd, setDndEnd] = useState('08:00');
  const [dndTimezone, setDndTimezone] = useState('UTC');
  const [dndDays, setDndDays] = useState(0b1111111);
  const [savingDnd, setSavingDnd] = useState(false);
  const [dndError, setDndError] = useState('');
  const [uiV2TokensEnabled, setUiV2TokensEnabled] = useState(() => shouldEnableUiV2Tokens());
  const [uiGlassMode, setUiGlassMode] = useState<UiGlassMode>(() => readUiGlassModePreference());
  const [uiSurfaceBackgroundMode, setUiSurfaceBackgroundMode] = useState<UiSurfaceBackgroundMode>(
    () => readUiSurfaceBackgroundModePreference(),
  );
  const [uiContentScrim, setUiContentScrim] = useState<UiContentScrim>(() => readUiContentScrimPreference());
  const [uiLowPower, setUiLowPower] = useState(() => readUiLowPowerPreference());
  const [uiReducedEffects, setUiReducedEffects] = useState(() => readUiReducedEffectsPreference());
  const [uiPortalBackgroundStyle, setUiPortalBackgroundStyle] = useState<UiBackgroundStyle>(
    () => readUiBackgroundStylePreference(UI_PORTAL_BACKGROUND_STYLE_STORAGE_KEY),
  );
  const [uiChannelBackgroundStyle, setUiChannelBackgroundStyle] = useState<UiBackgroundStyle>(
    () => readUiBackgroundStylePreference(UI_CHANNEL_BACKGROUND_STYLE_STORAGE_KEY),
  );
  const [uiDmBackgroundStyle, setUiDmBackgroundStyle] = useState<UiBackgroundStyle>(
    () => readUiBackgroundStylePreference(UI_DM_BACKGROUND_STYLE_STORAGE_KEY),
  );
  const [themeName, setThemeName] = useState(() => readThemeManifestPreference()?.name ?? DEFAULT_THEME_V2.name);
  const [themeOverrides, setThemeOverrides] = useState<Record<string, string>>(
    () => readThemeManifestPreference()?.overrides ?? {},
  );
  const [themeImportValue, setThemeImportValue] = useState('');
  const [themeError, setThemeError] = useState('');
  const [styleVersion, setStyleVersion] = useState(0);
  const [styleEditorOpen, setStyleEditorOpen] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<'dark' | 'light'>('dark');
  const [styleScope, setStyleScope] = useState<'global' | string>('global');
  const [profileEnhancementsVersion, setProfileEnhancementsVersion] = useState(0);
  const [avatarStudioPrefs, setAvatarStudioPrefs] = useState<AvatarStudioPrefs>(DEFAULT_AVATAR_STUDIO_PREFS);
  const [statusInput, setStatusInput] = useState('');
  const [statusExpiryPreset, setStatusExpiryPreset] = useState<StatusExpiryPreset>('4h');
  const [soundPrefs, setSoundPrefs] = useState<NotificationSoundPrefs>(DEFAULT_NOTIFICATION_SOUND_PREFS);
  const [soundboardPrefs, setSoundboardPrefs] = useState<SoundboardPrefs>(DEFAULT_SOUNDBOARD_PREFS);
  const guilds = useGuildsStore((s) => s.guilds);
  const guildOrder = useGuildsStore((s) => s.guildOrder);

  const stylePrefs = useMemo(
    () => (user ? readDisplayNameStylePrefs(user.id) : DEFAULT_DISPLAY_NAME_PREFS),
    [user, styleVersion],
  );

  useEffect(() => subscribeDisplayNameStyleChanges(() => setStyleVersion((v) => v + 1)), []);
  useEffect(() => subscribeProfileEnhancementChanges(() => setProfileEnhancementsVersion((v) => v + 1)), []);
  useEffect(
    () =>
      subscribeAvatarStudioChanges((changedUserId) => {
        if (!user || changedUserId !== user.id) return;
        setAvatarStudioPrefs(readAvatarStudioPrefs(user.id));
      }),
    [user],
  );

  const activeStyle: DisplayNameStyle = useMemo(() => {
    if (styleScope === 'global') return stylePrefs.global;
    return stylePrefs.perServer[styleScope] ?? stylePrefs.global;
  }, [stylePrefs, styleScope]);

  const profileEnhancements = useMemo(
    () => (user ? readProfileEnhancementsPrefs(user.id) : DEFAULT_PROFILE_ENHANCEMENTS),
    [user, profileEnhancementsVersion],
  );

  useEffect(() => {
    setStatusInput(profileEnhancements.statusText);
  }, [profileEnhancements.statusText]);

  useEffect(() => {
    setSoundPrefs(readNotificationSoundPrefs());
    return subscribeNotificationSoundPrefs(setSoundPrefs);
  }, []);
  useEffect(() => {
    setSoundboardPrefs(readSoundboardPrefs());
    return subscribeSoundboardPrefs(setSoundboardPrefs);
  }, []);

  const bannerStyle = useMemo(() => {
    if (!profile?.bannerHash) return undefined;
    return { backgroundImage: `url(/api/v1/files/${profile.bannerHash})` };
  }, [profile?.bannerHash]);
  const equippedAvatarDecoration = getAvatarDecorationById(user?.avatarDecorationId);
  const equippedProfileEffect = getProfileEffectById(user?.profileEffectId);
  const starterWearablesBySlot = useMemo(() => {
    const slots = {
      hat: STARTER_WEARABLES.filter((item) => item.slot === 'hat'),
      top: STARTER_WEARABLES.filter((item) => item.slot === 'top'),
      bottom: STARTER_WEARABLES.filter((item) => item.slot === 'bottom'),
      shoes: STARTER_WEARABLES.filter((item) => item.slot === 'shoes'),
      accessory: STARTER_WEARABLES.filter((item) => item.slot === 'accessory'),
    };
    return slots;
  }, []);


  useEffect(() => {
    if (!user) return;
    setAvatarStudioPrefs(readAvatarStudioPrefs(user.id));
  }, [user]);

  useEffect(() => {
    api.users.getMe()
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



  useEffect(() => {
    api.users.getDndSchedule()
      .then((schedule) => {
        setDndEnabled(schedule.enabled);
        setDndStart(schedule.startTime ?? '22:00');
        setDndEnd(schedule.endTime ?? '08:00');
        setDndTimezone(schedule.timezone ?? 'UTC');
        setDndDays(schedule.daysOfWeek ?? 0b1111111);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      api.users.updateSettings({ fontScale, messageDisplay, theme: 'dark' }).catch(() => undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [fontScale, messageDisplay]);

  const toggleDay = useCallback((bit: number) => {
    setDndDays((prev) => prev ^ (1 << bit));
  }, []);

  const updateSoundPrefs = useCallback((updater: (current: NotificationSoundPrefs) => NotificationSoundPrefs) => {
    setSoundPrefs(updateNotificationSoundPrefs(updater));
  }, []);

  const previewSound = useCallback((name: SoundName) => {
    playSound(name);
    if (name === 'ringtone' || name === 'outgoing-ring') {
      window.setTimeout(() => stopSound(name), 1200);
    }
  }, []);

  const handleClose = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  async function handleSaveDnd() {
    setSavingDnd(true);
    setDndError('');
    try {
      await api.users.updateDndSchedule({
        enabled: dndEnabled,
        startTime: dndStart,
        endTime: dndEnd,
        timezone: dndTimezone,
        daysOfWeek: dndDays,
      });
    } catch (err) {
      setDndError(getErrorMessage(err));
    } finally {
      setSavingDnd(false);
    }
  }

  async function handleLogout() {
    try {
      await api.auth.logout();
    } catch {
      // Best-effort
    }
    setAccessToken(null);
    logout();
    useGuildsStore.getState().clear();
    useChannelsStore.getState().clear();
    useMessagesStore.getState().clear();
    useMembersStore.getState().clear();
    useUnreadStore.getState().clear();
    queryClient.clear();
    navigate('/login', { replace: true });
  }

  function handleToggleUiV2Tokens(nextEnabled: boolean) {
    setUiV2TokensPreference(nextEnabled);
    setUiV2TokensEnabled(nextEnabled);
    window.location.reload();
  }

  function handleChangeGlassMode(nextMode: UiGlassMode) {
    setUiGlassModePreference(nextMode);
    setUiGlassMode(nextMode);
    applyUiVisualPreferences();
  }

  function handleToggleLowPower(enabled: boolean) {
    setUiLowPowerPreference(enabled);
    setUiLowPower(enabled);
    applyUiVisualPreferences();
  }

  function handleToggleReducedEffects(enabled: boolean) {
    setUiReducedEffectsPreference(enabled);
    setUiReducedEffects(enabled);
    applyUiVisualPreferences();
  }

  function handleChangeSurfaceBackgroundMode(mode: UiSurfaceBackgroundMode) {
    setUiSurfaceBackgroundModePreference(mode);
    setUiSurfaceBackgroundMode(mode);
    applyUiVisualPreferences();
  }

  function handleChangeContentScrim(mode: UiContentScrim) {
    setUiContentScrimPreference(mode);
    setUiContentScrim(mode);
    applyUiVisualPreferences();
  }

  function handleChangeBackgroundStyle(
    scope: 'portal' | 'channel' | 'dm',
    mode: UiBackgroundStyle,
  ) {
    const key =
      scope === 'portal'
        ? UI_PORTAL_BACKGROUND_STYLE_STORAGE_KEY
        : scope === 'channel'
          ? UI_CHANNEL_BACKGROUND_STYLE_STORAGE_KEY
          : UI_DM_BACKGROUND_STYLE_STORAGE_KEY;
    setUiBackgroundStylePreference(key, mode);
    if (scope === 'portal') setUiPortalBackgroundStyle(mode);
    if (scope === 'channel') setUiChannelBackgroundStyle(mode);
    if (scope === 'dm') setUiDmBackgroundStyle(mode);
    applyUiVisualPreferences();
  }

  function handleResetVisualPreferences() {
    setUiGlassModePreference('subtle');
    setUiSurfaceBackgroundModePreference('contained');
    setUiContentScrimPreference('balanced');
    setUiBackgroundStylePreference(UI_PORTAL_BACKGROUND_STYLE_STORAGE_KEY, 'auto');
    setUiBackgroundStylePreference(UI_CHANNEL_BACKGROUND_STYLE_STORAGE_KEY, 'auto');
    setUiBackgroundStylePreference(UI_DM_BACKGROUND_STYLE_STORAGE_KEY, 'auto');
    setUiLowPowerPreference(false);
    setUiReducedEffectsPreference(false);

    setUiGlassMode('subtle');
    setUiSurfaceBackgroundMode('contained');
    setUiContentScrim('balanced');
    setUiPortalBackgroundStyle('auto');
    setUiChannelBackgroundStyle('auto');
    setUiDmBackgroundStyle('auto');
    setUiLowPower(false);
    setUiReducedEffects(false);
    applyUiVisualPreferences();
  }

  function handleApplyVisualPreset(preset: 'balanced' | 'immersive' | 'performance') {
    if (preset === 'balanced') {
      handleResetVisualPreferences();
      return;
    }
    if (preset === 'immersive') {
      setUiGlassModePreference('full');
      setUiSurfaceBackgroundModePreference('full');
      setUiContentScrimPreference('soft');
      setUiLowPowerPreference(false);
      setUiReducedEffectsPreference(false);
      setUiBackgroundStylePreference(UI_PORTAL_BACKGROUND_STYLE_STORAGE_KEY, 'aurora');
      setUiBackgroundStylePreference(UI_CHANNEL_BACKGROUND_STYLE_STORAGE_KEY, 'mesh');
      setUiBackgroundStylePreference(UI_DM_BACKGROUND_STYLE_STORAGE_KEY, 'aurora');
      setUiGlassMode('full');
      setUiSurfaceBackgroundMode('full');
      setUiContentScrim('soft');
      setUiLowPower(false);
      setUiReducedEffects(false);
      setUiPortalBackgroundStyle('aurora');
      setUiChannelBackgroundStyle('mesh');
      setUiDmBackgroundStyle('aurora');
      applyUiVisualPreferences();
      return;
    }
    setUiGlassModePreference('off');
    setUiSurfaceBackgroundModePreference('contained');
    setUiContentScrimPreference('strong');
    setUiLowPowerPreference(true);
    setUiReducedEffectsPreference(true);
    setUiBackgroundStylePreference(UI_PORTAL_BACKGROUND_STYLE_STORAGE_KEY, 'minimal');
    setUiBackgroundStylePreference(UI_CHANNEL_BACKGROUND_STYLE_STORAGE_KEY, 'minimal');
    setUiBackgroundStylePreference(UI_DM_BACKGROUND_STYLE_STORAGE_KEY, 'minimal');
    setUiGlassMode('off');
    setUiSurfaceBackgroundMode('contained');
    setUiContentScrim('strong');
    setUiLowPower(true);
    setUiReducedEffects(true);
    setUiPortalBackgroundStyle('minimal');
    setUiChannelBackgroundStyle('minimal');
    setUiDmBackgroundStyle('minimal');
    applyUiVisualPreferences();
  }

  function applyThemeManifest(overrides: Record<string, string>, name = themeName) {
    const manifest = {
      version: DEFAULT_THEME_V2.version,
      name,
      overrides,
    };
    const { theme } = resolveThemeV2(manifest);
    setThemeManifestPreference(manifest);
    applyThemeV2(theme);
  }

  function handleThemeOverrideChange(tokenKey: string, value: string) {
    const nextOverrides = {
      ...themeOverrides,
      [tokenKey]: value,
    };
    setThemeOverrides(nextOverrides);
    setThemeError('');
    if (uiV2TokensEnabled) {
      applyThemeManifest(nextOverrides);
    }
  }

  function handleApplyThemePreset(preset: (typeof THEME_PRESETS_V3)[number]) {
    const nextOverrides = {
      ...themeOverrides,
      ...preset.overrides,
    };
    setThemeName(preset.name);
    setThemeOverrides(nextOverrides);
    setThemeError('');
    if (uiV2TokensEnabled) {
      applyThemeManifest(nextOverrides, preset.name);
    } else {
      setThemeManifestPreference({
        version: DEFAULT_THEME_V2.version,
        name: preset.name,
        overrides: nextOverrides,
      });
    }
  }

  function handleResetTheme() {
    setThemeName(DEFAULT_THEME_V2.name);
    setThemeOverrides({});
    setThemeImportValue('');
    setThemeError('');
    clearThemeManifestPreference();
    if (uiV2TokensEnabled) {
      applyThemeV2(DEFAULT_THEME_V2);
    }
  }

  async function handleExportTheme() {
    const payload = {
      version: DEFAULT_THEME_V2.version,
      name: themeName.trim() || DEFAULT_THEME_V2.name,
      overrides: themeOverrides,
    };
    const serialized = JSON.stringify(payload, null, 2);
    await navigator.clipboard.writeText(serialized);
    setThemeImportValue(serialized);
  }

  function handleImportTheme() {
    setThemeError('');
    try {
      const parsed = JSON.parse(themeImportValue) as {
        version?: string;
        name?: string;
        overrides?: Record<string, string>;
      };
      const nextName = (parsed.name ?? DEFAULT_THEME_V2.name).trim() || DEFAULT_THEME_V2.name;
      const nextOverrides = parsed.overrides ?? {};
      setThemeName(nextName);
      setThemeOverrides(nextOverrides);
      if (uiV2TokensEnabled) {
        applyThemeManifest(nextOverrides, nextName);
      } else {
        setThemeManifestPreference({
          version: parsed.version ?? DEFAULT_THEME_V2.version,
          name: nextName,
          overrides: nextOverrides,
        });
      }
    } catch (err) {
      setThemeError(getErrorMessage(err));
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

  function toggleDisplayNameStyles(enabled: boolean) {
    if (!user) return;
    saveDisplayNameStylePrefs(user.id, {
      ...stylePrefs,
      stylesEnabled: enabled,
    });
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
    api.users.updateCustomStatus({
      text: statusInput.trim().slice(0, 100),
      expiresAt: (() => { const ts = computeExpiryFromPreset(statusExpiryPreset); return ts != null ? new Date(ts).toISOString() : null; })(),
    }).catch(() => {});
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
    api.users.updateWidgets(widgets).catch(() => {});
  }


  function updateAvatarStudio(next: AvatarStudioPrefs) {
    if (!user) return;
    setAvatarStudioPrefs(next);
    saveAvatarStudioPrefs(user.id, next);
  }

  function resetAvatarStudio() {
    updateAvatarStudio(DEFAULT_AVATAR_STUDIO_PREFS);
  }

  function randomizeAvatarStudio() {
    const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)]!;
    updateAvatarStudio({
      ...avatarStudioPrefs,
      enabled: true,
      sprite: {
        ...avatarStudioPrefs.sprite,
        skinTone: pick(SKIN_TONES),
        hairColor: pick(HAIR_COLORS),
        hairStyle: pick(['short', 'long', 'spike'] as const),
        faceStyle: pick(['smile', 'neutral', 'wink'] as const),
        topColor: pick(CLOTHES_COLORS),
        bottomColor: pick(['#263659', '#1f4d3c', '#422b58', '#4e2f1d'] as const),
        shoesColor: pick(['#10161f', '#e9ecf1', '#ad6f3b', '#3f4758'] as const),
        hatStyle: pick(['none', 'beanie', 'crown'] as const),
        accessoryStyle: pick(['none', 'glasses', 'star'] as const),
      },
    });
  }


  if (!user) return null;
  const isBugInboxAdmin = !!user.isAdmin;

  return (
    <div className="settings-page">
      <aside className="settings-sidebar">
        <div className="settings-sidebar-title">User Settings</div>
        <nav className="settings-nav">
          <button
            className={`settings-nav-item ${section === 'account' ? 'settings-nav-item-active' : ''}`}
            onClick={() => setSection('account')}
          >
            My Account
          </button>
          <button
            className={`settings-nav-item ${section === 'customization' ? 'settings-nav-item-active' : ''}`}
            onClick={() => setSection('customization')}
          >
            Customization
          </button>
          <button
            className={`settings-nav-item ${section === 'appearance' ? 'settings-nav-item-active' : ''}`}
            onClick={() => setSection('appearance')}
          >
            Appearance
          </button>
          <button
            className={`settings-nav-item ${section === 'notifications' ? 'settings-nav-item-active' : ''}`}
            onClick={() => setSection('notifications')}
          >
            Notifications
          </button>
          <button
            className={`settings-nav-item ${section === 'security' ? 'settings-nav-item-active' : ''}`}
            onClick={() => setSection('security')}
          >
            Security
          </button>
          <button
            className={`settings-nav-item ${section === 'accessibility' ? 'settings-nav-item-active' : ''}`}
            onClick={() => setSection('accessibility')}
          >
            Accessibility
          </button>
          <button
            className={`settings-nav-item ${section === 'logout' ? 'settings-nav-item-active' : ''}`}
            onClick={() => setSection('logout')}
          >
            Log Out
          </button>
        </nav>
      </aside>
      <div className="settings-content">
        <button className="settings-close" onClick={handleClose} aria-label="Close">
          &times;
        </button>

        {section === 'account' && (
          <section className="settings-section">
            <h2 className="settings-section-title">My Account</h2>
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
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <Avatar
                    name={profile?.displayName ?? user.displayName}
                    hash={profile?.avatarHash ?? user.avatarHash}
                    decorationHash={equippedAvatarDecoration?.assetHash ?? null}
                    userId={user.id}
                    size={64}
                    className="settings-profile-avatar"
                  />
                  {profile === null && (
                    <div style={{ position: 'absolute', bottom: 0, right: 0, background: '#2c2c3e', borderRadius: '50%', padding: 2 }}>
                      <LoadingSpinner size={16} />
                    </div>
                  )}
                </div>
                <div className="settings-profile-info">
                  <div className="settings-profile-name">{profile?.displayName ?? user.displayName}</div>
                  <div className="settings-profile-username">@{user.username}</div>
                </div>
                <Button variant="ghost" onClick={() => openModal('settings', { type: 'user', initialSection: 'profile' })}>Edit Profile</Button>
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
                  <div className="settings-field-value">Internal triage tools for beta testing and bug review.</div>
                </div>
                <div className="settings-field-control settings-field-row">
                  <Link to="/ops/bugs">
                    <Button>Open Bug Inbox</Button>
                  </Link>
                </div>
              </div>
            )}
          </section>
        )}

        {section === 'security' && (
          <section className="settings-section">
            <h2 className="settings-section-title">Security</h2>
            <MfaSettingsCard />
            <div className="settings-card">
              <div className="settings-field">
                <div className="settings-field-label">Email Verification</div>
                <div className="settings-field-value">
                  Email verification is enabled for new account rollout flows. Existing beta accounts
                  may continue to sign in while migration completes.
                </div>
              </div>
            </div>
          </section>
        )}

        {section === 'customization' && (
          <section className="settings-section">
            <h2 className="settings-section-title">Customization</h2>
            <div className="settings-card">
              <div className="settings-field">
                <div className="settings-field-label">Display Name Styles</div>
                <div className="settings-field-value">Customize font, effect, and colors.</div>
              </div>
              <div className={`dns-preview ${previewTheme === 'light' ? 'dns-preview-light' : ''}`}>
                <div className="dns-preview-label">Preview</div>
                <div className="dns-preview-name">
                  <DisplayNameText
                    text={profile?.displayName ?? user.displayName}
                    userId={user.id}
                    guildId={styleScope === 'global' ? null : styleScope}
                    context="profile"
                  />
                </div>
              </div>
              <div className="settings-field-control settings-field-row">
                <Button variant="ghost" onClick={() => setPreviewTheme((p) => (p === 'dark' ? 'light' : 'dark'))}>
                  {previewTheme === 'dark' ? 'Light Mode Preview' : 'Dark Mode Preview'}
                </Button>
                <Button variant="ghost" onClick={handleSurpriseMe}>Surprise Me</Button>
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
                        onChange={(e) => updateStyle({ ...activeStyle, font: e.target.value as DisplayNameStyle['font'] })}
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
                        onChange={(e) => updateStyle({ ...activeStyle, effect: e.target.value as DisplayNameStyle['effect'] })}
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
                      placeholder="What’s on your mind?"
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

            </div>
          </section>
        )}

        {section === 'appearance' && (
          <section className="settings-section">
            <h2 className="settings-section-title">Appearance</h2>
            <div className="settings-card">
              <div className="settings-field">
                <div className="settings-field-label">Theme</div>
                <div className="settings-field-value">Dark (default)</div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Visual Presets</div>
                <div className="settings-field-control settings-field-row">
                  <Button variant="ghost" onClick={() => handleApplyVisualPreset('balanced')}>Balanced</Button>
                  <Button variant="ghost" onClick={() => handleApplyVisualPreset('immersive')}>Immersive</Button>
                  <Button variant="ghost" onClick={() => handleApplyVisualPreset('performance')}>Performance</Button>
                  <Button variant="ghost" onClick={handleResetVisualPreferences}>Reset Visuals</Button>
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Message Density</div>
                <div className="settings-field-control">
                  <select
                    className="settings-select"
                    value={messageDisplay}
                    onChange={(event) => setMessageDisplay(event.target.value)}
                  >
                    <option value="cozy">Cozy</option>
                    <option value="compact">Compact</option>
                  </select>
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Font Scale</div>
                <div className="settings-field-control">
                  <input
                    className="settings-range"
                    type="range"
                    min="0.8"
                    max="1.4"
                    step="0.05"
                    value={fontScale}
                    onChange={(event) => setFontScale(Number(event.target.value))}
                  />
                  <span className="settings-range-value">{fontScale.toFixed(2)}x</span>
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Modern UI Preview</div>
                <div className="settings-field-control">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={uiV2TokensEnabled}
                      onChange={(event) => handleToggleUiV2Tokens(event.target.checked)}
                    />
                    <span className="settings-toggle-indicator" />
                  </label>
                  <span className="settings-range-value">{uiV2TokensEnabled ? 'On' : 'Off'}</span>
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Glass Mode</div>
                <div className="settings-field-control">
                  <select
                    className="settings-select"
                    value={uiGlassMode}
                    onChange={(event) => handleChangeGlassMode(event.target.value as UiGlassMode)}
                  >
                    <option value="off">Off</option>
                    <option value="subtle">Subtle</option>
                    <option value="full">Full</option>
                  </select>
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Surface Background Mode</div>
                <div className="settings-field-control">
                  <select
                    className="settings-select"
                    value={uiSurfaceBackgroundMode}
                    onChange={(event) => handleChangeSurfaceBackgroundMode(event.target.value as UiSurfaceBackgroundMode)}
                  >
                    <option value="contained">Contained</option>
                    <option value="full">Full Surface</option>
                  </select>
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Content Scrim</div>
                <div className="settings-field-control">
                  <select
                    className="settings-select"
                    value={uiContentScrim}
                    onChange={(event) => handleChangeContentScrim(event.target.value as UiContentScrim)}
                  >
                    <option value="soft">Soft</option>
                    <option value="balanced">Balanced</option>
                    <option value="strong">Strong</option>
                  </select>
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Portal Background Style</div>
                <div className="settings-field-control">
                  <select
                    className="settings-select"
                    value={uiPortalBackgroundStyle}
                    onChange={(event) => handleChangeBackgroundStyle('portal', event.target.value as UiBackgroundStyle)}
                  >
                    <option value="auto">Auto</option>
                    <option value="aurora">Aurora</option>
                    <option value="mesh">Mesh</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Channel Background Style</div>
                <div className="settings-field-control">
                  <select
                    className="settings-select"
                    value={uiChannelBackgroundStyle}
                    onChange={(event) => handleChangeBackgroundStyle('channel', event.target.value as UiBackgroundStyle)}
                  >
                    <option value="auto">Auto</option>
                    <option value="aurora">Aurora</option>
                    <option value="mesh">Mesh</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">DM Background Style</div>
                <div className="settings-field-control">
                  <select
                    className="settings-select"
                    value={uiDmBackgroundStyle}
                    onChange={(event) => handleChangeBackgroundStyle('dm', event.target.value as UiBackgroundStyle)}
                  >
                    <option value="auto">Auto</option>
                    <option value="aurora">Aurora</option>
                    <option value="mesh">Mesh</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Low Power Mode</div>
                <div className="settings-field-control">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={uiLowPower}
                      onChange={(event) => handleToggleLowPower(event.target.checked)}
                    />
                    <span className="settings-toggle-indicator" />
                  </label>
                  <span className="settings-range-value">{uiLowPower ? 'On' : 'Off'}</span>
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Reduced Effects</div>
                <div className="settings-field-control">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={uiReducedEffects}
                      onChange={(event) => handleToggleReducedEffects(event.target.checked)}
                    />
                    <span className="settings-toggle-indicator" />
                  </label>
                  <span className="settings-range-value">{uiReducedEffects ? 'On' : 'Off'}</span>
                </div>
              </div>
              <div className="settings-note">
                Background and scrim settings affect message surfaces in portals, DMs, and voice chat panels to preserve readability while keeping custom visual style.
              </div>
              <div className="settings-theme-editor">
                <div className="settings-theme-header">
                  <h3 className="settings-theme-title">Theme Studio (v1)</h3>
                  <p className="settings-muted">
                    Customize core theme tokens and share by exporting/importing JSON.
                  </p>
                </div>
                <div className="settings-theme-presets">
                  {THEME_PRESETS_V3.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className="settings-theme-preset"
                      onClick={() => handleApplyThemePreset(preset)}
                    >
                      <span className="settings-theme-preset-name">{preset.name}</span>
                      <span className="settings-theme-preset-desc">{preset.description}</span>
                    </button>
                  ))}
                </div>
                <div className="settings-field">
                  <div className="settings-field-label">Theme Name</div>
                  <div className="settings-field-control">
                    <Input
                      type="text"
                      value={themeName}
                      onChange={(event) => setThemeName(event.target.value)}
                      placeholder="My Theme"
                    />
                  </div>
                </div>
                <div className="settings-theme-grid">
                  {THEME_TOKEN_CONTROLS.map((token) => {
                    const value = themeOverrides[token.key] ?? DEFAULT_THEME_V2.tokens[token.key] ?? '';
                    return (
                      <label key={token.key} className="settings-theme-field">
                        <span className="settings-theme-label">{token.label}</span>
                        {token.type === 'color' ? (
                          <input
                            type="color"
                            value={value}
                            onChange={(event) => handleThemeOverrideChange(token.key, event.target.value)}
                          />
                        ) : (
                          <Input
                            type="text"
                            value={value}
                            onChange={(event) => handleThemeOverrideChange(token.key, event.target.value)}
                          />
                        )}
                      </label>
                    );
                  })}
                </div>
                <div className="settings-theme-actions">
                  <Button type="button" onClick={() => applyThemeManifest(themeOverrides)}>
                    Apply
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleExportTheme}>
                    Export
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleImportTheme}>
                    Import
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleResetTheme}>
                    Reset
                  </Button>
                </div>
                <textarea
                  className="settings-theme-json"
                  value={themeImportValue}
                  onChange={(event) => setThemeImportValue(event.target.value)}
                  placeholder='Paste a theme JSON payload here, then click "Import".'
                  rows={6}
                />
                {themeError && <div className="settings-error">{themeError}</div>}
              </div>
            </div>
          </section>
        )}

        {section === 'notifications' && (
          <section className="settings-section">
            <h2 className="settings-section-title">Notifications</h2>
            <div className="settings-card">
              <h3 className="settings-subsection-title">Sound Alerts</h3>
              <div className="settings-field">
                <div className="settings-field-label">Enable sounds</div>
                <div className="settings-field-control">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={soundPrefs.enabled}
                      onChange={(event) => updateSoundPrefs((current) => ({ ...current, enabled: event.target.checked }))}
                    />
                    <span className="settings-toggle-indicator" />
                  </label>
                  <span className="settings-range-value">{soundPrefs.enabled ? 'On' : 'Off'}</span>
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Volume</div>
                <div className="settings-field-control settings-field-row">
                  <input
                    className="settings-range"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={soundPrefs.volume}
                    onChange={(event) => updateSoundPrefs((current) => ({ ...current, volume: Number(event.target.value) }))}
                  />
                  <span className="settings-range-value">{soundPrefs.volume}%</span>
                </div>
              </div>
              {([
                ['message', 'Channel Messages', 'message'],
                ['dm', 'Direct Messages', 'dm'],
                ['mention', 'Mentions', 'mention'],
                ['ringtone', 'Incoming Call Ringtone', 'ringtone'],
                ['outgoing-ring', 'Outgoing Call Ring', 'outgoing-ring'],
                ['call-connect', 'Call Connect', 'call-connect'],
                ['call-end', 'Call End', 'call-end'],
              ] as Array<[SoundName, string, SoundName]>).map(([key, label, previewName]) => (
                <div className="settings-field" key={key}>
                  <div className="settings-field-label">{label}</div>
                  <div className="settings-field-control settings-field-row settings-field-row-wrap">
                    <label className="settings-toggle">
                      <input
                        type="checkbox"
                        checked={soundPrefs.sounds[key]}
                        onChange={(event) =>
                          updateSoundPrefs((current) => ({
                            ...current,
                            sounds: { ...current.sounds, [key]: event.target.checked },
                          }))
                        }
                      />
                      <span className="settings-toggle-indicator" />
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => previewSound(previewName)}
                    >
                      Preview
                    </Button>
                  </div>
                </div>
              ))}
              <p className="settings-muted">
                Sound alerts apply in the web app. Per-device settings are stored locally in your browser.
              </p>
            </div>
            <div className="settings-card">
              <h3 className="settings-subsection-title">Voice Soundboard</h3>
              <div className="settings-field">
                <div className="settings-field-label">Hear soundboard clips</div>
                <div className="settings-field-control">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={soundboardPrefs.enabled}
                      onChange={(event) => updateSoundboardPrefs((current) => ({ ...current, enabled: event.target.checked }))}
                    />
                    <span className="settings-toggle-indicator" />
                  </label>
                  <span className="settings-range-value">{soundboardPrefs.enabled ? 'On' : 'Off'}</span>
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Soundboard volume</div>
                <div className="settings-field-control settings-field-row">
                  <input
                    className="settings-range"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={soundboardPrefs.volume}
                    onChange={(event) => updateSoundboardPrefs((current) => ({ ...current, volume: Number(event.target.value) }))}
                  />
                  <span className="settings-range-value">{soundboardPrefs.volume}%</span>
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Entrance sounds</div>
                <div className="settings-field-control">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={soundboardPrefs.entranceEnabled}
                      onChange={(event) => updateSoundboardPrefs((current) => ({ ...current, entranceEnabled: event.target.checked }))}
                    />
                    <span className="settings-toggle-indicator" />
                  </label>
                  <span className="settings-range-value">{soundboardPrefs.entranceEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
              <p className="settings-muted">
                Choose entrance sounds from the Soundboard panel while connected to a server voice channel.
              </p>
            </div>
            <div className="settings-card">
              <h3 className="settings-subsection-title">Do Not Disturb Schedule</h3>
              {dndError && <div className="settings-error">{dndError}</div>}
              <div className="settings-field">
                <div className="settings-field-label">Do Not Disturb</div>
                <div className="settings-field-control">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={dndEnabled}
                      onChange={(event) => setDndEnabled(event.target.checked)}
                    />
                    <span className="settings-toggle-indicator" />
                  </label>
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Schedule</div>
                <div className="settings-field-control settings-field-row">
                  <Input
                    type="time"
                    value={dndStart}
                    onChange={(event) => setDndStart(event.target.value)}
                  />
                  <span className="settings-field-separator">to</span>
                  <Input
                    type="time"
                    value={dndEnd}
                    onChange={(event) => setDndEnd(event.target.value)}
                  />
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Timezone</div>
                <div className="settings-field-control">
                  <Input
                    type="text"
                    value={dndTimezone}
                    onChange={(event) => setDndTimezone(event.target.value)}
                    placeholder="UTC"
                  />
                </div>
              </div>
              <div className="settings-field">
                <div className="settings-field-label">Days</div>
                <div className="settings-field-control settings-days">
                  {DAYS.map((day) => (
                    <button
                      key={day.label}
                      className={`settings-day ${dndDays & (1 << day.bit) ? 'settings-day-active' : ''}`}
                      onClick={() => toggleDay(day.bit)}
                      type="button"
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-footer">
                <Button onClick={handleSaveDnd} loading={savingDnd}>Save Schedule</Button>
              </div>
            </div>
          </section>
        )}

        {section === 'accessibility' && (
          <section className="settings-section">
            <h2 className="settings-section-title">Accessibility</h2>
            <div className="settings-card">
              <div className="settings-field">
                <div className="settings-field-label">Display Name Styles</div>
                <div className="settings-field-control">
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={stylePrefs.stylesEnabled}
                      onChange={(event) => toggleDisplayNameStyles(event.target.checked)}
                    />
                    <span className="settings-toggle-indicator" />
                  </label>
                  <span className="settings-range-value">{stylePrefs.stylesEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {section === 'logout' && (
          <section className="settings-section">
            <h2 className="settings-section-title">Log Out</h2>
            <div className="settings-card">
              <p className="settings-muted">You will be signed out of this device.</p>
              <Button variant="danger" onClick={handleLogout}>Log Out</Button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
