import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X, Check, ZoomIn, ZoomOut, RotateCw, Volume2, VolumeX, Copy, Info, Link2, Globe, Search, Download, Upload, Star, Sun, Moon, Dices, Eye, Sparkles, Palette, ShoppingBag, Edit3, Trash2, Share2 } from 'lucide-react';
import { useTheme, ButtonShape, AppTheme, ColorMode, FontFamily, FontSize, GlassMode, FocusIndicatorSize, ColorBlindMode } from '../ui/ThemeProvider';
import { haptic } from '../../utils/haptics';
import { useToast } from '../ui/ToastManager';
import { useUser } from '../../contexts/UserContext';
import { isSoundMuted, setSoundMuted, getSoundVolume, setSoundVolume, getSoundPack, setSoundPack, playSound } from '../../utils/SoundManager';
import { api, API_BASE } from '../../lib/api';
import LoginHistoryPage from '../../pages/app/LoginHistory';
import { ProfileThemeEditor } from '../guild/ProfileThemeEditor';
import Avatar from '../ui/Avatar';
import { useIsMobile } from '../../hooks/useIsMobile';
import { SettingsAccountTab, SettingsFeedbackTab, SettingsAchievementsTab, SettingsStatsTab, SettingsConnectionsTab, SettingsPrivacyTab, SettingsThemeTab, SettingsAccessibilityTab, SettingsSoundTab } from './settings';
import { SettingsFederationTab } from './settings/SettingsFederationTab';
import { copyToClipboard } from '../../utils/clipboard';
import type { UserProfileLike, UserThemeLike } from './settings/types';
import { AVAILABLE_LOCALES, getLocale, setLocale } from '../../i18n';
import { CODE_THEMES as codeThemeOptions, getCodeTheme as codeThemeGet, setCodeTheme as codeThemeSet, type CodeThemeId } from '../../utils/codeTheme';
import { getAllThemesIncludingCustom, getAllThemes, searchThemes, getThemesByCategory, getCategories, toggleFavoriteTheme, isFavoriteTheme, getFavoriteThemeIds, getRecentThemeIds, resolveTheme, getCustomThemes, deleteCustomTheme, saveCustomTheme } from '../../themes/registry';
import type { ThemeDefinition, ThemeCategory } from '../../themes/types';
import ThemePreview from '../ui/ThemePreview';
import ThemeEditorModal from './ThemeEditorModal';
import ThemeStoreModal from './ThemeStoreModal';
import PluginStoreModal from './PluginStoreModal';
import { CODE_THEMES as codeThemeList } from '../../utils/codeTheme';

// ─── Image Crop Modal ────────────────────────────────────────────────────────

const CropModal = ({
    file,
    aspect,
    onConfirm,
    onCancel,
}: {
    file: File;
    aspect: 'circle' | 'banner';
    onConfirm: (url: string) => void;
    onCancel: () => void;
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
    const [zoom, setZoom] = useState(1);
    const [minZoom, setMinZoom] = useState(0.3);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

    const CANVAS_W = aspect === 'banner' ? 480 : 300;
    const CANVAS_H = aspect === 'banner' ? 160 : 300;
    const CROP_W = aspect === 'banner' ? 440 : 220;
    const CROP_H = aspect === 'banner' ? 140 : 220;
    const CROP_X = (CANVAS_W - CROP_W) / 2;
    const CROP_Y = (CANVAS_H - CROP_H) / 2;

    useEffect(() => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            setImgEl(img);
            // Center image initially
            const scale = Math.max(CROP_W / img.naturalWidth, CROP_H / img.naturalHeight);
            setMinZoom(scale);
            setZoom(scale);
            setOffset({ x: CANVAS_W / 2, y: CANVAS_H / 2 });
        };
        img.src = url;
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !imgEl) return;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        const iw = imgEl.naturalWidth * zoom;
        const ih = imgEl.naturalHeight * zoom;
        const ix = offset.x - iw / 2;
        const iy = offset.y - ih / 2;

        // Draw full image dimmed
        ctx.globalAlpha = 0.3;
        ctx.drawImage(imgEl, ix, iy, iw, ih);
        ctx.globalAlpha = 1.0;

        // Clip to crop area and draw bright
        ctx.save();
        ctx.beginPath();
        if (aspect === 'circle') {
            ctx.arc(CANVAS_W / 2, CANVAS_H / 2, CROP_W / 2, 0, Math.PI * 2);
        } else {
            ctx.rect(CROP_X, CROP_Y, CROP_W, CROP_H);
        }
        ctx.clip();
        ctx.drawImage(imgEl, ix, iy, iw, ih);
        ctx.restore();

        // Crop border
        ctx.save();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        if (aspect === 'circle') {
            ctx.beginPath();
            ctx.arc(CANVAS_W / 2, CANVAS_H / 2, CROP_W / 2, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.strokeRect(CROP_X, CROP_Y, CROP_W, CROP_H);
        }
        ctx.restore();
    }, [imgEl, zoom, offset, aspect]);

    useEffect(() => { draw(); }, [draw]);

    const onMouseDown = (e: React.MouseEvent) => {
        setDragging(true);
        dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!dragging || !imgEl) return;
        const dx = e.clientX - dragStart.current.mx;
        const dy = e.clientY - dragStart.current.my;
        const iw = imgEl.naturalWidth * zoom;
        const ih = imgEl.naturalHeight * zoom;
        // Clamp so image always covers the crop area
        const minX = CROP_X + CROP_W - iw / 2;
        const maxX = CROP_X + iw / 2;
        const minY = CROP_Y + CROP_H - ih / 2;
        const maxY = CROP_Y + ih / 2;
        setOffset({
            x: Math.min(maxX, Math.max(minX, dragStart.current.ox + dx)),
            y: Math.min(maxY, Math.max(minY, dragStart.current.oy + dy)),
        });
    };
    const onMouseUp = () => setDragging(false);

    const handleConfirm = () => {
        if (!imgEl) return;
        const out = document.createElement('canvas');
        out.width = CROP_W;
        out.height = CROP_H;
        const ctx = out.getContext('2d')!;
        // Output as a square crop — the UI applies border-radius for circular display
        const iw = imgEl.naturalWidth * zoom;
        const ih = imgEl.naturalHeight * zoom;
        const imgDrawX = (offset.x - iw / 2) - CROP_X;
        const imgDrawY = (offset.y - ih / 2) - CROP_Y;
        ctx.drawImage(imgEl, imgDrawX, imgDrawY, iw, ih);
        onConfirm(out.toDataURL('image/png'));
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: '16px', padding: '28px', width: CANVAS_W + 56, border: '1px solid var(--stroke)', boxShadow: '0 24px 48px rgba(0,0,0,0.6)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontWeight: 600, fontSize: '17px' }}>
                        {aspect === 'circle' ? 'Crop Avatar' : 'Crop Banner'}
                    </h3>
                    <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Drag to reposition. Use the zoom slider to adjust.</p>

                <canvas
                    ref={canvasRef}
                    width={CANVAS_W}
                    height={CANVAS_H}
                    style={{ display: 'block', borderRadius: '8px', cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none', marginBottom: '16px', border: '1px solid var(--stroke)' }}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={onMouseUp}
                    onWheel={(e) => {
                        e.preventDefault();
                        setZoom(z => Math.min(3, Math.max(minZoom, z + e.deltaY * -0.001)));
                    }}
                />

                {/* Zoom slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <ZoomOut size={16} color="var(--text-muted)" />
                    <input
                        type="range"
                        min={minZoom}
                        max={3}
                        step={0.01}
                        value={zoom}
                        onChange={e => setZoom(Math.max(minZoom, parseFloat(e.target.value)))}
                        style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
                    />
                    <ZoomIn size={16} color="var(--text-muted)" />
                    <button
                        onClick={() => {
                            if (!imgEl) return;
                            const scale = Math.max(CROP_W / imgEl.naturalWidth, CROP_H / imgEl.naturalHeight);
                            setZoom(scale);
                            setOffset({ x: CANVAS_W / 2, y: CANVAS_H / 2 });
                        }}
                        title="Reset"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', padding: '4px 6px', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
                        <RotateCw size={14} />
                    </button>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                    <button onClick={handleConfirm} style={{ flex: 1, padding: '10px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', cursor: 'pointer', fontWeight: 600 }}>Apply Crop</button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Settings Modal ─────────────────────────────────────────────────────

const SettingsModal = ({
    onClose,
    userProfile,
    setUserProfile,
    userTheme,
    setUserTheme
}: {
    onClose: () => void;
    userProfile?: UserProfileLike;
    setUserProfile?: React.Dispatch<React.SetStateAction<UserProfileLike>>;
    userTheme?: UserThemeLike;
    setUserTheme?: (theme: UserThemeLike) => void;
}) => {
    const { theme, setTheme, colorMode, setColorMode, fontFamily, setFontFamily, fontSize, setFontSize, showChannelBackgrounds, setShowChannelBackgrounds, playMovingBackgrounds, setPlayMovingBackgrounds, glassMode, setGlassMode, reducedEffects, setReducedEffects, lowPower, setLowPower, accentColor, setAccentColor, highContrast, setHighContrast, compactMode, setCompactMode, buttonShape, setButtonShape, screenReaderMode, setScreenReaderMode, linkUnderlines, setLinkUnderlines, focusIndicatorSize, setFocusIndicatorSize, colorBlindMode, setColorBlindMode, lowDataMode, setLowDataMode, previewTheme } = useTheme();
    const { addToast } = useToast();
    const isMobile = useIsMobile();

    const [activeTab, setActiveTab] = useState<'account' | 'profile' | 'security' | 'sessions' | 'theme' | 'accessibility' | 'sound' | 'feedback' | 'privacy' | 'connections' | 'federation' | 'achievements' | 'stats' | 'wardrobe' | 'notifications' | 'muted-users' | 'referrals' | 'developer' | 'dnd-schedule' | 'snippets'>('account');
    const [settingsSearch, setSettingsSearch] = useState('');
    const settingsSearchRef = useRef<HTMLInputElement>(null);
    const [birthdayMonth, setBirthdayMonth] = useState(() => localStorage.getItem('gratonite_birthday_month') ?? '');
    const [birthdayDay, setBirthdayDay] = useState(() => localStorage.getItem('gratonite_birthday_day') ?? '');

    // Settings search index — maps keywords to tabs
    const settingsIndex = useMemo(() => [
        { tab: 'account', label: 'My Account', keywords: ['account', 'email', 'username', 'password', 'delete account', 'two-factor', 'mfa', '2fa'] },
        { tab: 'profile', label: 'Profile', keywords: ['profile', 'avatar', 'banner', 'display name', 'bio', 'about me', 'nameplate'] },
        { tab: 'sessions', label: 'Sessions', keywords: ['sessions', 'devices', 'login', 'active sessions', 'mutes', 'muted users'] },
        { tab: 'privacy', label: 'Privacy & Safety', keywords: ['privacy', 'safety', 'block', 'data export', 'gdpr', 'dm', 'direct message', 'friend request'] },
        { tab: 'connections', label: 'Connections', keywords: ['connections', 'linked accounts', 'github', 'spotify', 'twitter'] },
        { tab: 'federation', label: 'Federation', keywords: ['federation', 'relay', 'federated', 'instances', 'self-host', 'export', 'import', 'portability'] },
        { tab: 'achievements', label: 'Achievements', keywords: ['achievements', 'badges', 'trophies', 'unlocked'] },
        { tab: 'stats', label: 'Stats', keywords: ['stats', 'statistics', 'messages sent', 'activity', 'analytics'] },
        { tab: 'wardrobe', label: 'Wardrobe', keywords: ['wardrobe', 'cosmetics', 'avatar frame', 'decoration', 'nameplate style'] },
        { tab: 'theme', label: 'Theme', keywords: ['theme', 'dark mode', 'light mode', 'color', 'accent', 'font', 'glass', 'compact', 'button shape', 'neobrutalism', 'import', 'export'] },
        { tab: 'sound', label: 'Sound', keywords: ['sound', 'volume', 'notification', 'mute', 'audio', 'ambient'] },
        { tab: 'notifications', label: 'Notifications', keywords: ['notifications', 'push', 'email', 'digest', 'alerts'] },
        { tab: 'muted-users', label: 'Muted Users', keywords: ['muted', 'mute', 'blocked users', 'silence'] },
        { tab: 'referrals', label: 'Referrals', keywords: ['referral', 'invite', 'referral link', 'share'] },
        { tab: 'developer', label: 'Developer', keywords: ['developer', 'oauth', 'application', 'api', 'bot', 'token'] },
        { tab: 'accessibility', label: 'Accessibility', keywords: ['accessibility', 'screen reader', 'reduced motion', 'color blind', 'focus', 'underline', 'high contrast', 'link underlines'] },
        { tab: 'feedback', label: 'Send Feedback', keywords: ['feedback', 'bug', 'report', 'suggestion', 'feature request'] },
        { tab: 'dnd-schedule', label: 'DND Schedule', keywords: ['dnd', 'do not disturb', 'schedule', 'quiet hours', 'auto dnd', 'sleep'] },
        { tab: 'snippets', label: 'Snippets', keywords: ['snippets', 'quick reply', 'template', 'canned response', 'saved text'] },
    ] as const, []);

    // Filter tabs based on search
    const matchingTabs = useMemo(() => {
        if (!settingsSearch.trim()) return null;
        const q = settingsSearch.toLowerCase();
        return new Set(
            settingsIndex
                .filter(entry => entry.keywords.some(kw => kw.includes(q)) || entry.label.toLowerCase().includes(q))
                .map(entry => entry.tab)
        );
    }, [settingsSearch, settingsIndex]);

    // Auto-navigate to first matching tab when searching
    useEffect(() => {
        if (matchingTabs && matchingTabs.size > 0 && !(matchingTabs as Set<string>).has(activeTab)) {
            setActiveTab(matchingTabs.values().next().value as typeof activeTab);
        }
    }, [matchingTabs, activeTab]);

    // Ctrl+F focuses search input
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
                e.preventDefault();
                settingsSearchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const [customHex, setCustomHex] = useState('');
    const [codeThemeId, setCodeThemeId] = useState<string>(codeThemeGet());
    const [themeSearchQuery, setThemeSearchQuery] = useState('');
    const [themeCategory, setThemeCategory] = useState<ThemeCategory | 'all'>('all');
    const [favIds, setFavIds] = useState<string[]>(() => getFavoriteThemeIds());
    const [showThemeEditor, setShowThemeEditor] = useState(false);
    const [editingCustomThemeId, setEditingCustomThemeId] = useState<string | undefined>();
    const [showThemeStore, setShowThemeStore] = useState(false);
    const [showPluginStore, setShowPluginStore] = useState(false);
    const [customThemesList, setCustomThemesList] = useState<ThemeDefinition[]>(() => getCustomThemes());
    const themeImportRef = useRef<HTMLInputElement>(null);
    const [codeSuggestion, setCodeSuggestion] = useState<{ themeName: string; codeTheme: string } | null>(null);
    const [fullPreviewId, setFullPreviewId] = useState<string | undefined>(() => (window as any).__gratoniteFullPreview);

    // Sync full-preview state from window global
    useEffect(() => {
        const handler = () => setFullPreviewId((window as any).__gratoniteFullPreview);
        window.addEventListener('gratonite:full-preview-changed', handler);
        return () => window.removeEventListener('gratonite:full-preview-changed', handler);
    }, []);

    // Item 23: Show code theme suggestion when theme changes
    useEffect(() => {
        const def = resolveTheme(theme);
        if (def?.suggestedCodeTheme && def.suggestedCodeTheme !== codeThemeId) {
            setCodeSuggestion({ themeName: def.name, codeTheme: def.suggestedCodeTheme });
        } else {
            setCodeSuggestion(null);
        }
    }, [theme]);

    // Seasonal theme suggestion helper
    const getSeasonalSuggestion = useCallback(() => {
        const month = new Date().getMonth(); // 0-indexed
        if (month === 9) return { message: "It's spooky season! Try the Cyberpunk theme", themeId: 'cyberpunk', emoji: '🎃' };
        if (month === 11) return { message: "Happy holidays! Try the Arctic theme", themeId: 'arctic', emoji: '🎄' };
        if (month === 5) return { message: "Happy Pride Month! Try the Bubblegum theme", themeId: 'bubblegum', emoji: '🌈' };
        return null;
    }, []);

    const [hexError, setHexError] = useState(false);
    const [soundMuted, setSoundMutedState] = useState(isSoundMuted());
    const [soundVolume, setSoundVolumeState] = useState(getSoundVolume());
    const [soundPack, setSoundPackState] = useState(getSoundPack());
    const [noiseSuppressionEnabled, setNoiseSuppressionEnabledState] = useState(
        () => localStorage.getItem('noiseSuppression') === 'true',
    );
    const [ambientMode, setAmbientMode] = useState<string>(
        () => localStorage.getItem('gratonite_ambient_mode') ?? 'off'
    );
    const [ambientVolume, setAmbientVolume] = useState<number>(
        () => parseFloat(localStorage.getItem('gratonite_ambient_volume') ?? '0.5')
    );
    const [notificationVolume, setNotificationVolume] = useState<number>(
        () => {
            const raw = parseFloat(localStorage.getItem('gratonite_notification_volume') ?? '0.7');
            return raw > 1 ? raw / 100 : raw;
        }
    );
    const [nameplateStyle, setNameplateStyle] = useState<'none' | 'rainbow' | 'fire' | 'ice' | 'gold' | 'glitch'>((userProfile?.nameplateStyle || 'none') as any);
    const [previewAvatarFrame, setPreviewAvatarFrame] = useState<'none' | 'neon' | 'gold' | 'glass' | 'rainbow' | 'pulse'>((userProfile?.avatarFrame || 'none') as any);
    const [bioValue, setBioValue] = useState(userProfile?.bio || '');
    const [bioSaving, setBioSaving] = useState(false);
    const [cropTarget, setCropTarget] = useState<'avatar' | 'banner' | null>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [joinedGuilds, setJoinedGuilds] = useState<Array<{ id: string; name: string; iconHash: string | null; memberCount: number; nickname?: string | null }>>([]);
    const [nicknameDrafts, setNicknameDrafts] = useState<Record<string, string>>({});
    const [savingNicknameForGuildId, setSavingNicknameForGuildId] = useState<string | null>(null);
    const [serverProfileDrafts, setServerProfileDrafts] = useState<Record<string, { displayName: string; bio: string }>>({});
    const [savingServerProfileForGuildId, setSavingServerProfileForGuildId] = useState<string | null>(null);

    // Wardrobe tab state
    interface WardrobeItem { itemId: string; type: string; equipped?: boolean; assetConfig?: Record<string, unknown>; name?: string; rarity?: string; previewUrl?: string; [key: string]: unknown; }
    const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
    const [wardrobeCategory, setWardrobeCategory] = useState<string>('avatar_frame');
    const [wardrobePreviewFrame, setWardrobePreviewFrame] = useState<string>('none');
    const [wardrobePreviewFrameColor, setWardrobePreviewFrameColor] = useState<string | undefined>();
    const [wardrobePreviewNameplate, setWardrobePreviewNameplate] = useState<string>('none');
    const [wardrobeLoading, setWardrobeLoading] = useState(false);
    const [wardrobeSaving, setWardrobeSaving] = useState(false);
    const [wardrobeSelectedIds, setWardrobeSelectedIds] = useState<Record<string, string>>({}); // type -> itemId

    // Email notification states
    const [emailMentions, setEmailMentions] = useState(false);
    const [emailDms, setEmailDms] = useState(false);
    const [emailFrequency, setEmailFrequency] = useState<'instant' | 'daily' | 'never'>('never');

    // Escape to close
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // Fetch email notification settings on mount
    useEffect(() => {
        api.users.getSettings().then((settings: Record<string, unknown>) => {
            const emailNotifs = settings?.emailNotifications as Record<string, unknown> | undefined;
            if (emailNotifs) {
                setEmailMentions((emailNotifs.mentions as boolean) ?? false);
                setEmailDms((emailNotifs.dms as boolean) ?? false);
                setEmailFrequency((emailNotifs.frequency as 'instant' | 'daily' | 'never') ?? 'never');
            }
        }).catch(() => addToast({ title: 'Failed to load settings', variant: 'error' }));
    }, []);

    const { user: ctxUser, updateUser, refetchUser } = useUser();
    const [editDisplayName, setEditDisplayName] = useState('');
    const [editUsername, setEditUsername] = useState('');
    const [editEmail, setEditEmail] = useState('');

    // Populate edit fields from UserContext on mount / when user changes
    useEffect(() => {
        if (ctxUser.id) {
            setEditDisplayName(prev => prev || ctxUser.name);
            setEditUsername(prev => prev || ctxUser.handle);
            setEditEmail(prev => prev || ctxUser.email);
        }
    }, [ctxUser.id, ctxUser.name, ctxUser.handle, ctxUser.email]);


    // 2FA states
    const [authenticatorEnabled, setAuthenticatorEnabled] = useState(false);
    const [showAuthenticatorSetup, setShowAuthenticatorSetup] = useState(false);
    const [mfaLoading, setMfaLoading] = useState(false);
    const [mfaQrCodeUrl, setMfaQrCodeUrl] = useState('');
    const [mfaSecret, setMfaSecret] = useState('');
    const [mfaVerifyCode, setMfaVerifyCode] = useState('');
    const [mfaDisableCode, setMfaDisableCode] = useState('');
    const [showMfaDisableDialog, setShowMfaDisableDialog] = useState(false);
    const [mfaStep, setMfaStep] = useState(1);
    const [smsEnabled, setSmsEnabled] = useState(false);
    const [showSmsSetup, setShowSmsSetup] = useState(false);
    const [smsCode, setSmsCode] = useState('');
    const [showBackupCodes, setShowBackupCodes] = useState(false);
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [backupCodesLoading, setBackupCodesLoading] = useState(false);
    const [backupCodesVerifyCode, setBackupCodesVerifyCode] = useState('');
    const [showBackupCodesVerify, setShowBackupCodesVerify] = useState(false);


    // Fetch wardrobe inventory
    useEffect(() => {
        if (activeTab !== 'wardrobe') return;
        setWardrobeLoading(true);
        api.inventory.get().then((data: Record<string, unknown>) => {
            const items = (data.items ?? []) as WardrobeItem[];
            setWardrobeItems(items);
            // Pre-select currently equipped items
            const selected: Record<string, string> = {};
            for (const item of items) {
                if (item.equipped) selected[item.type] = item.itemId;
            }
            setWardrobeSelectedIds(selected);
            const equippedFrame = items.find((i) => i.type === 'avatar_frame' && i.equipped);
            const equippedNameplate = items.find((i) => i.type === 'nameplate' && i.equipped);
            if (equippedFrame) {
                const cfg = (equippedFrame.assetConfig ?? {}) as Record<string, unknown>;
                setWardrobePreviewFrame((cfg.frameStyle as string) ?? 'neon');
                setWardrobePreviewFrameColor(cfg.glowColor as string | undefined);
            }
            if (equippedNameplate) {
                const cfg = (equippedNameplate.assetConfig ?? {}) as Record<string, unknown>;
                setWardrobePreviewNameplate((cfg.nameplateStyle as string) ?? 'none');
            }
        }).catch(() => addToast({ title: 'Failed to load wardrobe', variant: 'error' })).finally(() => setWardrobeLoading(false));
    }, [activeTab]);



    const [showServerOverrideInfo, setShowServerOverrideInfo] = useState(false);
    const [seasonalEnabled, setSeasonalEnabled] = useState(() => localStorage.getItem('gratonite-seasonal-effects') === 'true');

    useEffect(() => {
        setNameplateStyle((userProfile?.nameplateStyle || 'none') as any);
        setPreviewAvatarFrame((userProfile?.avatarFrame || 'none') as any);
        setBioValue(userProfile?.bio || '');
    }, [userProfile?.avatarFrame, userProfile?.nameplateStyle, userProfile?.bio]);

    // Fetch MFA status when security tab is active
    const mfaStatusLoadedRef = useRef(false);
    useEffect(() => {
        if (activeTab !== 'security' && !mfaStatusLoadedRef.current) return;
        if (mfaStatusLoadedRef.current) return;
        mfaStatusLoadedRef.current = true;
        api.auth.getMfaStatus().then((status) => {
            setAuthenticatorEnabled(status.enabled);
        }).catch(() => { /* MFA status may not be available */ });
    }, [activeTab]);

    useEffect(() => {
        if (activeTab !== 'profile') return;
        let cancelled = false;
        api.guilds.getMine()
            .then((rows: Array<Record<string, unknown>>) => {
                if (cancelled) return;
                const normalized = (Array.isArray(rows) ? rows : []).map((g) => ({
                    id: g.id as string,
                    name: g.name as string,
                    iconHash: (g.iconHash as string | null) ?? null,
                    memberCount: typeof g.memberCount === 'number' ? g.memberCount : 0,
                    nickname: (g.nickname as string | null) ?? '',
                }));
                setJoinedGuilds(normalized);
                const drafts: Record<string, string> = {};
                normalized.forEach((g) => {
                    drafts[g.id] = g.nickname ?? '';
                });
                setNicknameDrafts(drafts);
            })
            .catch(() => {
                if (cancelled) return;
                addToast({ title: 'Failed to load your server memberships', variant: 'error' });
            });

        return () => {
            cancelled = true;
        };
    }, [activeTab, addToast]);

    // Load user settings from API on mount
    const settingsLoadedRef = useRef(false);
    const settingsFetchedRef = useRef(false);
    useEffect(() => {
        if (settingsFetchedRef.current) return;
        settingsFetchedRef.current = true;
        api.users.getSettings().then((s: Record<string, unknown>) => {
            if (s?.theme) setTheme(s.theme as AppTheme);
            if (s?.colorMode) setColorMode(s.colorMode as ColorMode);
            if (s?.fontFamily) setFontFamily(s.fontFamily as FontFamily);
            if (s?.fontSize) setFontSize(s.fontSize as FontSize);
            if (s?.glassMode !== undefined) setGlassMode(s.glassMode as GlassMode);
            if (s?.buttonShape) setButtonShape(s.buttonShape as ButtonShape);
            if (s?.highContrast !== undefined) setHighContrast(s.highContrast as boolean);
            if (s?.compactMode !== undefined) setCompactMode(s.compactMode as boolean);
            if (s?.accentColor) setAccentColor(s.accentColor as string);
            if (s?.reducedMotion !== undefined) setReducedEffects(s.reducedMotion as boolean);
            if (s?.lowPower !== undefined) setLowPower(s.lowPower as boolean);
            if (s?.soundVolume !== undefined) {
                const vol = (s.soundVolume as number) > 1 ? (s.soundVolume as number) / 100 : (s.soundVolume as number);
                setSoundVolumeState(vol);
                setSoundVolume(vol);
            }
            if (s?.colorBlindMode !== undefined) {
                // Migrate old boolean true → 'deuteranopia'
                const cb = s.colorBlindMode === true ? 'deuteranopia' : s.colorBlindMode === false ? 'none' : s.colorBlindMode;
                if (cb === 'deuteranopia' || cb === 'protanopia' || cb === 'tritanopia' || cb === 'none') setColorBlindMode(cb as ColorBlindMode);
            }
            // Mark as loaded AFTER applying server values so auto-save doesn't fire with defaults
            settingsLoadedRef.current = true;
        }).catch(() => { settingsLoadedRef.current = true; /* settings may not exist yet — allow auto-save with defaults */ });

        // Auto-sync nameplateStyle: if DB has no value but localStorage does, push it to the API
        const localNameplate = localStorage.getItem('gratonite-nameplate-style');
        if (localNameplate && localNameplate !== 'none') {
            const dbNameplate = userProfile?.nameplateStyle;
            if (!dbNameplate || dbNameplate === 'none' || dbNameplate === '') {
                api.users.updateProfile({ nameplateStyle: localNameplate }).catch(() => {});
            }
        }
    }, []);

    // Debounced settings save
    const settingsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveSettingsToApi = useCallback((data: Record<string, unknown>) => {
        if (settingsSaveTimerRef.current) clearTimeout(settingsSaveTimerRef.current);
        settingsSaveTimerRef.current = setTimeout(async () => {
            let lastErr: unknown;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    await api.users.updateSettings(data);
                    return;
                } catch (err) {
                    lastErr = err;
                    console.error(`[Settings] sync attempt ${attempt + 1} failed:`, err);
                    if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                }
            }
            const status = (lastErr as any)?.status ?? (lastErr as any)?.response?.status;
            if (status === 401) {
                addToast({ title: 'Session expired', description: 'Please log in again to save settings.', variant: 'error' });
            } else {
                addToast({ title: 'Failed to sync settings', description: 'Your changes may not have been saved. Try again later.', variant: 'error' });
            }
        }, 500);
    }, [addToast]);

    // Persist theme settings to backend whenever they change
    useEffect(() => {
        if (!settingsLoadedRef.current) return;
        saveSettingsToApi({ theme, colorMode, fontFamily, fontSize, glassMode, buttonShape, highContrast, compactMode, accentColor, reducedMotion: reducedEffects, lowPower, screenReaderMode, linkUnderlines, focusIndicatorSize, colorBlindMode });
    }, [theme, colorMode, fontFamily, fontSize, glassMode, buttonShape, highContrast, compactMode, accentColor, reducedEffects, lowPower, screenReaderMode, linkUnderlines, focusIndicatorSize, colorBlindMode, saveSettingsToApi]);

    const persistedAvatarUrl = ctxUser.avatarHash ? `${API_BASE}/files/${ctxUser.avatarHash}` : null;
    const persistedBannerUrl = ctxUser.bannerHash ? `${API_BASE}/files/${ctxUser.bannerHash}` : null;
    const avatarStyle = persistedAvatarUrl ? `url(${persistedAvatarUrl})` : (userProfile?.avatarStyle || 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))');
    const avatarFrame = previewAvatarFrame;
    const bannerStyle = persistedBannerUrl ? `url(${persistedBannerUrl})` : (userProfile?.bannerStyle || 'var(--accent-purple)');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    const applyGlobalAvatarFrame = (frame: 'none' | 'neon' | 'gold' | 'glass' | 'rainbow' | 'pulse') => {
        setPreviewAvatarFrame(frame);
        if (setUserProfile) {
            setUserProfile((prev: UserProfileLike) => ({ ...prev, avatarFrame: frame }));
        }
        try {
            const userId = userProfile?.id || 'me';
            localStorage.setItem(`gratonite-avatar-frame:${userId}`, frame);
            localStorage.setItem('gratonite-avatar-frame', frame);
        } catch { /* no-op */ }
        window.dispatchEvent(new CustomEvent('gratonite:avatar-frame-updated', { detail: { frame } }));
        addToast({ title: 'Avatar frame applied', description: `${frame === 'none' ? 'No frame' : frame} frame is now active.`, variant: 'success' });
    };

    const applyGlobalNameplateStyle = (style: 'none' | 'rainbow' | 'fire' | 'ice' | 'gold' | 'glitch') => {
        setNameplateStyle(style);
        if (setUserProfile) {
            setUserProfile((prev: UserProfileLike) => ({ ...prev, nameplateStyle: style }));
        }
        try {
            const userId = userProfile?.id || 'me';
            localStorage.setItem(`gratonite-nameplate-style:${userId}`, style);
            localStorage.setItem('gratonite-nameplate-style', style);
        } catch { /* no-op */ }
        window.dispatchEvent(new CustomEvent('gratonite:nameplate-updated', { detail: { style } }));
        // Persist to API so it shows in other users' messages
        api.users.updateProfile({ nameplateStyle: style }).catch(() => {});
        addToast({ title: 'Display style applied', description: `${style === 'none' ? 'Default' : style} style is now active.`, variant: 'success' });
    };

    const applyAccentColor = (color: string) => {
        setAccentColor(color);
        if (setUserTheme) {
            setUserTheme({ ...userTheme, accentColor: color });
        }
    };

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPendingFile(file);
            setCropTarget('avatar');
        }
        // Reset input so same file can be re-selected
        e.target.value = '';
    };

    const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPendingFile(file);
            setCropTarget('banner');
        }
        e.target.value = '';
    };

    const handleCropConfirm = async (dataUrl: string) => {
        // Convert the cropped canvas data URL to a File for upload
        const resp = await fetch(dataUrl);
        const blob = await resp.blob();
        const croppedFile = new File([blob], `${cropTarget}.png`, { type: 'image/png' });

        if (cropTarget === 'avatar') {
            try {
                const uploaded = await api.users.uploadAvatar(croppedFile);
                updateUser({ avatarHash: uploaded.avatarHash });
                await refetchUser();
                addToast({ title: 'Avatar Updated', variant: 'success' });
            } catch { addToast({ title: 'Failed to upload avatar', variant: 'error' }); }
        } else if (cropTarget === 'banner') {
            try {
                const uploaded = await api.users.uploadBanner(croppedFile);
                updateUser({ bannerHash: uploaded.bannerHash });
                await refetchUser();
                addToast({ title: 'Banner Updated', variant: 'success' });
            } catch { addToast({ title: 'Failed to upload banner', variant: 'error' }); }
        }
        setCropTarget(null);
        setPendingFile(null);
    };

    const handleRemoveAvatar = async () => {
        try {
            await api.users.deleteAvatar();
            updateUser({ avatarHash: null });
            await refetchUser();
            addToast({ title: 'Avatar Removed', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to remove avatar', variant: 'error' });
        }
    };

    const handleRemoveBanner = async () => {
        try {
            await api.users.deleteBanner();
            updateUser({ bannerHash: null });
            await refetchUser();
            addToast({ title: 'Banner Removed', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to remove banner', variant: 'error' });
        }
    };

    const saveNicknameOverride = async (guildId: string) => {
        const draft = (nicknameDrafts[guildId] ?? '').trim();
        setSavingNicknameForGuildId(guildId);
        try {
            await api.profiles.updateMemberProfile(guildId, { nickname: draft.length ? draft : null });
            setJoinedGuilds((prev) => prev.map((g) => (g.id === guildId ? { ...g, nickname: draft.length ? draft : null } : g)));
            addToast({ title: 'Server nickname updated', variant: 'success' });
        } catch (err: unknown) {
            addToast({ title: 'Failed to update server nickname', description: (err instanceof Error ? err.message : '') || 'Unknown error', variant: 'error' });
        } finally {
            setSavingNicknameForGuildId(null);
        }
    };

    const saveServerProfile = async (guildId: string) => {
        const draft = serverProfileDrafts[guildId];
        if (!draft) return;
        setSavingServerProfileForGuildId(guildId);
        try {
            await api.profiles.updateServerProfile(guildId, {
                displayName: draft.displayName.trim() || null,
                bio: draft.bio.trim() || null,
            });
            addToast({ title: 'Server profile updated', variant: 'success' });
        } catch (err: unknown) {
            addToast({ title: 'Failed to update server profile', description: (err instanceof Error ? err.message : '') || 'Unknown error', variant: 'error' });
        } finally {
            setSavingServerProfileForGuildId(null);
        }
    };

    const resetServerProfile = async (guildId: string) => {
        setSavingServerProfileForGuildId(guildId);
        try {
            await api.profiles.deleteServerProfile(guildId);
            setServerProfileDrafts((prev) => ({ ...prev, [guildId]: { displayName: '', bio: '' } }));
            addToast({ title: 'Server profile reset to global', variant: 'success' });
        } catch (err: unknown) {
            addToast({ title: 'Failed to reset server profile', description: (err instanceof Error ? err.message : '') || 'Unknown error', variant: 'error' });
        } finally {
            setSavingServerProfileForGuildId(null);
        }
    };

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div role="dialog" aria-modal="true" className="settings-modal flex-row glass-panel" onClick={e => e.stopPropagation()} style={{ width: 'min(960px, 95vw)', height: 'min(680px, 90vh)', padding: 0, overflow: 'hidden' }}>
                    {/* Left Sidebar */}
                    <div className="settings-sidebar" style={{ width: '220px', background: 'var(--bg-elevated)', padding: '16px 16px 32px', borderRight: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                        {/* Search */}
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                            <input
                                ref={settingsSearchRef}
                                type="text"
                                placeholder="Search settings..."
                                value={settingsSearch}
                                onChange={e => setSettingsSearch(e.target.value)}
                                style={{ width: '100%', padding: '8px 10px 8px 30px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                            />
                        </div>
                        {matchingTabs && matchingTabs.size === 0 && (
                            <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px 8px' }}>
                                No settings match "{settingsSearch}". Try "theme", "privacy", or "sound".
                            </div>
                        )}
                        {(!matchingTabs || matchingTabs.has('account') || matchingTabs.has('profile') || matchingTabs.has('sessions') || matchingTabs.has('privacy') || matchingTabs.has('connections') || matchingTabs.has('achievements') || matchingTabs.has('stats') || matchingTabs.has('wardrobe')) && (
                        <div>
                            <div className="sidebar-section-label">ACCOUNT</div>
                            {(!matchingTabs || matchingTabs.has('account')) && <div className={`sidebar-nav-item ${activeTab === 'account' ? 'active' : ''}`} onClick={() => { setActiveTab('account'); setSettingsSearch(''); }}>My Account</div>}
                            {(!matchingTabs || matchingTabs.has('profile')) && <div className={`sidebar-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => { setActiveTab('profile'); setSettingsSearch(''); }}>Profile</div>}
                            {(!matchingTabs || matchingTabs.has('sessions')) && <div className={`sidebar-nav-item ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => { setActiveTab('sessions'); setSettingsSearch(''); }}>Sessions</div>}
                            {(!matchingTabs || matchingTabs.has('privacy')) && <div className={`sidebar-nav-item ${activeTab === 'privacy' ? 'active' : ''}`} onClick={() => { setActiveTab('privacy'); setSettingsSearch(''); }}>Privacy &amp; Safety</div>}
                            {(!matchingTabs || matchingTabs.has('connections')) && <div className={`sidebar-nav-item ${activeTab === 'connections' ? 'active' : ''}`} onClick={() => { setActiveTab('connections'); setSettingsSearch(''); }} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Link2 size={14} />Connections</div>}
                            {(!matchingTabs || matchingTabs.has('achievements')) && <div className={`sidebar-nav-item ${activeTab === 'achievements' ? 'active' : ''}`} onClick={() => { setActiveTab('achievements'); setSettingsSearch(''); }}>🏆 Achievements</div>}
                            {(!matchingTabs || matchingTabs.has('stats')) && <div className={`sidebar-nav-item ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => { setActiveTab('stats'); setSettingsSearch(''); }}>📊 Stats</div>}
                            {(!matchingTabs || matchingTabs.has('wardrobe')) && <div className={`sidebar-nav-item ${activeTab === 'wardrobe' ? 'active' : ''}`} onClick={() => { setActiveTab('wardrobe'); setSettingsSearch(''); }}>👗 Wardrobe</div>}
                        </div>
                        )}
                        {(!matchingTabs || matchingTabs.has('theme') || matchingTabs.has('sound') || matchingTabs.has('accessibility')) && (
                        <div>
                            <div className="sidebar-section-label">APPEARANCE</div>
                            {(!matchingTabs || matchingTabs.has('theme')) && <div className={`sidebar-nav-item ${activeTab === 'theme' ? 'active' : ''}`} onClick={() => { setActiveTab('theme'); setSettingsSearch(''); }}>Theme</div>}
                            {(!matchingTabs || matchingTabs.has('sound')) && <div className={`sidebar-nav-item ${activeTab === 'sound' ? 'active' : ''}`} onClick={() => { setActiveTab('sound'); setSettingsSearch(''); }}>Sound</div>}
                            {(!matchingTabs || matchingTabs.has('accessibility')) && <div className={`sidebar-nav-item ${activeTab === 'accessibility' ? 'active' : ''}`} onClick={() => { setActiveTab('accessibility'); setSettingsSearch(''); }}>Accessibility</div>}
                        </div>
                        )}
                        {(!matchingTabs || matchingTabs.has('notifications') || matchingTabs.has('muted-users') || matchingTabs.has('referrals')) && (
                        <div>
                            <div className="sidebar-section-label">NOTIFICATIONS & SOCIAL</div>
                            {(!matchingTabs || matchingTabs.has('notifications')) && <div className={`sidebar-nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => { setActiveTab('notifications'); setSettingsSearch(''); }}>Notifications</div>}
                            {(!matchingTabs || matchingTabs.has('muted-users')) && <div className={`sidebar-nav-item ${activeTab === 'muted-users' ? 'active' : ''}`} onClick={() => { setActiveTab('muted-users'); setSettingsSearch(''); }}>Muted Users</div>}
                            {(!matchingTabs || matchingTabs.has('referrals')) && <div className={`sidebar-nav-item ${activeTab === 'referrals' ? 'active' : ''}`} onClick={() => { setActiveTab('referrals'); setSettingsSearch(''); }}>Referrals</div>}
                            {(!matchingTabs || matchingTabs.has('dnd-schedule')) && <div className={`sidebar-nav-item ${activeTab === 'dnd-schedule' ? 'active' : ''}`} onClick={() => { setActiveTab('dnd-schedule'); setSettingsSearch(''); }}>DND Schedule</div>}
                            {(!matchingTabs || matchingTabs.has('snippets')) && <div className={`sidebar-nav-item ${activeTab === 'snippets' ? 'active' : ''}`} onClick={() => { setActiveTab('snippets'); setSettingsSearch(''); }}>Snippets</div>}
                        </div>
                        )}
                        {(!matchingTabs || matchingTabs.has('developer')) && (
                        <div>
                            <div className="sidebar-section-label">DEVELOPER</div>
                            {(!matchingTabs || matchingTabs.has('developer')) && <div className={`sidebar-nav-item ${activeTab === 'developer' ? 'active' : ''}`} onClick={() => { setActiveTab('developer'); setSettingsSearch(''); }}>Applications</div>}
                            <div className="sidebar-nav-item" onClick={() => setShowPluginStore(true)}>Plugins</div>
                        </div>
                        )}
                        {(!matchingTabs || matchingTabs.has('feedback')) && (
                        <div>
                            <div className="sidebar-section-label">SUPPORT</div>
                            <div className={`sidebar-nav-item ${activeTab === 'feedback' ? 'active' : ''}`} onClick={() => { setActiveTab('feedback'); setSettingsSearch(''); }}>Send Feedback</div>
                        </div>
                        )}
                    </div>

                    {/* Mobile Tab Pills */}
                    <div className="settings-tabs-mobile">
                        <button onClick={onClose} style={{ marginRight: 'auto', padding: '6px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '16px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
                            <X size={14} /> Close
                        </button>
                        {(['account', 'profile', 'sessions', 'privacy', 'connections', 'achievements', 'stats', 'wardrobe', 'theme', 'sound', 'accessibility', 'notifications', 'muted-users', 'referrals', 'developer', 'feedback'] as const).map(tab => (
                            <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
                                {tab === 'privacy' ? 'Privacy' : tab === 'connections' ? 'Connections' : tab === 'achievements' ? 'Achievements' : tab === 'wardrobe' ? 'Wardrobe' : tab === 'accessibility' ? 'A11y' : tab === 'feedback' ? 'Feedback' : tab === 'muted-users' ? 'Muted' : tab === 'notifications' ? 'Notifs' : tab === 'developer' ? 'Developer' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Right Panel */}
                    <div className="settings-content-panel" style={{ flex: 1, padding: isMobile ? '16px 12px' : '24px 32px', overflowY: 'auto', position: 'relative' }}>
                        <button className="settings-close-btn" onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <X size={24} />
                        </button>

                        {activeTab === 'account' && (
                            <SettingsAccountTab
                                addToast={addToast}
                                userProfile={userProfile}
                                setUserProfile={setUserProfile}
                                onNavigateToProfile={() => setActiveTab('profile')}
                                onNavigateToSecurity={() => setActiveTab('security')}
                            />
                        )}


                        {activeTab === 'security' && (
                            <>
                                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>Two-Factor Authentication</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Protect your account with an extra layer of security. Once configured, you'll be required to enter both your password and an authentication code from your mobile phone in order to sign in.</p>

                                <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid var(--stroke)' }}>
                                    {/* Authenticator App */}
                                    <div style={{ marginBottom: '24px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    Authenticator App
                                                    {authenticatorEnabled && <span style={{ background: 'var(--success)', color: 'white', fontSize: '10px', padding: '2px 8px', borderRadius: '10px' }}>ENABLED</span>}
                                                </div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Use an app like Authy or Google Authenticator to get 2FA codes.</div>
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    if (authenticatorEnabled) {
                                                        setShowMfaDisableDialog(true);
                                                        setMfaDisableCode('');
                                                    } else {
                                                        if (showAuthenticatorSetup) {
                                                            setShowAuthenticatorSetup(false);
                                                            return;
                                                        }
                                                        setMfaLoading(true);
                                                        try {
                                                            const setup = await api.auth.startMfaSetup();
                                                            setMfaQrCodeUrl(setup.qrCodeDataUrl);
                                                            setMfaSecret(setup.secret);
                                                            setMfaVerifyCode('');
                                                            setShowAuthenticatorSetup(true);
                                                            setMfaStep(1);
                                                        } catch (err: unknown) {
                                                            addToast({ title: 'MFA Setup Failed', description: (err instanceof Error ? err.message : '') || 'Could not start MFA setup.', variant: 'error' });
                                                        } finally {
                                                            setMfaLoading(false);
                                                        }
                                                    }
                                                }}
                                                disabled={mfaLoading}
                                                className="auth-button"
                                                style={{ marginTop: 0, width: 'auto', padding: '0 24px', background: authenticatorEnabled ? 'var(--bg-tertiary)' : undefined, color: authenticatorEnabled ? 'var(--text-primary)' : undefined, border: authenticatorEnabled ? '1px solid var(--stroke)' : undefined, opacity: mfaLoading ? 0.6 : 1 }}
                                            >{mfaLoading ? 'Loading...' : authenticatorEnabled ? 'Disable' : 'Enable'}</button>
                                        </div>
                                        {/* MFA Disable confirmation dialog */}
                                        {showMfaDisableDialog && authenticatorEnabled && (
                                            <div style={{ marginTop: '16px', padding: '20px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)' }}>
                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Enter your current authenticator code to disable 2FA:</div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <input
                                                        type="text"
                                                        value={mfaDisableCode}
                                                        onChange={e => setMfaDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                        placeholder="000000"
                                                        maxLength={6}
                                                        style={{ width: '140px', padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '18px', letterSpacing: '4px', textAlign: 'center', outline: 'none', fontFamily: 'monospace' }}
                                                    />
                                                    <button
                                                        onClick={async () => {
                                                            if (mfaDisableCode.length !== 6) return;
                                                            setMfaLoading(true);
                                                            try {
                                                                await api.auth.disableMfa(mfaDisableCode);
                                                                setAuthenticatorEnabled(false);
                                                                setShowMfaDisableDialog(false);
                                                                setMfaDisableCode('');
                                                                addToast({ title: 'Authenticator Disabled', description: '2FA via authenticator app has been disabled.', variant: 'success' });
                                                            } catch (err: unknown) {
                                                                addToast({ title: 'Failed to Disable', description: (err instanceof Error ? err.message : '') || 'Invalid code. Please try again.', variant: 'error' });
                                                            } finally {
                                                                setMfaLoading(false);
                                                            }
                                                        }}
                                                        disabled={mfaDisableCode.length !== 6 || mfaLoading}
                                                        style={{ background: mfaDisableCode.length === 6 ? 'var(--error)' : 'var(--bg-elevated)', border: 'none', padding: '8px 20px', borderRadius: 'var(--radius-sm)', color: mfaDisableCode.length === 6 ? 'white' : 'var(--text-muted)', cursor: mfaDisableCode.length === 6 ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '13px', opacity: mfaLoading ? 0.6 : 1 }}
                                                    >{mfaLoading ? 'Disabling...' : 'Disable'}</button>
                                                    <button onClick={() => { setShowMfaDisableDialog(false); setMfaDisableCode(''); }} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', padding: '8px 20px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Cancel</button>
                                                </div>
                                            </div>
                                        )}
                                        {/* MFA Enable setup panel */}
                                        {showAuthenticatorSetup && !authenticatorEnabled && (
                                            <div style={{ marginTop: '16px', padding: '20px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)' }}>
                                                {/* MFA Step Indicator */}
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                                                    {[
                                                        { num: 1, label: 'Scan QR Code' },
                                                        { num: 2, label: 'Enter Code' },
                                                        { num: 3, label: 'Backup Codes' },
                                                    ].map((step, i) => (
                                                        <div key={step.num} style={{ display: 'flex', alignItems: 'center' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                                <div style={{
                                                                    width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '12px', fontWeight: 700,
                                                                    background: mfaStep > step.num ? 'var(--success)' : mfaStep === step.num ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                                                                    color: mfaStep >= step.num ? '#000' : 'var(--text-muted)',
                                                                    border: mfaStep === step.num ? 'none' : '1px solid var(--stroke)',
                                                                    transition: 'all 0.2s ease',
                                                                }}>
                                                                    {mfaStep > step.num ? <Check size={14} /> : step.num}
                                                                </div>
                                                                <span style={{ fontSize: '10px', color: mfaStep >= step.num ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: mfaStep === step.num ? 600 : 400, whiteSpace: 'nowrap' }}>{step.label}</span>
                                                            </div>
                                                            {i < 2 && (
                                                                <div style={{ width: '40px', height: '2px', background: mfaStep > step.num ? 'var(--success)' : 'var(--stroke)', margin: '0 8px', marginBottom: '18px', transition: 'background 0.2s ease' }} />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Scan this QR code with your authenticator app:</div>
                                                {mfaQrCodeUrl && (
                                                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                                                        <img src={mfaQrCodeUrl} alt="MFA QR Code" style={{ width: '160px', height: '160px', borderRadius: 'var(--radius-md)', background: 'white', padding: '8px' }} />
                                                    </div>
                                                )}
                                                {mfaSecret && (
                                                    <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Or enter this key manually:</div>
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--stroke)' }}>
                                                            <code style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-primary)', letterSpacing: '1px' }}>{mfaSecret}</code>
                                                            <button onClick={() => { copyToClipboard(mfaSecret); addToast({ title: 'Copied', description: 'Secret key copied to clipboard.', variant: 'success' }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}><Copy size={14} /></button>
                                                        </div>
                                                    </div>
                                                )}
                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Enter the 6-digit code from your authenticator app:</div>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                    <input
                                                        type="text"
                                                        value={mfaVerifyCode}
                                                        onChange={e => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                        onFocus={() => setMfaStep(2)}
                                                        placeholder="000000"
                                                        maxLength={6}
                                                        style={{ width: '140px', padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '18px', letterSpacing: '4px', textAlign: 'center', outline: 'none', fontFamily: 'monospace' }}
                                                    />
                                                    <button
                                                        onClick={async () => {
                                                            if (mfaVerifyCode.length !== 6) return;
                                                            setMfaLoading(true);
                                                            try {
                                                                const result = await api.auth.enableMfa(mfaVerifyCode);
                                                                setAuthenticatorEnabled(true);
                                                                setShowAuthenticatorSetup(false);
                                                                setMfaVerifyCode('');
                                                                setMfaQrCodeUrl('');
                                                                setMfaSecret('');
                                                                if (result.backupCodes?.length) {
                                                                    setBackupCodes(result.backupCodes);
                                                                    setShowBackupCodes(true);
                                                                    setMfaStep(3);
                                                                }
                                                                addToast({ title: 'Authenticator Enabled', description: '2FA via authenticator app is now active.', variant: 'success' });
                                                            } catch (err: unknown) {
                                                                addToast({ title: 'Verification Failed', description: (err instanceof Error ? err.message : '') || 'Invalid code. Please try again.', variant: 'error' });
                                                            } finally {
                                                                setMfaLoading(false);
                                                            }
                                                        }}
                                                        disabled={mfaVerifyCode.length !== 6 || mfaLoading}
                                                        style={{ background: mfaVerifyCode.length === 6 ? 'var(--accent-primary)' : 'var(--bg-elevated)', border: 'none', padding: '8px 20px', borderRadius: 'var(--radius-sm)', color: mfaVerifyCode.length === 6 ? '#000' : 'var(--text-muted)', cursor: mfaVerifyCode.length === 6 ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '13px', opacity: mfaLoading ? 0.6 : 1 }}
                                                    >{mfaLoading ? 'Verifying...' : 'Verify & Enable'}</button>
                                                    <button onClick={() => { setShowAuthenticatorSetup(false); setMfaVerifyCode(''); }} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', padding: '8px 20px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Cancel</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ height: '1px', background: 'var(--stroke)', marginBottom: '24px' }}></div>

                                    {/* SMS Authentication */}
                                    <div style={{ marginBottom: '24px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    SMS Authentication
                                                    {smsEnabled && <span style={{ background: 'var(--success)', color: 'white', fontSize: '10px', padding: '2px 8px', borderRadius: '10px' }}>ENABLED</span>}
                                                </div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Receive a text message with your 2FA code.</div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (smsEnabled) {
                                                        setSmsEnabled(false);
                                                        setShowSmsSetup(false);
                                                        addToast({ title: 'SMS 2FA Disabled', description: 'SMS authentication has been disabled.', variant: 'success' });
                                                    } else {
                                                        setShowSmsSetup(!showSmsSetup);
                                                    }
                                                }}
                                                className="auth-button"
                                                style={{ marginTop: 0, width: 'auto', padding: '0 24px', background: smsEnabled ? 'var(--bg-tertiary)' : undefined, color: smsEnabled ? 'var(--text-primary)' : undefined, border: smsEnabled ? '1px solid var(--stroke)' : undefined }}
                                            >{smsEnabled ? 'Disable' : 'Enable'}</button>
                                        </div>
                                        {showSmsSetup && !smsEnabled && (
                                            <div style={{ marginTop: '16px', padding: '20px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)' }}>
                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>A verification code has been sent to your phone number ending in **42. Enter it below:</div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <input
                                                        type="text"
                                                        value={smsCode}
                                                        onChange={e => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                        placeholder="000000"
                                                        maxLength={6}
                                                        style={{ width: '140px', padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '18px', letterSpacing: '4px', textAlign: 'center', outline: 'none', fontFamily: 'monospace' }}
                                                    />
                                                    <button
                                                        onClick={() => { if (smsCode.length === 6) { setSmsEnabled(true); setShowSmsSetup(false); setSmsCode(''); addToast({ title: 'SMS 2FA Enabled', description: 'SMS authentication is now active.', variant: 'success' }); } }}
                                                        disabled={smsCode.length !== 6}
                                                        style={{ background: smsCode.length === 6 ? 'var(--accent-primary)' : 'var(--bg-elevated)', border: 'none', padding: '8px 20px', borderRadius: 'var(--radius-sm)', color: smsCode.length === 6 ? '#000' : 'var(--text-muted)', cursor: smsCode.length === 6 ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '13px' }}
                                                    >Verify</button>
                                                    <button onClick={() => { setShowSmsSetup(false); setSmsCode(''); }} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', padding: '8px 20px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Cancel</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ height: '1px', background: 'var(--stroke)', marginBottom: '24px' }}></div>

                                    {/* Backup Codes */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ fontSize: '15px', fontWeight: 600 }}>Backup Codes</div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Generate backup codes for account recovery if you lose your phone.</div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (!authenticatorEnabled) {
                                                        addToast({ title: 'MFA Required', description: 'Enable authenticator app first to generate backup codes.', variant: 'error' });
                                                        return;
                                                    }
                                                    setShowBackupCodesVerify(true);
                                                    setBackupCodesVerifyCode('');
                                                }}
                                                disabled={backupCodesLoading}
                                                className="auth-button"
                                                style={{ marginTop: 0, background: 'var(--bg-tertiary)', color: 'white', border: '1px solid var(--stroke)', width: 'auto', padding: '0 24px', opacity: backupCodesLoading ? 0.6 : 1 }}
                                            >{backupCodesLoading ? 'Generating...' : showBackupCodes ? 'Regenerate' : 'Generate'}</button>
                                        </div>
                                        {showBackupCodesVerify && !showBackupCodes && (
                                            <div style={{ marginTop: '16px', padding: '20px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)' }}>
                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Enter your authenticator code to generate backup codes:</div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <input
                                                        type="text"
                                                        value={backupCodesVerifyCode}
                                                        onChange={e => setBackupCodesVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                        placeholder="000000"
                                                        maxLength={6}
                                                        style={{ width: '140px', padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '18px', letterSpacing: '4px', textAlign: 'center', outline: 'none', fontFamily: 'monospace' }}
                                                    />
                                                    <button
                                                        onClick={async () => {
                                                            if (backupCodesVerifyCode.length !== 6) return;
                                                            setBackupCodesLoading(true);
                                                            try {
                                                                const result = await api.auth.regenerateMfaBackupCodes(backupCodesVerifyCode);
                                                                setBackupCodes(result.backupCodes);
                                                                setShowBackupCodes(true);
                                                                setShowBackupCodesVerify(false);
                                                                addToast({ title: 'Backup Codes Generated', description: 'Save these codes in a safe place.', variant: 'success' });
                                                            } catch (err: unknown) {
                                                                addToast({ title: 'Failed', description: (err instanceof Error ? err.message : '') || 'Invalid code. Please try again.', variant: 'error' });
                                                            } finally {
                                                                setBackupCodesLoading(false);
                                                            }
                                                        }}
                                                        disabled={backupCodesVerifyCode.length !== 6 || backupCodesLoading}
                                                        style={{ background: backupCodesVerifyCode.length === 6 ? 'var(--accent-primary)' : 'var(--bg-elevated)', border: 'none', padding: '8px 20px', borderRadius: 'var(--radius-sm)', color: backupCodesVerifyCode.length === 6 ? '#000' : 'var(--text-muted)', cursor: backupCodesVerifyCode.length === 6 ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '13px' }}
                                                    >Generate</button>
                                                    <button onClick={() => { setShowBackupCodesVerify(false); setBackupCodesVerifyCode(''); }} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', padding: '8px 20px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Cancel</button>
                                                </div>
                                            </div>
                                        )}
                                        {showBackupCodes && backupCodes.length > 0 && (
                                            <div style={{ marginTop: '16px', padding: '20px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)' }}>
                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Store these codes somewhere safe. Each code can only be used once.</div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '16px' }}>
                                                    {backupCodes.map((code, i) => (
                                                        <div key={i} style={{ padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', fontSize: '14px', color: 'var(--text-primary)', textAlign: 'center', border: '1px solid var(--stroke)' }}>{code}</div>
                                                    ))}
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        copyToClipboard(backupCodes.join('\n'));
                                                        addToast({ title: 'Codes Copied', description: 'Backup codes copied to clipboard.', variant: 'success' });
                                                    }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                                                ><Copy size={14} /> Copy All Codes</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTab === 'profile' && (
                            <>
                                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>User Profile</h2>

                                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '24px' : '32px' }}>
                                    {/* Editor Column */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
                                        <div>
                                            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '12px' }}>Avatar</h3>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <button className="auth-button" onClick={() => fileInputRef.current?.click()} style={{ marginTop: 0, flex: 1, background: 'var(--accent-primary)', height: '40px' }}>Upload & Crop</button>
                                                <button className="auth-button" onClick={handleRemoveAvatar} style={{ marginTop: 0, flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'white', height: '40px' }}>Remove</button>
                                            </div>
                                            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleAvatarUpload} />
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>After selecting an image you'll be able to crop and zoom it.</p>
                                        </div>

                                        <div style={{ height: '1px', background: 'var(--stroke)' }}></div>

                                        <div>
                                            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '12px' }}>Avatar Frame</h3>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: isMobile ? '8px' : '12px' }}>
                                                {[
                                                    { id: 'none', label: 'None' },
                                                    { id: 'neon', label: 'Neon Glow' },
                                                    { id: 'gold', label: 'Solid Gold' },
                                                    { id: 'glass', label: 'Frosted Glass' },
                                                    { id: 'rainbow', label: 'Rainbow' },
                                                    { id: 'pulse', label: 'Pulse' },
                                                ].map(frame => (
                                                    <button
                                                        key={frame.id}
                                                        onClick={() => applyGlobalAvatarFrame(frame.id as 'none' | 'neon' | 'gold' | 'glass' | 'rainbow' | 'pulse')}
                                                        style={{
                                                            padding: isMobile ? '8px' : '12px',
                                                            borderRadius: '8px',
                                                            background: avatarFrame === frame.id ? 'rgba(82, 109, 245, 0.1)' : 'var(--bg-tertiary)',
                                                            border: `1px solid ${avatarFrame === frame.id ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                                            color: avatarFrame === frame.id ? 'white' : 'var(--text-secondary)',
                                                            cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                                        }}
                                                    >
                                                        <span style={{ fontSize: isMobile ? '11px' : '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{frame.label}</span>
                                                        {avatarFrame === frame.id && <Check size={16} color="var(--accent-primary)" />}
                                                    </button>
                                                ))}
                                            </div>
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>This applies globally across sidebars, guild chat, and DMs.</p>
                                        </div>

                                        <div style={{ height: '1px', background: 'var(--stroke)' }}></div>

                                        <div>
                                            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '12px' }}>Profile Banner</h3>
                                            <div style={{ display: 'flex', gap: '12px' }}>
                                                <button className="auth-button" onClick={() => bannerInputRef.current?.click()} style={{ marginTop: 0, flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'white', height: '40px' }}>Upload & Crop</button>
                                                <button className="auth-button" onClick={handleRemoveBanner} style={{ marginTop: 0, flex: 1, background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--error)', height: '40px' }}>Remove</button>
                                            </div>
                                            <input type="file" ref={bannerInputRef} hidden accept="image/*,video/mp4,video/webm,image/gif" onChange={handleBannerUpload} />
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Recommended: 1500×500px. GIFs and videos are also supported.</p>
                                        </div>

                                        <div style={{ height: '1px', background: 'var(--stroke)' }}></div>

                                        <div>
                                            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '12px' }}>About Me</h3>
                                            <textarea className="auth-input" style={{ minHeight: '100px', resize: 'vertical' }} placeholder="Write a little about yourself..." value={bioValue} onChange={e => setBioValue(e.target.value)}></textarea>
                                            <button
                                                className="auth-button"
                                                disabled={bioSaving}
                                                onClick={async () => {
                                                    setBioSaving(true);
                                                    try {
                                                        await api.users.updateProfile({ bio: bioValue });
                                                        addToast({ title: 'Bio saved', variant: 'success' });
                                                    } catch {
                                                        addToast({ title: 'Failed to save bio', variant: 'error' });
                                                    } finally {
                                                        setBioSaving(false);
                                                    }
                                                }}
                                                style={{ marginTop: '8px', width: 'auto', padding: '0 20px', height: '36px', background: 'var(--accent-primary)' }}
                                            >
                                                {bioSaving ? 'Saving…' : 'Save Bio'}
                                            </button>
                                        </div>

                                        <div style={{ height: '1px', background: 'var(--stroke)' }}></div>

                                        {/* Timezone */}
                                        <div>
                                            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>Timezone</h3>
                                            <select
                                                className="auth-input"
                                                style={{ width: '100%', height: '38px' }}
                                                value={localStorage.getItem('gratonite_timezone') ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
                                                onChange={async (e) => {
                                                    const tz = e.target.value;
                                                    localStorage.setItem('gratonite_timezone', tz);
                                                    try { await api.users.updateSettings({ timezone: tz }); } catch {}
                                                    addToast({ title: 'Timezone updated', variant: 'success' });
                                                }}
                                            >
                                                {(() => {
                                                    try { return (Intl as any).supportedValuesOf('timeZone') as string[]; } catch { return ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney']; }
                                                })().map((tz: string) => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
                                            </select>
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Shown on your profile so friends know your local time.</p>
                                        </div>

                                        <div style={{ height: '1px', background: 'var(--stroke)' }}></div>

                                        {/* Birthday */}
                                        <div>
                                            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>Birthday</h3>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <select
                                                    className="auth-input"
                                                    style={{ flex: 1, height: '38px' }}
                                                    value={birthdayMonth}
                                                    onChange={(e) => { setBirthdayMonth(e.target.value); localStorage.setItem('gratonite_birthday_month', e.target.value); }}
                                                >
                                                    <option value="">Month</option>
                                                    {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                                                        <option key={i} value={String(i + 1)}>{m}</option>
                                                    ))}
                                                </select>
                                                <select
                                                    className="auth-input"
                                                    style={{ flex: 1, height: '38px' }}
                                                    value={birthdayDay}
                                                    onChange={(e) => { setBirthdayDay(e.target.value); localStorage.setItem('gratonite_birthday_day', e.target.value); }}
                                                >
                                                    <option value="">Day</option>
                                                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                                        <option key={d} value={String(d)}>{d}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button
                                                className="auth-button"
                                                onClick={async () => {
                                                    const month = parseInt(birthdayMonth || '0');
                                                    const day = parseInt(birthdayDay || '0');
                                                    if (!month || !day) { addToast({ title: 'Select month and day', variant: 'error' }); return; }
                                                    try {
                                                        await api.users.updateSettings({ birthday: { month, day } });
                                                        addToast({ title: 'Birthday saved', variant: 'success' });
                                                    } catch { addToast({ title: 'Failed to save birthday', variant: 'error' }); }
                                                }}
                                                style={{ marginTop: '8px', width: 'auto', padding: '0 20px', height: '36px', background: 'var(--accent-primary)' }}
                                            >
                                                Save Birthday
                                            </button>
                                        </div>

                                        <div style={{ height: '1px', background: 'var(--stroke)' }}></div>

                                        {/* Profile Song */}
                                        <div>
                                            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>Profile Song</h3>
                                            <input
                                                className="auth-input"
                                                type="text"
                                                placeholder="Song title"
                                                value={localStorage.getItem('gratonite_song_title') ?? ''}
                                                onChange={e => localStorage.setItem('gratonite_song_title', e.target.value)}
                                                style={{ marginBottom: '6px' }}
                                            />
                                            <input
                                                className="auth-input"
                                                type="text"
                                                placeholder="Artist"
                                                value={localStorage.getItem('gratonite_song_artist') ?? ''}
                                                onChange={e => localStorage.setItem('gratonite_song_artist', e.target.value)}
                                                style={{ marginBottom: '6px' }}
                                            />
                                            <input
                                                className="auth-input"
                                                type="url"
                                                placeholder="URL (YouTube, Spotify, etc.)"
                                                value={localStorage.getItem('gratonite_song_url') ?? ''}
                                                onChange={e => localStorage.setItem('gratonite_song_url', e.target.value)}
                                            />
                                            <button
                                                className="auth-button"
                                                onClick={async () => {
                                                    const title = localStorage.getItem('gratonite_song_title') ?? '';
                                                    const artist = localStorage.getItem('gratonite_song_artist') ?? '';
                                                    const url = localStorage.getItem('gratonite_song_url') ?? '';
                                                    if (!title) { addToast({ title: 'Enter a song title', variant: 'error' }); return; }
                                                    const platform = url.includes('youtube') || url.includes('youtu.be') ? 'youtube' : url.includes('spotify') ? 'spotify' : 'other';
                                                    try {
                                                        await api.users.updateSettings({ profileSong: { title, artist, url, platform } });
                                                        addToast({ title: 'Profile song saved', variant: 'success' });
                                                    } catch { addToast({ title: 'Failed to save', variant: 'error' }); }
                                                }}
                                                style={{ marginTop: '8px', width: 'auto', padding: '0 20px', height: '36px', background: 'var(--accent-primary)' }}
                                            >
                                                Save Song
                                            </button>
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Shows a mini music card on your profile popover.</p>
                                        </div>

                                        <div style={{ height: '1px', background: 'var(--stroke)' }}></div>

                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Display Name Style</h3>
                                                <button
                                                    onClick={() => {
                                                        const styles: Array<typeof nameplateStyle> = ['rainbow', 'fire', 'ice', 'gold', 'glitch'];
                                                        const pick = styles[Math.floor(Math.random() * styles.length)];
                                                        applyGlobalNameplateStyle(pick);
                                                    }}
                                                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: 'var(--accent-primary)', cursor: 'pointer' }}
                                                >
                                                    🎲 Randomize
                                                </button>
                                            </div>
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>Make your name stand out in chat. Rare & above required for animated styles.</p>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: isMobile ? '6px' : '8px' }}>
                                                {([
                                                    { id: 'none',    label: userProfile?.name || 'User',  cls: '',                   desc: 'Default' },
                                                    { id: 'rainbow', label: userProfile?.name || 'User',  cls: 'nameplate-rainbow',  desc: 'Rainbow' },
                                                    { id: 'fire',    label: userProfile?.name || 'User',  cls: 'nameplate-fire',     desc: 'Fire' },
                                                    { id: 'ice',     label: userProfile?.name || 'User',  cls: 'nameplate-ice',      desc: 'Ice' },
                                                    { id: 'gold',    label: userProfile?.name || 'User',  cls: 'nameplate-gold',     desc: 'Gold' },
                                                    { id: 'glitch',  label: userProfile?.name || 'User',  cls: 'nameplate-glitch',   desc: 'Glitch' },
                                                ] as { id: typeof nameplateStyle; label: string; cls: string; desc: string }[]).map(ns => {
                                                    const isSelected = nameplateStyle === ns.id;
                                                    return (
                                                        <div
                                                            key={ns.id}
                                                            onClick={() => {
                                                                applyGlobalNameplateStyle(ns.id);
                                                            }}
                                                            style={{
                                                                background: isSelected ? 'rgba(82, 109, 245, 0.1)' : 'var(--bg-tertiary)',
                                                                border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                                                borderRadius: '8px',
                                                                padding: '10px 12px',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                            }}
                                                        >
                                                            <span className={ns.cls} style={{ fontSize: '13px', fontWeight: 700 }}>{ns.label}</span>
                                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ns.desc}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>This applies globally across sidebars, guild chat, and DMs.</p>
                                        </div>

                                        <div style={{ height: '1px', background: 'var(--stroke)' }}></div>

                                        {/* Per-Server Profile Overrides */}
                                        <div>
                                            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Per-Server Profiles</h3>
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>Customize your display name, avatar, bio, and nickname per server. Overrides your global defaults.</p>

                                            {joinedGuilds.map(server => (
                                                <div key={server.id} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '12px 14px', marginBottom: '8px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                                        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                                                            {server.iconHash ? (
                                                                <img
                                                                    src={`${API_BASE}/files/${server.iconHash}`}
                                                                    alt={server.name}
                                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }}
                                                                />
                                                            ) : (
                                                                server.name.charAt(0).toUpperCase()
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '13px', fontWeight: 700 }}>{server.name}</div>
                                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{server.memberCount.toLocaleString()} members</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                            <input
                                                                className="auth-input"
                                                                placeholder="Server Display Name"
                                                                style={{ flex: 1, minWidth: '100px', padding: '6px 10px', fontSize: '12px', height: 'auto' }}
                                                                maxLength={64}
                                                                value={serverProfileDrafts[server.id]?.displayName ?? ''}
                                                                onChange={(e) => setServerProfileDrafts((prev) => ({ ...prev, [server.id]: { ...prev[server.id] ?? { displayName: '', bio: '' }, displayName: e.target.value } }))}
                                                            />
                                                        </div>
                                                        <textarea
                                                            className="auth-input"
                                                            placeholder="Server Bio (optional)"
                                                            maxLength={190}
                                                            rows={2}
                                                            style={{ width: '100%', padding: '6px 10px', fontSize: '12px', resize: 'vertical', minHeight: '36px' }}
                                                            value={serverProfileDrafts[server.id]?.bio ?? ''}
                                                            onChange={(e) => setServerProfileDrafts((prev) => ({ ...prev, [server.id]: { ...prev[server.id] ?? { displayName: '', bio: '' }, bio: e.target.value } }))}
                                                        />
                                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                        <input
                                                            className="auth-input"
                                                            placeholder="Nickname (optional)"
                                                            style={{ flex: 1, minWidth: '100px', padding: '6px 10px', fontSize: '12px', height: 'auto' }}
                                                            value={nicknameDrafts[server.id] ?? ''}
                                                            onChange={(e) => setNicknameDrafts((prev) => ({ ...prev, [server.id]: e.target.value }))}
                                                        />
                                                        <select
                                                            className="auth-input"
                                                            style={{ flex: 1, minWidth: '90px', padding: '6px 8px', fontSize: '12px', height: 'auto', cursor: 'pointer' }}
                                                            defaultValue="global"
                                                            disabled
                                                        >
                                                            <option value="global">↩ Use Global</option>
                                                            <option value="none">Default</option>
                                                            <option value="rainbow">Rainbow</option>
                                                            <option value="fire">Fire</option>
                                                            <option value="ice">Ice</option>
                                                            <option value="gold">Gold</option>
                                                            <option value="glitch">Glitch</option>
                                                        </select>
                                                        <button
                                                            className="auth-button"
                                                            onClick={() => { saveNicknameOverride(server.id); saveServerProfile(server.id); }}
                                                            disabled={savingNicknameForGuildId === server.id || savingServerProfileForGuildId === server.id}
                                                            style={{ marginTop: 0, width: 'auto', minWidth: '84px', padding: '0 14px', height: '34px', background: 'var(--accent-primary)', color: '#000' }}
                                                        >
                                                            {(savingNicknameForGuildId === server.id || savingServerProfileForGuildId === server.id) ? 'Saving…' : 'Save'}
                                                        </button>
                                                        <button
                                                            className="auth-button"
                                                            onClick={() => resetServerProfile(server.id)}
                                                            disabled={savingServerProfileForGuildId === server.id}
                                                            style={{ marginTop: 0, width: 'auto', minWidth: '64px', padding: '0 10px', height: '34px', background: 'transparent', border: '1px solid var(--stroke)', color: 'var(--text-muted)', fontSize: '11px' }}
                                                        >
                                                            Reset
                                                        </button>
                                                    </div>
                                                    </div>
                                                </div>
                                            ))}
                                            {joinedGuilds.length === 0 && (
                                                <div style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px dashed var(--stroke)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
                                                    Join a server to configure per-server profiles.
                                                </div>
                                            )}
                                            <button onClick={() => setShowServerOverrideInfo(!showServerOverrideInfo)} style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px dashed var(--stroke)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}>
                                                {showServerOverrideInfo ? 'Hide details' : 'About server overrides'}
                                            </button>
                                            {showServerOverrideInfo && (
                                                <div style={{ marginTop: '8px', padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-primary)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                                    <Info size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                                    <div>
                                                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Per-Server Profiles</div>
                                                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>Each server you join will appear here, letting you set a unique display name, bio, and nickname that only applies in that server. Other members will see your server-specific profile instead of your global one.</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Preview Column - Redesigned with bigger banner */}
                                    <div style={{ width: isMobile ? '100%' : '280px', flexShrink: 0 }}>
                                        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '12px' }}>Preview</h3>

                                        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                                            {/* Banner — much taller */}
                                            <div style={{ height: '120px', background: bannerStyle, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
                                                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.4))' }}></div>
                                            </div>
                                            <div style={{ padding: '0 20px 20px', position: 'relative' }}>
                                                {/* Avatar — bigger, positioned to overlap banner */}
                                                <div style={{
                                                    width: '84px', height: '84px',
                                                    borderRadius: '50%',
                                                    border: '5px solid var(--bg-elevated)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '32px', fontWeight: 'bold',
                                                    marginTop: '-42px', marginBottom: '12px',
                                                    position: 'relative',
                                                    overflow: 'hidden',
                                                    boxShadow: avatarFrame === 'neon' ? '0 0 20px 6px rgba(56, 189, 248, 0.6)' : avatarFrame === 'gold' ? '0 0 0 3px #f59e0b, 0 0 12px rgba(245, 158, 11, 0.4)' : 'none',
                                                    ...(avatarFrame === 'glass' ? {
                                                        backdropFilter: 'blur(2px)',
                                                        borderColor: 'rgba(255,255,255,0.3)',
                                                        boxShadow: 'inset 0 0 20px rgba(255,255,255,0.1)',
                                                    } : {})
                                                }}>
                                                    {persistedAvatarUrl ? (
                                                        <img src={persistedAvatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                                    ) : (
                                                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: userProfile?.avatarStyle || 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', color: 'white' }}>
                                                            {userProfile?.name?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                    )}
                                                    <div style={{ position: 'absolute', bottom: 2, right: 2, width: '18px', height: '18px', background: 'var(--bg-elevated)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <div style={{ width: '12px', height: '12px', background: 'var(--success)', borderRadius: '50%' }}></div>
                                                    </div>
                                                </div>
                                                <h2 className={nameplateStyle !== 'none' ? `nameplate-${nameplateStyle}` : ''} style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '2px', letterSpacing: '-0.02em' }}>{editDisplayName || userProfile?.name || 'User'}</h2>
                                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>{editUsername || userProfile?.handle || ''}</p>

                                                <div style={{ height: '1px', background: 'var(--stroke)', marginBottom: '14px' }}></div>

                                                {/* About Me section */}
                                                <div style={{ marginBottom: '14px' }}>
                                                    <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.05em' }}>About Me</h4>
                                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{userProfile?.bio || 'No bio set.'}</p>
                                                </div>

                                                {/* Member Since */}
                                                <div>
                                                    <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.05em' }}>Member Since</h4>
                                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{ctxUser.createdAt ? new Date(ctxUser.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Profile Card Theme (Item 102) */}
                                <div style={{ marginTop: '32px', borderTop: '1px solid var(--stroke)', paddingTop: '24px' }}>
                                    <ProfileThemeEditor
                                        username={ctxUser.handle || 'user'}
                                        displayName={ctxUser.name || ctxUser.handle || 'User'}
                                        avatarUrl={ctxUser.avatarHash ? `${API_BASE}/files/${ctxUser.avatarHash}` : undefined}
                                    />
                                </div>
                            </>
                        )}

                        {activeTab === 'sessions' && (
                            <LoginHistoryPage />
                        )}

                        {/* Connections tab hidden — OAuth is implemented but Connections UI not yet built */}
                        {/* Activity Privacy tab hidden — game activity detection not yet implemented */}

                        {activeTab === 'theme' && <SettingsThemeTab addToast={addToast} />}

                        {activeTab === 'accessibility' && <SettingsAccessibilityTab addToast={addToast} />}

                        {activeTab === 'sound' && <SettingsSoundTab addToast={addToast} />}
                        {activeTab === 'privacy' && <SettingsPrivacyTab addToast={addToast} userProfile={userProfile} onNavigateTab={(tab) => setActiveTab(tab as typeof activeTab)} />}
                        {activeTab === 'connections' && <SettingsConnectionsTab addToast={addToast} />}
                        {activeTab === 'federation' && <SettingsFederationTab />}
                        {activeTab === 'feedback' && <SettingsFeedbackTab addToast={addToast} />}
                        {activeTab === 'achievements' && <SettingsAchievementsTab />}

                        {activeTab === 'wardrobe' && (() => {
                            const wardrobeCats = [
                                { key: 'avatar_frame', label: 'Frames' },
                                { key: 'nameplate', label: 'Nameplates' },
                                { key: 'profile_effect', label: 'Effects' },
                                { key: 'decoration', label: 'Decorations' },
                            ];
                            const categoryItems = wardrobeItems.filter((i: WardrobeItem) => i.type === wardrobeCategory);
                            const handleWardrobeSelect = (item: WardrobeItem) => {
                                const cfg = (item.assetConfig ?? {}) as Record<string, unknown>;
                                const isAlreadySelected = wardrobeSelectedIds[item.type] === item.itemId;
                                setWardrobeSelectedIds(prev => ({
                                    ...prev,
                                    [item.type]: isAlreadySelected ? '' : item.itemId,
                                }));
                                // Update preview state only — do NOT write to localStorage or dispatch events
                                // until the user clicks "Apply & Save"
                                if (item.type === 'avatar_frame') {
                                    setWardrobePreviewFrame(isAlreadySelected ? 'none' : ((cfg.frameStyle as string) ?? 'neon'));
                                    setWardrobePreviewFrameColor(isAlreadySelected ? undefined : (cfg.glowColor as string | undefined));
                                }
                                if (item.type === 'nameplate') {
                                    setWardrobePreviewNameplate(isAlreadySelected ? 'none' : ((cfg.nameplateStyle as string) ?? 'none'));
                                }
                            };
                            const handleWardrobeSave = async () => {
                                setWardrobeSaving(true);
                                try {
                                    const userId = userProfile?.id || 'me';
                                    for (const [type, itemId] of Object.entries(wardrobeSelectedIds)) {
                                        if (!itemId) continue;
                                        const item = wardrobeItems.find((i: WardrobeItem) => i.itemId === itemId && i.type === type);
                                        if (!item) continue;
                                        const res = item.source === 'shop'
                                            ? await api.shop.equipItem(itemId)
                                            : await api.cosmetics.equipCosmetic(itemId);
                                        const cfg = (res?.assetConfig ?? item.assetConfig ?? {}) as Record<string, unknown>;
                                        if (type === 'avatar_frame') applyGlobalAvatarFrame((cfg.frameStyle as 'none' | 'neon' | 'gold' | 'glass' | 'rainbow' | 'pulse') ?? 'neon');
                                        if (type === 'nameplate') {
                                            const style = (cfg.nameplateStyle as 'none' | 'rainbow' | 'fire' | 'ice' | 'gold' | 'glitch') ?? 'none';
                                            applyGlobalNameplateStyle(style);
                                            api.users.updateProfile({ nameplateStyle: style }).catch(() => {});
                                        }
                                    }
                                    // Unequip items of each type not selected
                                    for (const item of wardrobeItems) {
                                        if (item.type === 'soundboard') continue;
                                        const selectedId = wardrobeSelectedIds[item.type];
                                        if (item.equipped && item.itemId !== selectedId) {
                                            if (item.source === 'shop') await api.shop.unequipItem(item.itemId).catch(() => {});
                                            else await api.cosmetics.unequip(item.itemId).catch(() => {});
                                        }
                                    }
                                    addToast({ title: 'Wardrobe saved!', description: 'Your look has been updated.', variant: 'success' });
                                } catch {
                                    addToast({ title: 'Failed to save wardrobe', variant: 'error' });
                                } finally {
                                    setWardrobeSaving(false);
                                }
                            };
                            return (
                                <div style={{ padding: '0 24px' }}>
                                    <h2 style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>Wardrobe</h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>Mix and match your cosmetics, preview your look, then save.</p>
                                    <div style={{ display: 'flex', gap: '20px' }}>
                                        {/* Left: category + item grid */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            {/* Category tabs */}
                                            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                                {wardrobeCats.map(cat => (
                                                    <button key={cat.key} onClick={() => setWardrobeCategory(cat.key)} style={{
                                                        padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                                        background: wardrobeCategory === cat.key ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                                        color: wardrobeCategory === cat.key ? '#fff' : 'var(--text-secondary)',
                                                        fontWeight: 600, fontSize: '12px',
                                                    }}>{cat.label}</button>
                                                ))}
                                            </div>
                                            {/* Items */}
                                            {wardrobeLoading ? (
                                                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px' }}>Loading inventory...</div>
                                            ) : categoryItems.length === 0 ? (
                                                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px', fontSize: '13px' }}>
                                                    No {wardrobeCats.find(c => c.key === wardrobeCategory)?.label.toLowerCase()} in inventory.<br />
                                                    <span style={{ fontSize: '12px' }}>Visit the Shop to get some!</span>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '10px', maxHeight: '340px', overflowY: 'auto' }}>
                                                    {categoryItems.map((item: WardrobeItem) => {
                                                        const isSelected = wardrobeSelectedIds[item.type] === item.itemId;
                                                        const rarityColors: Record<string, string> = { common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b' };
                                                        const rColor = rarityColors[item.rarity ?? 'common'] ?? '#9ca3af';
                                                        return (
                                                            <div key={item.itemId} onClick={() => handleWardrobeSelect(item)} style={{
                                                                padding: '10px 8px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center',
                                                                background: isSelected ? 'rgba(82, 109, 245, 0.12)' : 'var(--bg-tertiary)',
                                                                border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                                                transition: 'all 0.15s ease',
                                                            }}>
                                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: (item as any).imageUrl ?? 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', margin: '0 auto 6px', border: `2px solid ${rColor}` }} />
                                                                <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                                                                <div style={{ fontSize: '9px', color: rColor, textTransform: 'uppercase', fontWeight: 700, marginTop: '2px' }}>{item.rarity}</div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                        {/* Right: live preview */}
                                        <div style={{ width: '160px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--stroke)', padding: '16px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Preview</div>
                                                {/* Avatar preview with frame */}
                                                <div style={{ position: 'relative', width: '72px', height: '72px', margin: '0 auto 10px' }}>
                                                    <div
                                                        className={
                                                            wardrobePreviewFrame === 'rainbow' ? 'avatar-frame-rainbow'
                                                            : wardrobePreviewFrame === 'pulse' ? 'avatar-frame-pulse'
                                                            : undefined
                                                        }
                                                        style={{
                                                        width: '72px', height: '72px', borderRadius: '50%',
                                                        overflow: 'hidden',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '28px',
                                                        boxShadow: wardrobePreviewFrame === 'neon'
                                                            ? `0 0 14px ${wardrobePreviewFrameColor ?? '#38bdf8'}`
                                                            : wardrobePreviewFrame === 'gold'
                                                                ? '0 0 0 2px #f59e0b, 0 0 10px rgba(245,158,11,0.5)'
                                                                : 'none',
                                                        border: wardrobePreviewFrame === 'glass' ? '2px solid rgba(255,255,255,0.35)' : 'none',
                                                    }}>
                                                        {ctxUser.avatarHash ? (
                                                            <img
                                                                src={`${API_BASE}/files/${ctxUser.avatarHash}`}
                                                                alt="Avatar preview"
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                                                            />
                                                        ) : (
                                                            <div style={{
                                                                width: '100%', height: '100%', borderRadius: '50%',
                                                                background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '28px', color: 'white',
                                                            }}>
                                                                {userProfile?.name?.[0]?.toUpperCase() || '?'}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {/* Name with nameplate */}
                                                <div className={wardrobePreviewNameplate !== 'none' ? `nameplate-${wardrobePreviewNameplate}` : ''} style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>
                                                    {userProfile?.name || userProfile?.displayName || 'You'}
                                                </div>
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                                    {wardrobePreviewFrame !== 'none' ? wardrobePreviewFrame + ' frame' : 'No frame'}
                                                </div>
                                            </div>
                                            <button onClick={handleWardrobeSave} disabled={wardrobeSaving} style={{
                                                width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
                                                background: 'var(--accent-primary)', color: '#fff', fontWeight: 700,
                                                fontSize: '13px', cursor: wardrobeSaving ? 'wait' : 'pointer',
                                                opacity: wardrobeSaving ? 0.7 : 1,
                                            }}>
                                                {wardrobeSaving ? 'Saving...' : 'Apply & Save'}
                                            </button>
                                            <button onClick={() => {
                                                setWardrobeSelectedIds({});
                                                setWardrobePreviewFrame('none');
                                                setWardrobePreviewFrameColor(undefined);
                                                setWardrobePreviewNameplate('none');
                                                applyGlobalAvatarFrame('none');
                                                applyGlobalNameplateStyle('none');
                                            }} style={{
                                                width: '100%', padding: '8px', borderRadius: '8px',
                                                border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)',
                                                color: 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                                            }}>
                                                Reset
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {activeTab === 'stats' && <SettingsStatsTab />}

                        {/* Notifications (push + email) */}
                        {activeTab === 'notifications' && <SettingsNotificationsPanel />}

                        {/* Muted Users */}
                        {activeTab === 'muted-users' && <SettingsMutedUsersPanel addToast={addToast} />}

                        {/* Referrals */}
                        {activeTab === 'referrals' && <SettingsReferralsPanel addToast={addToast} />}

                        {/* DND Schedule */}
                        {activeTab === 'dnd-schedule' && <SettingsDndSchedulePanel addToast={addToast} />}

                        {/* Message Snippets */}
                        {activeTab === 'snippets' && <SettingsSnippetsPanel addToast={addToast} />}

                        {/* Developer / OAuth Apps */}
                        {activeTab === 'developer' && <SettingsDeveloperPanel addToast={addToast} />}
                    </div>
                </div>
            </div>

            {/* Crop Modal — rendered outside the settings modal to get its own z-index layer */}
            {cropTarget && pendingFile && (
                <CropModal
                    file={pendingFile}
                    aspect={cropTarget === 'avatar' ? 'circle' : 'banner'}
                    onConfirm={handleCropConfirm}
                    onCancel={() => { setCropTarget(null); setPendingFile(null); }}
                />
            )}

            {/* Theme Editor Modal (Items 26-29) */}
            {showThemeEditor && (
                <ThemeEditorModal
                    onClose={() => { setShowThemeEditor(false); setEditingCustomThemeId(undefined); setCustomThemesList(getCustomThemes()); }}
                    editingThemeId={editingCustomThemeId}
                />
            )}

            {/* Theme Store Modal (Items 33-40) */}
            {showThemeStore && (
                <ThemeStoreModal
                    onClose={() => { setShowThemeStore(false); setCustomThemesList(getCustomThemes()); }}
                />
            )}

            {/* Plugin Store Modal */}
            {showPluginStore && (
                <PluginStoreModal onClose={() => setShowPluginStore(false)} />
            )}
        </>
    );
};

// ---------------------------------------------------------------------------
// Notifications Panel (push + email prefs) — Items 22 & 23
// ---------------------------------------------------------------------------
function SettingsNotificationsPanel() {
    const { addToast } = useToast();
    const [pushEnabled, setPushEnabled] = useState(false);
    const [pushSupported] = useState(() => 'serviceWorker' in navigator && 'PushManager' in window);
    const [emailPrefs, setEmailPrefs] = useState<{
        mentions: boolean;
        dms: boolean;
        frequency: 'instant' | 'daily' | 'never';
        securityAlerts: boolean;
    }>({ mentions: false, dms: false, frequency: 'never', securityAlerts: false });

    useEffect(() => {
        // Check push subscription status
        if (pushSupported && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => {
                setPushEnabled(!!sub);
            }).catch(() => {});
        }
        // Load email prefs from settings
        api.users.getSettings().then((s: any) => {
            if (s?.emailNotifications) {
                setEmailPrefs(prev => ({
                    ...prev,
                    ...s.emailNotifications,
                    securityAlerts: s.emailNotifications.securityAlerts === true,
                }));
            }
        }).catch(() => {});
    }, []);

    const togglePush = async () => {
        try {
            if (pushEnabled) {
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.getSubscription();
                if (sub) {
                    await api.push.unsubscribe(sub.endpoint);
                    await sub.unsubscribe();
                }
                setPushEnabled(false);
                addToast({ title: 'Push notifications disabled', variant: 'info' });
            } else {
                // Request notification permission first
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    addToast({ title: 'Notification permission denied', description: 'Allow notifications in your browser settings to enable push.', variant: 'error' });
                    return;
                }
                const { key } = await api.push.getVapidPublicKey();
                if (!key) {
                    addToast({ title: 'Push not available', description: 'Server did not provide a push key.', variant: 'error' });
                    return;
                }
                const reg = await navigator.serviceWorker.ready;
                const sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
                });
                const json = sub.toJSON();
                try {
                    await api.push.subscribe({ endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth });
                } catch (apiErr) {
                    // API registration failed — clean up the browser subscription to stay in sync
                    await sub.unsubscribe().catch(() => {});
                    throw apiErr;
                }
                setPushEnabled(true);
                addToast({ title: 'Push notifications enabled', variant: 'success' });
            }
        } catch (err) {
            addToast({ title: 'Failed to toggle push notifications', description: err instanceof Error ? err.message : 'Unknown error', variant: 'error' });
        }
    };

    const updateEmailPref = (key: keyof typeof emailPrefs, value: any) => {
        const next = { ...emailPrefs, [key]: value };
        setEmailPrefs(next);
        api.users.updateSettings({ emailNotifications: next }).catch(() => {});
    };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Notifications</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Control how and when you receive notifications.</p>

            <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Push Notifications</h3>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>Enable Push Notifications</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                            {pushSupported ? 'Receive notifications even when Gratonite is closed.' : 'Push notifications are not supported by your browser.'}
                        </div>
                    </div>
                    <div
                        onClick={pushSupported ? togglePush : undefined}
                        style={{
                            width: '44px', height: '24px', borderRadius: '12px', cursor: pushSupported ? 'pointer' : 'not-allowed',
                            background: pushEnabled ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                            border: `1px solid ${pushEnabled ? 'transparent' : 'var(--stroke)'}`,
                            position: 'relative', transition: 'background 0.2s ease', flexShrink: 0,
                            opacity: pushSupported ? 1 : 0.5,
                        }}
                    >
                        <div style={{
                            width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                            position: 'absolute', top: '2px', left: pushEnabled ? '22px' : '2px',
                            transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                        }} />
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Email Notifications</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.45 }}>
                    Account verification and password reset emails are always sent when needed. Everything below is opt-in.
                </p>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', overflow: 'hidden' }}>
                    <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>Mentions</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Receive email when someone mentions you.</div>
                        </div>
                        <div onClick={() => updateEmailPref('mentions', !emailPrefs.mentions)} style={{ width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer', background: emailPrefs.mentions ? 'var(--accent-primary)' : 'var(--bg-elevated)', border: `1px solid ${emailPrefs.mentions ? 'transparent' : 'var(--stroke)'}`, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: emailPrefs.mentions ? '22px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                        </div>
                    </div>
                    <div style={{ height: '1px', background: 'var(--stroke)' }} />
                    <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>Direct Messages</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Receive email for unread direct messages.</div>
                        </div>
                        <div onClick={() => updateEmailPref('dms', !emailPrefs.dms)} style={{ width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer', background: emailPrefs.dms ? 'var(--accent-primary)' : 'var(--bg-elevated)', border: `1px solid ${emailPrefs.dms ? 'transparent' : 'var(--stroke)'}`, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: emailPrefs.dms ? '22px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                        </div>
                    </div>
                    <div style={{ height: '1px', background: 'var(--stroke)' }} />
                    <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>New sign-in alerts</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Email when your account is used from a new device or location.</div>
                        </div>
                        <div onClick={() => updateEmailPref('securityAlerts', !emailPrefs.securityAlerts)} style={{ width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer', background: emailPrefs.securityAlerts ? 'var(--accent-primary)' : 'var(--bg-elevated)', border: `1px solid ${emailPrefs.securityAlerts ? 'transparent' : 'var(--stroke)'}`, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: emailPrefs.securityAlerts ? '22px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                        </div>
                    </div>
                    <div style={{ height: '1px', background: 'var(--stroke)' }} />
                    <div style={{ padding: '16px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>Email Frequency</div>
                        <select value={emailPrefs.frequency} onChange={e => updateEmailPref('frequency', e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}>
                            <option value="instant">Instant</option>
                            <option value="daily">Daily Digest</option>
                            <option value="never">Never</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Item 86: DND Schedule */}
            <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Do Not Disturb Schedule</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Automatically enter DND mode during set hours.</p>
                <DndSchedulePanel />
            </div>
        </>
    );
}

// Item 86: DND Schedule Panel
function DndSchedulePanel() {
    const [enabled, setEnabled] = useState(false);
    const [startHour, setStartHour] = useState(22);
    const [startMinute, setStartMinute] = useState(0);
    const [endHour, setEndHour] = useState(7);
    const [endMinute, setEndMinute] = useState(0);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get<any>('/users/@me/settings').then((s: any) => {
            if (s?.dndSchedule) {
                setEnabled(s.dndSchedule.enabled ?? false);
                setStartHour(s.dndSchedule.startHour ?? 22);
                setStartMinute(s.dndSchedule.startMinute ?? 0);
                setEndHour(s.dndSchedule.endHour ?? 7);
                setEndMinute(s.dndSchedule.endMinute ?? 0);
            }
        }).catch(() => {});
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            await api.patch('/users/@me/settings', {
                dndSchedule: { enabled, startHour, startMinute, endHour, endMinute, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
            });
        } catch {} finally { setSaving(false); }
    };

    const timeInput = { padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', width: '60px', textAlign: 'center' as const };

    return (
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>Enable DND Schedule</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Automatically suppress notifications during these hours.</div>
                </div>
                <div onClick={() => { setEnabled(!enabled); setTimeout(save, 100); }} style={{ width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer', background: enabled ? 'var(--accent-primary)' : 'var(--bg-elevated)', border: `1px solid ${enabled ? 'transparent' : 'var(--stroke)'}`, position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: enabled ? '22px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                </div>
            </div>
            {enabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>From</span>
                    <input type="number" min={0} max={23} value={startHour} onChange={e => setStartHour(+e.target.value)} style={timeInput} />
                    <span>:</span>
                    <input type="number" min={0} max={59} value={startMinute} onChange={e => setStartMinute(+e.target.value)} style={timeInput} />
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '8px' }}>To</span>
                    <input type="number" min={0} max={23} value={endHour} onChange={e => setEndHour(+e.target.value)} style={timeInput} />
                    <span>:</span>
                    <input type="number" min={0} max={59} value={endMinute} onChange={e => setEndMinute(+e.target.value)} style={timeInput} />
                    <button onClick={save} disabled={saving} style={{ marginLeft: 'auto', padding: '6px 16px', borderRadius: '6px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>
                        {saving ? '...' : 'Save'}
                    </button>
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Muted Users Panel — Item 12
// ---------------------------------------------------------------------------
function SettingsMutedUsersPanel({ addToast }: { addToast: (t: any) => void }) {
    const [mutedUsers, setMutedUsers] = useState<Array<{ mutedUserId: string; username: string; displayName: string; avatarHash: string | null; createdAt: string }>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.mutes.list().then(data => setMutedUsers(Array.isArray(data) ? data : [])).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const handleUnmute = async (userId: string) => {
        try {
            await api.mutes.unmute(userId);
            setMutedUsers(prev => prev.filter(u => u.mutedUserId !== userId));
            addToast({ title: 'User unmuted', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to unmute user', variant: 'error' });
        }
    };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Muted Users</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Muted users will not be able to send you notifications. Their messages will still appear, but grayed out.</p>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : mutedUsers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <VolumeX size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <p style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>No muted users</p>
                    <p style={{ fontSize: '13px', marginTop: '4px' }}>Right-click a user and select "Mute" to add them here.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {mutedUsers.map(u => (
                        <div key={u.mutedUserId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: '10px', border: '1px solid var(--stroke)' }}>
                            <Avatar userId={u.mutedUserId} avatarHash={u.avatarHash} displayName={u.displayName} size={36} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{u.displayName}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{u.username} — muted {new Date(u.createdAt).toLocaleDateString()}</div>
                            </div>
                            <button onClick={() => handleUnmute(u.mutedUserId)} style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                                Unmute
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// Referrals Panel — Item 20
// ---------------------------------------------------------------------------
function SettingsReferralsPanel({ addToast }: { addToast: (t: any) => void }) {
    const [data, setData] = useState<{ code: string; referralLink: string; count: number } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.referrals.get().then(setData).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const copyLink = () => {
        if (data?.referralLink) {
            copyToClipboard(data.referralLink);
            addToast({ title: 'Referral link copied!', variant: 'success' });
        }
    };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Referrals</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Invite friends to Gratonite and track your referrals.</p>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : data ? (
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--stroke)', padding: '24px' }}>
                    <div style={{ fontSize: '48px', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '8px' }}>{data.count}</div>
                    <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>people joined using your link</div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>YOUR REFERRAL LINK</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input type="text" readOnly value={data.referralLink} style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                            <button onClick={copyLink} style={{ padding: '10px 16px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Copy size={14} /> Copy
                            </button>
                        </div>
                    </div>

                    <div style={{ padding: '12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        Share your referral link with friends. When they sign up and join their first server, you'll both get credit.
                    </div>
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Failed to load referral data.</div>
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// Developer / OAuth Apps Panel — Item 15
// ---------------------------------------------------------------------------
function SettingsDeveloperPanel({ addToast }: { addToast: (t: any) => void }) {
    const [apps, setApps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newRedirectUris, setNewRedirectUris] = useState('');
    const [createdSecret, setCreatedSecret] = useState<string | null>(null);

    useEffect(() => {
        api.oauthApps.list().then(data => setApps(Array.isArray(data) ? data : [])).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        try {
            const app = await api.oauthApps.create({
                name: newName.trim(),
                description: newDesc.trim() || undefined,
                redirectUris: newRedirectUris.split('\n').map(s => s.trim()).filter(Boolean),
                scopes: ['identify', 'guilds'],
            });
            setApps(prev => [...prev, app]);
            setCreatedSecret(app.clientSecret || null);
            setNewName('');
            setNewDesc('');
            setNewRedirectUris('');
            setShowCreate(false);
            addToast({ title: 'Application created', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to create application', variant: 'error' });
        }
    };

    const handleDelete = async (appId: string) => {
        try {
            await api.oauthApps.remove(appId);
            setApps(prev => prev.filter(a => a.id !== appId));
            addToast({ title: 'Application deleted', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to delete application', variant: 'error' });
        }
    };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Applications</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>Create and manage OAuth2 applications for integrations and bots.</p>

            {createdSecret && (
                <div style={{ padding: '16px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '10px', border: '1px solid rgba(34, 197, 94, 0.3)', marginBottom: '24px' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#22c55e', marginBottom: '8px' }}>Client Secret (copy now — won't be shown again)</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <code style={{ flex: 1, padding: '8px', background: 'var(--bg-primary)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{createdSecret}</code>
                        <button onClick={() => { copyToClipboard(createdSecret); addToast({ title: 'Secret copied', variant: 'success' }); }} style={{ padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px' }}>Copy</button>
                    </div>
                    <button onClick={() => setCreatedSecret(null)} style={{ marginTop: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>Dismiss</button>
                </div>
            )}

            <button onClick={() => setShowCreate(!showCreate)} style={{ padding: '10px 18px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600, marginBottom: '24px' }}>
                + New Application
            </button>

            {showCreate && (
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--stroke)', padding: '20px', marginBottom: '24px' }}>
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>NAME</label>
                        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="My Application" style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>DESCRIPTION</label>
                        <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What does your app do?" rows={2} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>REDIRECT URIS (one per line)</label>
                        <textarea value={newRedirectUris} onChange={e => setNewRedirectUris(e.target.value)} placeholder="https://example.com/callback" rows={2} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handleCreate} style={{ padding: '8px 18px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Create</button>
                        <button onClick={() => setShowCreate(false)} style={{ padding: '8px 18px', borderRadius: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : apps.length === 0 && !showCreate ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px' }}>No applications yet</p>
                    <p style={{ fontSize: '13px', margin: 0 }}>Create an OAuth2 application to get started.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {apps.map(app => (
                        <div key={app.id} style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '10px', border: '1px solid var(--stroke)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <div>
                                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{app.name}</div>
                                    {app.description && <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{app.description}</div>}
                                </div>
                                <button onClick={() => handleDelete(app.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                <div style={{ marginBottom: '4px' }}>Client ID: <code style={{ color: 'var(--text-secondary)' }}>{app.clientId}</code></div>
                                {app.redirectUris?.length > 0 && <div>Redirect URIs: {app.redirectUris.join(', ')}</div>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

// ---------------------------------------------------------------------------
// DND Schedule Panel — Feature 18
// ---------------------------------------------------------------------------
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function SettingsDndSchedulePanel({ addToast }: { addToast: (t: any) => void }) {
    const [enabled, setEnabled] = useState(false);
    const [startTime, setStartTime] = useState('22:00');
    const [endTime, setEndTime] = useState('08:00');
    const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]); // all days
    const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get('/users/@me/dnd-schedule').then((r: any) => {
            if (r && r.enabled !== undefined) {
                setEnabled(r.enabled);
                setStartTime(r.startTime || '22:00');
                setEndTime(r.endTime || '08:00');
                setDays(r.days || [0, 1, 2, 3, 4, 5, 6]);
                setTimezone(r.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
            }
        }).catch(() => {}).finally(() => setLoading(false));
    }, []);

    const toggleDay = (day: number) => {
        setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort());
    };

    const save = async () => {
        setSaving(true);
        try {
            await api.put('/users/@me/dnd-schedule', { enabled, startTime, endTime, days, timezone });
            addToast({ title: 'DND schedule saved', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to save DND schedule', variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading...</div>;

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>DND Schedule</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                Automatically set your status to Do Not Disturb on a schedule. Notifications will be suppressed during DND hours.
            </p>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text-primary)', cursor: 'pointer', marginBottom: '20px' }}>
                <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} style={{ accentColor: 'var(--accent-primary)', width: '18px', height: '18px' }} />
                Enable automatic DND schedule
            </label>

            {enabled && (
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--stroke)', padding: '20px' }}>
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Start Time</label>
                            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>End Time</label>
                            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Active Days</label>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {DAYS_OF_WEEK.map((day, i) => (
                                <button key={i} onClick={() => toggleDay(i)}
                                    style={{
                                        padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                        background: days.includes(i) ? 'var(--accent-primary)' : 'var(--bg-primary)',
                                        color: days.includes(i) ? 'white' : 'var(--text-secondary)',
                                        border: `1px solid ${days.includes(i) ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                        transition: 'all 0.15s',
                                    }}
                                >{day.slice(0, 3)}</button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Timezone</label>
                        <select value={timezone} onChange={e => setTimezone(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                        >
                            {(typeof (Intl as any).supportedValuesOf === 'function' ? (Intl as any).supportedValuesOf('timeZone') as string[] : ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney']).map((tz: string) => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
                        </select>
                    </div>

                    <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        DND will activate from <strong style={{ color: 'var(--text-primary)' }}>{startTime}</strong> to <strong style={{ color: 'var(--text-primary)' }}>{endTime}</strong> on selected days. Your status will automatically restore when DND ends.
                    </div>
                </div>
            )}

            <button onClick={save} disabled={saving}
                style={{
                    marginTop: '20px', padding: '10px 24px', borderRadius: '8px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                    background: 'var(--accent-primary)', color: 'white', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit', opacity: saving ? 0.6 : 1,
                }}
            >{saving ? 'Saving...' : 'Save Schedule'}</button>
        </>
    );
}

// ---------------------------------------------------------------------------
// Message Snippets Panel — Feature 21
// ---------------------------------------------------------------------------
function SettingsSnippetsPanel({ addToast }: { addToast: (t: any) => void }) {
    const [snippets, setSnippets] = useState<Array<{ id: string; title: string; content: string; tags: string[]; usageCount: number }>>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchSnippets = () => {
        api.get(`/users/@me/snippets${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`).then((data: any) => {
            setSnippets(Array.isArray(data) ? data : []);
        }).catch(() => {}).finally(() => setLoading(false));
    };

    useEffect(() => { fetchSnippets(); }, [searchQuery]);

    const resetForm = () => {
        setTitle(''); setContent(''); setTags('');
        setShowCreate(false); setEditingId(null);
    };

    const handleSave = async () => {
        if (!title.trim() || !content.trim()) return;
        const payload = { title: title.trim(), content: content.trim(), tags: tags.split(',').map(t => t.trim()).filter(Boolean) };
        try {
            if (editingId) {
                await api.patch(`/users/@me/snippets/${editingId}`, payload);
                addToast({ title: 'Snippet updated', variant: 'success' });
            } else {
                await api.post('/users/@me/snippets', payload);
                addToast({ title: 'Snippet created', variant: 'success' });
            }
            resetForm();
            fetchSnippets();
        } catch {
            addToast({ title: 'Failed to save snippet', variant: 'error' });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.delete(`/users/@me/snippets/${id}`);
            addToast({ title: 'Snippet deleted', variant: 'success' });
            fetchSnippets();
        } catch {
            addToast({ title: 'Failed to delete snippet', variant: 'error' });
        }
    };

    const startEdit = (snippet: typeof snippets[0]) => {
        setEditingId(snippet.id);
        setTitle(snippet.title);
        setContent(snippet.content);
        setTags(snippet.tags.join(', '));
        setShowCreate(true);
    };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Message Snippets</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '13px' }}>
                Save reusable text snippets for quick insertion. Use <code style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>/snippet</code> in chat to insert.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input placeholder="Search snippets..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px 10px 34px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                </div>
                <button onClick={() => { resetForm(); setShowCreate(true); }}
                    style={{ padding: '10px 16px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                >New Snippet</button>
            </div>

            {showCreate && (
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--stroke)', padding: '16px', marginBottom: '16px' }}>
                    <input placeholder="Snippet title" value={title} onChange={e => setTitle(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', marginBottom: '10px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                    <textarea placeholder="Snippet content..." value={content} onChange={e => setContent(e.target.value)} rows={4}
                        style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'vertical', marginBottom: '10px', boxSizing: 'border-box', fontFamily: 'var(--font-mono)' }}
                    />
                    <input placeholder="Tags (comma-separated)" value={tags} onChange={e => setTags(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box', fontFamily: 'inherit' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={resetForm} style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit' }}>Cancel</button>
                        <button onClick={handleSave} style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--accent-primary)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit' }}>{editingId ? 'Update' : 'Create'}</button>
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : snippets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    {searchQuery ? 'No snippets match your search.' : 'No snippets yet. Create one to get started!'}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {snippets.map(s => (
                        <div key={s.id} style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', border: '1px solid var(--stroke)', padding: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</span>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <button onClick={() => startEdit(s)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}><Edit3 size={14} /></button>
                                    <button onClick={() => handleDelete(s.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}><Trash2 size={14} /></button>
                                </div>
                            </div>
                            <pre style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px', whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', background: 'var(--bg-primary)', padding: '8px', borderRadius: '6px', maxHeight: '100px', overflow: 'auto' }}>{s.content}</pre>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {s.tags.map(tag => (
                                        <span key={tag} style={{ padding: '2px 8px', borderRadius: '10px', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)', fontSize: '11px', fontWeight: 600 }}>{tag}</span>
                                    ))}
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Used {s.usageCount}x</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

export default SettingsModal;
