import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X, Check, ZoomIn, ZoomOut, RotateCw, Volume2, VolumeX, Copy, Info, Link2, Globe, Search, Download, Upload, Star, Sun, Moon, Dices, Eye, Sparkles, Palette, ShoppingBag, Edit3, Trash2, Share2 } from 'lucide-react';
import { useTheme, ButtonShape, AppTheme, ColorMode, FontFamily, FontSize, GlassMode, FocusIndicatorSize, ColorBlindMode } from '../ui/ThemeProvider';
import { haptic } from '../../utils/haptics';
import { useToast } from '../ui/ToastManager';
import { useUser } from '../../contexts/UserContext';
import { isSoundMuted, setSoundMuted, getSoundVolume, setSoundVolume, getSoundPack, setSoundPack, playSound } from '../../utils/SoundManager';
import { api, API_BASE } from '../../lib/api';
import LoginHistoryPage from '../../pages/app/LoginHistory';
import { SettingsAccountTab, SettingsFeedbackTab, SettingsAchievementsTab, SettingsStatsTab, SettingsConnectionsTab, SettingsPrivacyTab } from './settings';
import type { UserProfileLike, UserThemeLike } from './settings/types';
import { AVAILABLE_LOCALES, getLocale, setLocale } from '../../i18n';
import { CODE_THEMES as codeThemeOptions, getCodeTheme as codeThemeGet, setCodeTheme as codeThemeSet, type CodeThemeId } from '../../utils/codeTheme';
import { getAllThemesIncludingCustom, getAllThemes, searchThemes, getThemesByCategory, getCategories, toggleFavoriteTheme, isFavoriteTheme, getFavoriteThemeIds, getRecentThemeIds, resolveTheme, getCustomThemes, deleteCustomTheme, saveCustomTheme } from '../../themes/registry';
import type { ThemeDefinition, ThemeCategory } from '../../themes/types';
import ThemePreview from '../ui/ThemePreview';
import ThemeEditorModal from './ThemeEditorModal';
import ThemeStoreModal from './ThemeStoreModal';
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

    const [activeTab, setActiveTab] = useState<'account' | 'profile' | 'security' | 'sessions' | 'theme' | 'accessibility' | 'sound' | 'feedback' | 'privacy' | 'connections' | 'achievements' | 'stats' | 'wardrobe'>('account');
    const [settingsSearch, setSettingsSearch] = useState('');
    const settingsSearchRef = useRef<HTMLInputElement>(null);

    // Settings search index — maps keywords to tabs
    const settingsIndex = useMemo(() => [
        { tab: 'account', label: 'My Account', keywords: ['account', 'email', 'username', 'password', 'delete account', 'two-factor', 'mfa', '2fa'] },
        { tab: 'profile', label: 'Profile', keywords: ['profile', 'avatar', 'banner', 'display name', 'bio', 'about me', 'nameplate'] },
        { tab: 'sessions', label: 'Sessions', keywords: ['sessions', 'devices', 'login', 'active sessions', 'mutes', 'muted users'] },
        { tab: 'privacy', label: 'Privacy & Safety', keywords: ['privacy', 'safety', 'block', 'data export', 'gdpr', 'dm', 'direct message', 'friend request'] },
        { tab: 'connections', label: 'Connections', keywords: ['connections', 'linked accounts', 'github', 'spotify', 'twitter'] },
        { tab: 'achievements', label: 'Achievements', keywords: ['achievements', 'badges', 'trophies', 'unlocked'] },
        { tab: 'stats', label: 'Stats', keywords: ['stats', 'statistics', 'messages sent', 'activity', 'analytics'] },
        { tab: 'wardrobe', label: 'Wardrobe', keywords: ['wardrobe', 'cosmetics', 'avatar frame', 'decoration', 'nameplate style'] },
        { tab: 'theme', label: 'Theme', keywords: ['theme', 'dark mode', 'light mode', 'color', 'accent', 'font', 'glass', 'compact', 'button shape', 'neobrutalism', 'import', 'export'] },
        { tab: 'sound', label: 'Sound', keywords: ['sound', 'volume', 'notification', 'mute', 'audio', 'ambient'] },
        { tab: 'accessibility', label: 'Accessibility', keywords: ['accessibility', 'screen reader', 'reduced motion', 'color blind', 'focus', 'underline', 'high contrast', 'link underlines'] },
        { tab: 'feedback', label: 'Send Feedback', keywords: ['feedback', 'bug', 'report', 'suggestion', 'feature request'] },
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
        }).catch(e => console.error('Failed to load settings:', e));
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
        }).catch(e => console.error('Failed to load wardrobe:', e)).finally(() => setWardrobeLoading(false));
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
        settingsSaveTimerRef.current = setTimeout(() => {
            api.users.updateSettings(data).catch(() => {
                addToast({ title: 'Failed to sync settings', variant: 'error' });
            });
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

    return (
        <>
            <div className="modal-overlay" onClick={onClose} style={{ background: 'rgba(0, 0, 0, 0.6)' }}>
                <div className="settings-modal flex-row glass-panel" onClick={e => e.stopPropagation()} style={{ width: 'min(960px, 95vw)', height: 'min(680px, 90vh)', padding: 0, overflow: 'hidden' }}>
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
                        {(['account', 'profile', 'sessions', 'privacy', 'connections', 'achievements', 'stats', 'wardrobe', 'theme', 'sound', 'accessibility', 'feedback'] as const).map(tab => (
                            <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
                                {tab === 'privacy' ? 'Privacy' : tab === 'connections' ? 'Connections' : tab === 'achievements' ? 'Achievements' : tab === 'wardrobe' ? 'Wardrobe' : tab === 'accessibility' ? 'A11y' : tab === 'feedback' ? 'Feedback' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Right Panel */}
                    <div className="settings-content-panel" style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', position: 'relative' }}>
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
                                                            <button onClick={() => { navigator.clipboard.writeText(mfaSecret); addToast({ title: 'Copied', description: 'Secret key copied to clipboard.', variant: 'success' }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}><Copy size={14} /></button>
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
                                                        navigator.clipboard.writeText(backupCodes.join('\n'));
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

                                <div style={{ display: 'flex', gap: '32px' }}>
                                    {/* Editor Column */}
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
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
                                                            padding: '12px',
                                                            borderRadius: '8px',
                                                            background: avatarFrame === frame.id ? 'rgba(82, 109, 245, 0.1)' : 'var(--bg-tertiary)',
                                                            border: `1px solid ${avatarFrame === frame.id ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                                            color: avatarFrame === frame.id ? 'white' : 'var(--text-secondary)',
                                                            cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '13px', fontWeight: 500 }}>{frame.label}</span>
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
                                                    value={localStorage.getItem('gratonite_birthday_month') ?? ''}
                                                    onChange={(e) => localStorage.setItem('gratonite_birthday_month', e.target.value)}
                                                >
                                                    <option value="">Month</option>
                                                    {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                                                        <option key={i} value={String(i + 1)}>{m}</option>
                                                    ))}
                                                </select>
                                                <select
                                                    className="auth-input"
                                                    style={{ flex: 1, height: '38px' }}
                                                    value={localStorage.getItem('gratonite_birthday_day') ?? ''}
                                                    onChange={(e) => localStorage.setItem('gratonite_birthday_day', e.target.value)}
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
                                                    const month = parseInt(localStorage.getItem('gratonite_birthday_month') ?? '0');
                                                    const day = parseInt(localStorage.getItem('gratonite_birthday_day') ?? '0');
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
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
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
                                            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>Per-Server Profile Overrides</h3>
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>Customize your nickname and nameplate style per server. Overrides your global defaults.</p>

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
                                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                                                            onClick={() => saveNicknameOverride(server.id)}
                                                            disabled={savingNicknameForGuildId === server.id}
                                                            style={{ marginTop: 0, width: 'auto', minWidth: '84px', padding: '0 14px', height: '34px', background: 'var(--accent-primary)', color: '#000' }}
                                                        >
                                                            {savingNicknameForGuildId === server.id ? 'Saving…' : 'Save'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {joinedGuilds.length === 0 && (
                                                <div style={{ width: '100%', padding: '10px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px dashed var(--stroke)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
                                                    Join a server to configure per-server profile overrides.
                                                </div>
                                            )}
                                            <button onClick={() => setShowServerOverrideInfo(!showServerOverrideInfo)} style={{ width: '100%', padding: '8px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px dashed var(--stroke)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', marginTop: '4px' }}>
                                                {showServerOverrideInfo ? 'Hide details' : 'About server overrides'}
                                            </button>
                                            {showServerOverrideInfo && (
                                                <div style={{ marginTop: '8px', padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-primary)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                                    <Info size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                                                    <div>
                                                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Server Profile Overrides</div>
                                                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>Join more servers to add per-server overrides for your identity. Each server you join will appear here, letting you set a unique nickname and nameplate style that only applies in that server.</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Preview Column - Redesigned with bigger banner */}
                                    <div style={{ width: '280px', flexShrink: 0 }}>
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
                                                    background: avatarStyle,
                                                    backgroundSize: 'cover',
                                                    backgroundPosition: 'center',
                                                    border: '5px solid var(--bg-elevated)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '32px', fontWeight: 'bold',
                                                    marginTop: '-42px', marginBottom: '12px',
                                                    position: 'relative',
                                                    boxShadow: avatarFrame === 'neon' ? '0 0 20px 6px rgba(56, 189, 248, 0.6)' : avatarFrame === 'gold' ? '0 0 0 3px #f59e0b, 0 0 12px rgba(245, 158, 11, 0.4)' : 'none',
                                                    ...(avatarFrame === 'glass' ? {
                                                        backdropFilter: 'blur(2px)',
                                                        borderColor: 'rgba(255,255,255,0.3)',
                                                        boxShadow: 'inset 0 0 20px rgba(255,255,255,0.1)',
                                                    } : {})
                                                }}>
                                                    {avatarStyle.includes('gradient') ? (userProfile?.name?.[0]?.toUpperCase() || '?') : ''}
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
                            </>
                        )}

                        {activeTab === 'sessions' && (
                            <LoginHistoryPage />
                        )}

                        {/* Connections tab hidden — OAuth integration not yet available */}
                        {/* Activity Privacy tab hidden — game activity detection not yet available */}

                        {activeTab === 'theme' && (
                            <>
                                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Theme & Appearance</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Customize the global look and feel of your Gratonite experience.</p>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Color Mode</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '32px' }}>
                                    <div onClick={() => setColorMode('dark')} style={{ background: colorMode === 'dark' ? 'var(--bg-tertiary)' : 'var(--bg-elevated)', padding: '16px', borderRadius: '12px', border: `1px solid ${colorMode === 'dark' ? 'var(--accent-primary)' : 'var(--stroke)'}`, cursor: 'pointer', position: 'relative' }}>
                                        {colorMode === 'dark' && <div style={{ position: 'absolute', top: 12, right: 12 }}><Check size={18} color="var(--accent-primary)" /></div>}
                                        <div style={{ width: '100%', height: '80px', background: '#0f172a', borderRadius: '8px', marginBottom: '12px', border: '1px solid #1e293b', padding: '8px', display: 'flex', gap: '8px' }}>
                                            <div style={{ width: '20%', height: '100%', background: '#1e293b', borderRadius: '4px' }}></div>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ height: '8px', width: '40%', background: '#3b82f6', borderRadius: '4px' }}></div>
                                                <div style={{ height: '8px', width: '80%', background: '#334155', borderRadius: '4px' }}></div>
                                            </div>
                                        </div>
                                        <h4 style={{ fontSize: '15px', fontWeight: 600 }}>Dark Mode</h4>
                                    </div>

                                    <div onClick={() => setColorMode('light')} style={{ background: colorMode === 'light' ? 'var(--bg-tertiary)' : 'var(--bg-elevated)', padding: '16px', borderRadius: '12px', border: `1px solid ${colorMode === 'light' ? 'var(--accent-primary)' : 'var(--stroke)'}`, cursor: 'pointer' }}>
                                        {colorMode === 'light' && <div style={{ position: 'absolute', top: 12, right: 12 }}><Check size={18} color="var(--accent-primary)" /></div>}
                                        <div style={{ width: '100%', height: '80px', background: '#f8fafc', borderRadius: '8px', marginBottom: '12px', border: '1px solid #e2e8f0', padding: '8px', display: 'flex', gap: '8px' }}>
                                            <div style={{ width: '20%', height: '100%', background: '#e2e8f0', borderRadius: '4px' }}></div>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div style={{ height: '8px', width: '40%', background: '#3b82f6', borderRadius: '4px' }}></div>
                                                <div style={{ height: '8px', width: '80%', background: '#cbd5e1', borderRadius: '4px' }}></div>
                                            </div>
                                        </div>
                                        <h4 style={{ fontSize: '15px', fontWeight: 600 }}>Light Mode</h4>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Theme</h3>

                                {/* Action buttons: Create, Store, Import, Export */}
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={() => { setEditingCustomThemeId(undefined); setShowThemeEditor(true); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '8px 14px', borderRadius: '8px',
                                            background: 'var(--accent-primary)', color: '#fff',
                                            border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                        }}
                                    >
                                        <Palette size={14} /> Create Theme
                                    </button>
                                    <button
                                        onClick={() => setShowThemeStore(true)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '8px 14px', borderRadius: '8px',
                                            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                                            border: '1px solid var(--stroke)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                        }}
                                    >
                                        <ShoppingBag size={14} /> Theme Store
                                    </button>
                                    <button
                                        onClick={() => themeImportRef.current?.click()}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '8px 14px', borderRadius: '8px',
                                            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                                            border: '1px solid var(--stroke)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                        }}
                                    >
                                        <Upload size={14} /> Import
                                    </button>
                                    <button
                                        onClick={() => {
                                            const currentTheme = resolveTheme(theme);
                                            if (currentTheme) {
                                                const blob = new Blob([JSON.stringify(currentTheme, null, 2)], { type: 'application/json' });
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `${currentTheme.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
                                                a.click();
                                                URL.revokeObjectURL(url);
                                                addToast({ title: 'Theme exported!', variant: 'success' });
                                            }
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '8px 14px', borderRadius: '8px',
                                            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                                            border: '1px solid var(--stroke)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                        }}
                                    >
                                        <Download size={14} /> Export Current
                                    </button>
                                    {/* Hidden file input for import (Item 32) */}
                                    <input
                                        ref={themeImportRef}
                                        type="file"
                                        accept=".json"
                                        style={{ display: 'none' }}
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const reader = new FileReader();
                                            reader.onload = () => {
                                                try {
                                                    const parsed = JSON.parse(reader.result as string);
                                                    if (!parsed.id || !parsed.name || !parsed.dark || !parsed.light) {
                                                        addToast({ title: 'Invalid theme file: missing required fields (id, name, dark, light)', variant: 'error' });
                                                        return;
                                                    }
                                                    parsed.id = `imported-${Date.now()}`;
                                                    saveCustomTheme(parsed);
                                                    setCustomThemesList(getCustomThemes());
                                                    setTheme(parsed.id);
                                                    addToast({ title: `Imported theme "${parsed.name}"!`, variant: 'success' });
                                                } catch {
                                                    addToast({ title: 'Failed to parse theme file', variant: 'error' });
                                                }
                                            };
                                            reader.readAsText(file);
                                            e.target.value = '';
                                        }}
                                    />
                                </div>

                                {/* My Themes section (Item 31) */}
                                {customThemesList.length > 0 && (
                                    <div style={{ marginBottom: '20px' }}>
                                        <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '10px', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Palette size={12} color="var(--accent-primary)" /> My Themes ({customThemesList.length})
                                        </h4>
                                        <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                            {customThemesList.map(t => {
                                                const isSelected = theme === t.id;
                                                const p = t.preview;
                                                return (
                                                    <div
                                                        key={`custom-${t.id}`}
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => setTheme(t.id as any)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTheme(t.id as any); } }}
                                                        onMouseEnter={() => previewTheme(t.id)}
                                                        onMouseLeave={() => previewTheme(null)}
                                                        style={{
                                                            background: 'var(--bg-elevated)',
                                                            border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                                            borderRadius: '12px',
                                                            overflow: 'hidden',
                                                            cursor: 'pointer',
                                                            transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s',
                                                            boxShadow: isSelected ? '0 0 0 1px var(--accent-primary)' : 'none',
                                                            position: 'relative',
                                                        }}
                                                    >
                                                        <div style={{ height: '72px', background: p.bg, display: 'flex', gap: '4px', padding: '6px' }}>
                                                            <div style={{ width: '22px', background: p.sidebar, borderRadius: '4px', flexShrink: 0 }}></div>
                                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                <div style={{ height: '8px', width: '50%', background: p.accent, borderRadius: '3px' }}></div>
                                                                <div style={{ height: '6px', width: '80%', background: p.text, borderRadius: '3px', opacity: 0.5 }}></div>
                                                                <div style={{ height: '6px', width: '60%', background: p.text, borderRadius: '3px', opacity: 0.3 }}></div>
                                                                <div style={{ height: '4px', width: '30%', background: p.accent, borderRadius: '3px', opacity: 0.6 }}></div>
                                                            </div>
                                                        </div>
                                                        <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <div style={{ minWidth: 0 }}>
                                                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {t.name}
                                                                </div>
                                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Custom</div>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setEditingCustomThemeId(t.id); setShowThemeEditor(true); }}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
                                                                    title="Edit theme"
                                                                >
                                                                    <Edit3 size={12} color="var(--text-muted)" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (confirm(`Publish "${t.name}" to the Theme Store? This will make it visible to all users.`)) {
                                                                            const varsForApi: Record<string, string> = {};
                                                                            for (const [k, v] of Object.entries(t.dark)) {
                                                                                varsForApi[`dark.${k}`] = String(v);
                                                                            }
                                                                            for (const [k, v] of Object.entries(t.light)) {
                                                                                varsForApi[`light.${k}`] = String(v);
                                                                            }
                                                                            api.themes.create({
                                                                                name: t.name,
                                                                                description: t.description,
                                                                                tags: [t.category],
                                                                                vars: varsForApi,
                                                                            }).then((created: any) => {
                                                                                return api.themes.publish(created.id);
                                                                            }).then(() => {
                                                                                addToast({ title: `"${t.name}" published to the Theme Store!`, variant: 'success' });
                                                                            }).catch(() => {
                                                                                addToast({ title: 'Failed to publish theme', variant: 'error' });
                                                                            });
                                                                        }
                                                                    }}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
                                                                    title="Publish to Theme Store"
                                                                >
                                                                    <Share2 size={12} color="var(--text-muted)" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (confirm(`Delete "${t.name}"?`)) {
                                                                            deleteCustomTheme(t.id);
                                                                            setCustomThemesList(getCustomThemes());
                                                                            if (theme === t.id) setTheme('default');
                                                                            addToast({ title: 'Theme deleted', variant: 'success' });
                                                                        }
                                                                    }}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
                                                                    title="Delete theme"
                                                                >
                                                                    <Trash2 size={12} color="var(--error)" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {isSelected && (
                                                            <div style={{ position: 'absolute', top: 6, right: 6, background: 'var(--accent-primary)', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                <Check size={11} color="#000" />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Search input */}
                                <div style={{ position: 'relative', marginBottom: '12px' }}>
                                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input
                                        type="text"
                                        placeholder="Search themes..."
                                        value={themeSearchQuery}
                                        onChange={(e) => setThemeSearchQuery(e.target.value)}
                                        className="auth-input"
                                        style={{ width: '100%', padding: '10px 12px 10px 36px', margin: 0, fontSize: '13px' }}
                                    />
                                </div>

                                {/* Category filter pills */}
                                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '16px', scrollbarWidth: 'none' }}>
                                    {(['all', 'dark', 'light', 'colorful', 'minimal', 'retro', 'nature', 'developer', 'accessibility'] as const).map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setThemeCategory(cat)}
                                            style={{
                                                padding: '5px 12px',
                                                borderRadius: '16px',
                                                border: 'none',
                                                background: themeCategory === cat ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                                color: themeCategory === cat ? '#fff' : 'var(--text-secondary)',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                whiteSpace: 'nowrap',
                                                transition: 'background 0.15s, color 0.15s',
                                                textTransform: 'capitalize',
                                            }}
                                        >
                                            {cat === 'all' ? 'All' : cat}
                                        </button>
                                    ))}
                                </div>

                                {/* Item 25: Seasonal suggestion */}
                                {(() => { const s = getSeasonalSuggestion(); if (!s || theme === s.themeId) return null; return (<div onClick={() => { setTheme(s.themeId as any); playSound('click'); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', marginBottom: '16px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--accent-primary)', cursor: 'pointer' }}><Sparkles size={16} color="var(--accent-primary)" /><span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{s.emoji} {s.message}</span><span style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 700 }}>Try it</span></div>); })()}
                                {/* Item 22: Random Theme */}
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}><button onClick={() => { const all = getAllThemes(); const pick = all[Math.floor(Math.random() * all.length)]; if (pick) { previewTheme(pick.id); (window as any).__gratoniteFullPreview = pick.id; setFullPreviewId(pick.id); window.dispatchEvent(new CustomEvent('gratonite:full-preview-changed')); } playSound('click'); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}><Dices size={14} /> Random Theme</button></div>
                                {/* Item 23: Code theme suggestion */}
                                {codeSuggestion && (<div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', marginBottom: '16px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px dashed var(--stroke)' }}><Info size={14} color="var(--accent-primary)" /><span style={{ fontSize: '11px', color: 'var(--text-secondary)', flex: 1 }}>Suggested code theme for {codeSuggestion.themeName}: <strong>{codeThemeList.find(c => c.id === codeSuggestion.codeTheme)?.label || codeSuggestion.codeTheme}</strong></span><button onClick={() => { setCodeThemeId(codeSuggestion.codeTheme); codeThemeSet(codeSuggestion.codeTheme as any); setCodeSuggestion(null); }} style={{ padding: '3px 10px', borderRadius: '6px', border: 'none', background: 'var(--accent-primary)', color: '#000', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Apply</button><button onClick={() => setCodeSuggestion(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}><X size={12} color="var(--text-muted)" /></button></div>)}
                                {/* Favorites section */}
                                {themeCategory === 'all' && !themeSearchQuery && (() => {
                                    const favThemes = favIds.map(id => resolveTheme(id)).filter((t): t is ThemeDefinition => !!t);
                                    if (favThemes.length === 0) return null;
                                    return (
                                        <div style={{ marginBottom: '20px' }}>
                                            <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '10px', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Star size={12} fill="var(--warning)" color="var(--warning)" /> Favorites
                                            </h4>
                                            <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                                {favThemes.map(t => {
                                                    const isSelected = theme === t.id;
                                                    const p = t.preview;
                                                    return (
                                                        <div
                                                            key={`fav-${t.id}`}
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => { haptic.themeSwitch(); setTheme(t.id as any); }}
                                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTheme(t.id as any); } }}
                                                            onMouseEnter={() => previewTheme(t.id)}
                                                            onMouseLeave={() => previewTheme(null)}
                                                            style={{
                                                                background: 'var(--bg-elevated)',
                                                                border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                                                borderRadius: '12px',
                                                                overflow: 'hidden',
                                                                cursor: 'pointer',
                                                                transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s',
                                                                boxShadow: isSelected ? '0 0 0 1px var(--accent-primary)' : 'none',
                                                                position: 'relative',
                                                            }}
                                                        >
                                                            <div style={{ height: '72px', background: p.bg, display: 'flex', gap: '4px', padding: '6px' }}>
                                                                <div style={{ width: '22px', background: p.sidebar, borderRadius: '4px', flexShrink: 0 }}></div>
                                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                    <div style={{ height: '8px', width: '50%', background: p.accent, borderRadius: '3px' }}></div>
                                                                    <div style={{ height: '6px', width: '80%', background: p.text, borderRadius: '3px', opacity: 0.5 }}></div>
                                                                    <div style={{ height: '6px', width: '60%', background: p.text, borderRadius: '3px', opacity: 0.3 }}></div>
                                                                    <div style={{ height: '4px', width: '30%', background: p.accent, borderRadius: '3px', opacity: 0.6 }}></div>
                                                                </div>
                                                            </div>
                                                            <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <div>
                                                                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        {t.name}
                                                                        {t.isDark ? <Moon size={10} color="var(--text-muted)" /> : <Sun size={10} color="var(--warning)" />}
                                                                    </div>
                                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                                        <span style={{ background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: '4px', fontSize: '9px', textTransform: 'capitalize' }}>{t.category}</span>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); toggleFavoriteTheme(t.id); setFavIds(getFavoriteThemeIds()); }}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
                                                                    title="Remove from favorites"
                                                                >
                                                                    <Star size={14} fill="var(--warning)" color="var(--warning)" />
                                                                </button>
                                                            </div>
                                                            {isSelected && (
                                                                <div style={{ position: 'absolute', top: 6, right: 6, background: 'var(--accent-primary)', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <Check size={11} color="#000" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Recently used section */}
                                {themeCategory === 'all' && !themeSearchQuery && (() => {
                                    const recentIds = getRecentThemeIds();
                                    const recentThemes = recentIds.map(id => resolveTheme(id)).filter((t): t is ThemeDefinition => !!t);
                                    if (recentThemes.length === 0) return null;
                                    return (
                                        <div style={{ marginBottom: '20px' }}>
                                            <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '10px', letterSpacing: '0.05em' }}>
                                                Recently Used
                                            </h4>
                                            <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                                {recentThemes.map(t => {
                                                    const isSelected = theme === t.id;
                                                    const p = t.preview;
                                                    const isFav = favIds.includes(t.id);
                                                    return (
                                                        <div
                                                            key={`recent-${t.id}`}
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => { haptic.themeSwitch(); setTheme(t.id as any); }}
                                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTheme(t.id as any); } }}
                                                            onMouseEnter={() => previewTheme(t.id)}
                                                            onMouseLeave={() => previewTheme(null)}
                                                            style={{
                                                                background: 'var(--bg-elevated)',
                                                                border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                                                borderRadius: '12px',
                                                                overflow: 'hidden',
                                                                cursor: 'pointer',
                                                                transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s',
                                                                boxShadow: isSelected ? '0 0 0 1px var(--accent-primary)' : 'none',
                                                                position: 'relative',
                                                            }}
                                                        >
                                                            <div style={{ height: '72px', background: p.bg, display: 'flex', gap: '4px', padding: '6px' }}>
                                                                <div style={{ width: '22px', background: p.sidebar, borderRadius: '4px', flexShrink: 0 }}></div>
                                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                    <div style={{ height: '8px', width: '50%', background: p.accent, borderRadius: '3px' }}></div>
                                                                    <div style={{ height: '6px', width: '80%', background: p.text, borderRadius: '3px', opacity: 0.5 }}></div>
                                                                    <div style={{ height: '6px', width: '60%', background: p.text, borderRadius: '3px', opacity: 0.3 }}></div>
                                                                    <div style={{ height: '4px', width: '30%', background: p.accent, borderRadius: '3px', opacity: 0.6 }}></div>
                                                                </div>
                                                            </div>
                                                            <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <div>
                                                                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        {t.name}
                                                                        {t.isDark ? <Moon size={10} color="var(--text-muted)" /> : <Sun size={10} color="var(--warning)" />}
                                                                    </div>
                                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                                        <span style={{ background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: '4px', fontSize: '9px', textTransform: 'capitalize' }}>{t.category}</span>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); toggleFavoriteTheme(t.id); setFavIds(getFavoriteThemeIds()); }}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
                                                                    title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                                                                >
                                                                    <Star size={14} fill={isFav ? 'var(--warning)' : 'none'} color={isFav ? 'var(--warning)' : 'var(--text-muted)'} />
                                                                </button>
                                                            </div>
                                                            {isSelected && (
                                                                <div style={{ position: 'absolute', top: 6, right: 6, background: 'var(--accent-primary)', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <Check size={11} color="#000" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* All themes grid */}
                                {(() => {
                                    let filteredThemes: ThemeDefinition[];
                                    if (themeSearchQuery.trim()) {
                                        filteredThemes = searchThemes(themeSearchQuery);
                                        if (themeCategory !== 'all') {
                                            filteredThemes = filteredThemes.filter(t => t.category === themeCategory);
                                        }
                                    } else if (themeCategory !== 'all') {
                                        filteredThemes = getThemesByCategory(themeCategory);
                                    } else {
                                        filteredThemes = getAllThemesIncludingCustom();
                                    }

                                    if (filteredThemes.length === 0) {
                                        return (
                                            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                                                No themes found{themeSearchQuery ? ` for "${themeSearchQuery}"` : ''}.
                                            </div>
                                        );
                                    }

                                    return (
                                        <div style={{ marginBottom: '20px' }}>
                                            {(themeCategory === 'all' && !themeSearchQuery) && (
                                                <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '10px', letterSpacing: '0.05em' }}>
                                                    All Themes ({filteredThemes.length})
                                                </h4>
                                            )}
                                            <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                                {filteredThemes.map(t => {
                                                    const isSelected = theme === t.id;
                                                    const p = t.preview;
                                                    const isFav = favIds.includes(t.id);
                                                    return (
                                                        <div
                                                            key={t.id}
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => { haptic.themeSwitch(); setTheme(t.id as any); }}
                                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTheme(t.id as any); } }}
                                                            onMouseEnter={() => previewTheme(t.id)}
                                                            onMouseLeave={() => previewTheme(null)}
                                                            style={{
                                                                background: 'var(--bg-elevated)',
                                                                border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                                                borderRadius: '12px',
                                                                overflow: 'hidden',
                                                                cursor: 'pointer',
                                                                transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s',
                                                                boxShadow: isSelected ? '0 0 0 1px var(--accent-primary)' : 'none',
                                                                position: 'relative',
                                                            }}
                                                        >
                                                            {/* Item 16: Realistic ThemePreview */}
                                                            <div style={{ height: '72px', position: 'relative' }}>
                                                                <ThemePreview theme={t} colorMode={colorMode} style={{ height: '100%' }} />
                                                                {/* Item 18: Try it button */}
                                                                <button onClick={(e) => { e.stopPropagation(); previewTheme(t.id); (window as any).__gratoniteFullPreview = t.id; setFullPreviewId(t.id); window.dispatchEvent(new CustomEvent('gratonite:full-preview-changed')); }} style={{ position: 'absolute', bottom: 4, right: 4, padding: '2px 8px', borderRadius: '4px', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '9px', fontWeight: 700, cursor: 'pointer', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '3px' }}><Eye size={9} /> Try</button>
                                                            </div>
                                                            {/* Theme info — Item 19: metadata */}
                                                            <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <div style={{ minWidth: 0 }}>
                                                                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                                                                        {t.isDark ? <Moon size={10} color="var(--text-muted)" /> : <Sun size={10} color="var(--warning)" />}
                                                                    </div>
                                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                                        <span style={{ background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: '4px', fontSize: '9px', textTransform: 'capitalize' }}>{t.category}</span>
                                                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.accent, flexShrink: 0, border: '1px solid var(--stroke)' }} title={'Accent: ' + p.accent}></span>
                                                                    </div>
                                                                    {t.description && <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>}
                                                                </div>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); toggleFavoriteTheme(t.id); setFavIds(getFavoriteThemeIds()); }}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', flexShrink: 0 }}
                                                                    title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                                                                >
                                                                    <Star size={14} fill={isFav ? 'var(--warning)' : 'none'} color={isFav ? 'var(--warning)' : 'var(--text-muted)'} />
                                                                </button>
                                                            </div>
                                                            {isSelected && (
                                                                <div style={{ position: 'absolute', top: 6, right: 6, background: 'var(--accent-primary)', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <Check size={11} color="#000" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div style={{ marginBottom: '32px' }}></div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Typography</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '40px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>FONT FAMILY</label>
                                        <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value as any)} className="auth-input" style={{ width: '100%', padding: '12px', margin: 0 }}>
                                            <option value="inter">Inter (Clean & Modern)</option>
                                            <option value="outfit">Outfit (Geometric & Bold)</option>
                                            <option value="space-grotesk">Space Grotesk (Quirky)</option>
                                            <option value="fira-code">Fira Code (Developer)</option>
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>SIZE SCALE</label>
                                        <select value={fontSize} onChange={(e) => setFontSize(e.target.value as any)} className="auth-input" style={{ width: '100%', padding: '12px', margin: 0 }}>
                                            <option value="small">Small</option>
                                            <option value="medium">Medium</option>
                                            <option value="large">Large</option>
                                            <option value="extra-large">Extra Large</option>
                                        </select>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Code Block Theme</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '40px' }}>
                                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>SYNTAX HIGHLIGHTING</label>
                                    <select value={codeThemeId} onChange={(e) => { const id = e.target.value; setCodeThemeId(id); codeThemeSet(id as any); }} className="auth-input" style={{ width: '100%', maxWidth: '300px', padding: '12px', margin: 0 }}>
                                        {codeThemeOptions.map(t => (
                                            <option key={t.id} value={t.id}>{t.label}</option>
                                        ))}
                                    </select>
                                    <div style={{ marginTop: '8px', background: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--stroke)', maxWidth: '400px' }}>
                                        <pre className="code-block" style={{ margin: 0, padding: '12px', fontSize: '13px' }}>
                                            <code><span className="hljs-keyword">function</span> <span className="hljs-title function_">greet</span>(<span className="hljs-params">name</span>) {'{\n  '}<span className="hljs-keyword">return</span> <span className="hljs-string">{"`Hello, ${name}!`"}</span>{';\n}'}</code>
                                        </pre>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Ambient Features</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
                                    {[
                                        { label: 'Custom Channel Backgrounds', desc: 'Show unique backgrounds set by server admins.', val: showChannelBackgrounds, set: setShowChannelBackgrounds },
                                        { label: 'Play Moving Backgrounds', desc: 'Auto-play background videos and gifs. Disable to save battery or reduce motion.', val: playMovingBackgrounds, set: setPlayMovingBackgrounds },
                                    ].map(item => (
                                        <label key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>{item.label}</span>
                                                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.desc}</span>
                                            </div>
                                            <div onClick={() => { item.set(!item.val); playSound('click'); }} style={{ width: '40px', height: '24px', background: item.val ? 'var(--success)' : 'var(--bg-tertiary)', borderRadius: '12px', position: 'relative', transition: '0.2s', flexShrink: 0, cursor: 'pointer' }}>
                                                <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: item.val ? '19px' : '3px', transition: '0.2s' }}></div>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Message Display</h3>
                                <div style={{ display: 'flex', gap: '12px', marginBottom: '40px' }}>
                                    {([
                                        { value: false, label: 'Cozy', desc: 'Spacious layout with avatars' },
                                        { value: true, label: 'Compact', desc: 'Condensed, more messages visible' },
                                    ] as const).map(opt => {
                                        const isSelected = compactMode === opt.value;
                                        return (
                                            <label
                                                key={opt.label}
                                                onClick={() => setCompactMode(opt.value)}
                                                style={{
                                                    flex: 1,
                                                    background: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-elevated)',
                                                    padding: '16px',
                                                    borderRadius: '12px',
                                                    border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    transition: 'border-color 0.2s, background 0.2s',
                                                }}
                                            >
                                                <input
                                                    type="radio"
                                                    name="messageDisplay"
                                                    checked={isSelected}
                                                    onChange={() => setCompactMode(opt.value)}
                                                    style={{ accentColor: 'var(--accent-primary)' }}
                                                />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{opt.label}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{opt.desc}</div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Accent Color</h3>
                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
                                    {[
                                        { color: '#3b82f6', name: 'Blue' },
                                        { color: '#8b5cf6', name: 'Purple' },
                                        { color: '#ec4899', name: 'Pink' },
                                        { color: '#10b981', name: 'Green' },
                                        { color: '#f59e0b', name: 'Yellow' },
                                        { color: '#ef4444', name: 'Red' },
                                    ].map(accent => (
                                        <div key={accent.name} onClick={() => applyAccentColor(accent.color)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: accent.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: accentColor === accent.color ? `0 0 0 3px var(--bg-primary), 0 0 0 5px ${accent.color}` : 'none', transition: 'box-shadow 0.2s' }}>
                                                {accentColor === accent.color && <Check size={16} color="white" />}
                                            </div>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{accent.name}</span>
                                        </div>
                                    ))}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: customHex || 'var(--bg-tertiary)', border: '1px dashed var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>HEX</span>
                                            </div>
                                            <input
                                                type="text"
                                                className="auth-input"
                                                placeholder="#FFFFFF"
                                                value={customHex || accentColor}
                                                onChange={(e) => {
                                                    setCustomHex(e.target.value);
                                                    setHexError(false);
                                                    if (e.target.value.match(/^#[0-9A-Fa-f]{6}$/i)) {
                                                        applyAccentColor(e.target.value);
                                                    }
                                                }}
                                                onFocus={() => setHexError(false)}
                                                onBlur={() => {
                                                    const val = (customHex || '').trim();
                                                    const short = /^#[0-9A-Fa-f]{3}$/i;
                                                    const full = /^#[0-9A-Fa-f]{6}$/i;
                                                    if (full.test(val)) {
                                                        applyAccentColor(val);
                                                        setHexError(false);
                                                    } else if (short.test(val)) {
                                                        const expanded = '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3];
                                                        setCustomHex(expanded);
                                                        applyAccentColor(expanded);
                                                        setHexError(false);
                                                    } else if (val && val !== accentColor) {
                                                        setHexError(true);
                                                        setCustomHex('');
                                                    }
                                                }}
                                                style={{ width: '100px', height: '40px', marginBottom: 0, border: hexError ? '2px solid var(--error)' : undefined }}
                                            />
                                        </div>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Custom</span>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Button Shape</h3>
                                <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '40px' }}>
                                    {([
                                        { value: 'rounded' as ButtonShape, label: 'Rounded', radius: '8px' },
                                        { value: 'sharp' as ButtonShape, label: 'Sharp / Square', radius: '0px' },
                                        { value: 'pill' as ButtonShape, label: 'Pill', radius: '9999px' },
                                    ]).map(opt => {
                                        const isSelected = buttonShape === opt.value;
                                        return (
                                            <div
                                                key={opt.value}
                                                onClick={() => setButtonShape(opt.value)}
                                                style={{
                                                    background: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-elevated)',
                                                    padding: '16px',
                                                    borderRadius: '12px',
                                                    border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    transition: 'border-color 0.2s, background 0.2s',
                                                }}
                                            >
                                                {/* Preview illustration */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                                                    <div style={{ width: '100%', height: '28px', background: 'var(--accent-primary)', borderRadius: opt.radius, opacity: 0.85 }} />
                                                    <div style={{ width: '70%', height: '20px', background: 'var(--stroke)', borderRadius: opt.radius, opacity: 0.6 }} />
                                                </div>
                                                <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{opt.label}</span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Language</h3>
                                <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Globe size={18} style={{ color: 'var(--text-muted)' }} />
                                        <div>
                                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Display Language</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Choose the language for Gratonite's interface.</div>
                                        </div>
                                    </div>
                                    <select
                                        value={getLocale()}
                                        onChange={(e) => { setLocale(e.target.value as any); playSound('click'); }}
                                        className="auth-input"
                                        style={{ width: '160px', padding: '8px 12px', margin: 0 }}
                                    >
                                        {AVAILABLE_LOCALES.map(loc => (
                                            <option key={loc.code} value={loc.code}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Performance & Effects</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Glass Mode</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Adjust the intensity of background blur and transparency effects.</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: '8px' }}>
                                            {['off', 'subtle', 'full'].map(mode => (
                                                <button key={mode} onClick={() => { setGlassMode(mode as any); if (setUserTheme) setUserTheme({ ...userTheme, glassMode: mode }); }}
                                                    style={{ background: glassMode === mode ? 'var(--accent-primary)' : 'transparent', color: glassMode === mode ? '#000' : 'var(--text-secondary)', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                                                    {mode}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {[
                                        { label: 'Reduced UI Effects', desc: 'Disable hover animations, typing indicators, and particle effects.', val: reducedEffects, set: (v: boolean) => { setReducedEffects(v); if (setUserTheme) setUserTheme({ ...userTheme, reducedEffects: v }); } },
                                        { label: 'Low Power Mode', desc: 'Pause animated avatars, video backgrounds, and aggressive syncing.', val: lowPower, set: (v: boolean) => { setLowPower(v); if (setUserTheme) setUserTheme({ ...userTheme, lowPower: v }); } },
                                    ].map(item => (
                                        <div key={item.label} style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{item.label}</div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.desc}</div>
                                            </div>
                                            <div onClick={() => { item.set(!item.val); playSound('click'); }} style={{ width: '40px', height: '24px', background: item.val ? 'var(--accent-primary)' : 'var(--stroke)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s', flexShrink: 0 }}>
                                                <div style={{ position: 'absolute', height: '16px', width: '16px', left: item.val ? '20px' : '4px', bottom: '4px', backgroundColor: item.val ? '#000' : 'white', transition: '.4s', borderRadius: '50%' }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {activeTab === 'accessibility' && (
                            <>
                                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Accessibility</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Customize Gratonite to work best for you.</p>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Visuals & Contrast</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ fontWeight: 600 }}>High Contrast Mode</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Increases text contrast for better readability.</div>
                                        </div>
                                        <div role="switch" aria-checked={highContrast} aria-label="High Contrast Mode" tabIndex={0} onClick={() => { setHighContrast(!highContrast); playSound('click'); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setHighContrast(!highContrast); playSound('click'); } }} style={{ width: '40px', height: '24px', background: highContrast ? 'var(--accent-primary)' : 'var(--stroke)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s', flexShrink: 0 }}>
                                            <div style={{ position: 'absolute', height: '16px', width: '16px', left: highContrast ? '20px' : '4px', bottom: '4px', backgroundColor: highContrast ? '#000' : 'white', transition: '.4s', borderRadius: '50%' }}></div>
                                        </div>
                                    </div>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ fontWeight: 600 }}>Reduce Motion</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Minimizes animations and movement across the UI.</div>
                                        </div>
                                        <div role="switch" aria-checked={reducedEffects} aria-label="Reduce Motion" tabIndex={0} onClick={() => { setReducedEffects(!reducedEffects); playSound('click'); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setReducedEffects(!reducedEffects); playSound('click'); } }} style={{ width: '40px', height: '24px', background: reducedEffects ? 'var(--accent-primary)' : 'var(--stroke)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s', flexShrink: 0 }}>
                                            <div style={{ position: 'absolute', height: '16px', width: '16px', left: reducedEffects ? '20px' : '4px', bottom: '4px', backgroundColor: reducedEffects ? '#000' : 'white', transition: '.4s', borderRadius: '50%' }}></div>
                                        </div>
                                    </div>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                                            <div style={{ fontWeight: 600 }}>Color-Blind Mode</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Applies color filters and shape-based status indicators for color vision deficiencies.</div>
                                        </div>
                                        <select
                                            value={colorBlindMode}
                                            onChange={(e) => { setColorBlindMode(e.target.value as any); playSound('click'); }}
                                            aria-label="Color-Blind Mode"
                                            style={{ padding: '8px 12px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--stroke)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}
                                        >
                                            <option value="none">Off</option>
                                            <option value="deuteranopia">Deuteranopia (green-weak)</option>
                                            <option value="protanopia">Protanopia (red-weak)</option>
                                            <option value="tritanopia">Tritanopia (blue-weak)</option>
                                        </select>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Data & Performance</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ fontWeight: 600 }}>Low Data Mode</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Reduces bandwidth usage: lower-res images, disables GIF/video auto-play, defers embed loading.</div>
                                        </div>
                                        <div role="switch" aria-checked={lowDataMode} aria-label="Low Data Mode" tabIndex={0} onClick={() => { setLowDataMode(!lowDataMode); playSound('click'); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLowDataMode(!lowDataMode); playSound('click'); } }} style={{ width: '40px', height: '24px', background: lowDataMode ? 'var(--accent-primary)' : 'var(--stroke)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s', flexShrink: 0 }}>
                                            <div style={{ position: 'absolute', height: '16px', width: '16px', left: lowDataMode ? '20px' : '4px', bottom: '4px', backgroundColor: lowDataMode ? '#000' : 'white', transition: '.4s', borderRadius: '50%' }}></div>
                                        </div>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Navigation & Focus</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ fontWeight: 600 }}>Link Underlines</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Underlines all interactive text links for easier identification.</div>
                                        </div>
                                        <div role="switch" aria-checked={linkUnderlines} aria-label="Link Underlines" tabIndex={0} onClick={() => { setLinkUnderlines(!linkUnderlines); playSound('click'); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLinkUnderlines(!linkUnderlines); playSound('click'); } }} style={{ width: '40px', height: '24px', background: linkUnderlines ? 'var(--accent-primary)' : 'var(--stroke)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s', flexShrink: 0 }}>
                                            <div style={{ position: 'absolute', height: '16px', width: '16px', left: linkUnderlines ? '20px' : '4px', bottom: '4px', backgroundColor: linkUnderlines ? '#000' : 'white', transition: '.4s', borderRadius: '50%' }}></div>
                                        </div>
                                    </div>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ fontWeight: 600 }}>Focus Indicator Size</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Controls the thickness of the keyboard focus outline.</div>
                                        </div>
                                        <select value={focusIndicatorSize} onChange={(e) => { setFocusIndicatorSize(e.target.value as any); playSound('click'); }} aria-label="Focus indicator size" className="auth-input" style={{ width: 'auto', padding: '8px 12px', margin: 0, height: '36px' }}>
                                            <option value="normal">Normal (2px)</option>
                                            <option value="large">Large (4px)</option>
                                        </select>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Screen Reader</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ fontWeight: 600 }}>Screen Reader Mode</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Adds verbose labels, live regions, and route change announcements for assistive technology.</div>
                                        </div>
                                        <div role="switch" aria-checked={screenReaderMode} aria-label="Screen Reader Mode" tabIndex={0} onClick={() => { setScreenReaderMode(!screenReaderMode); playSound('click'); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setScreenReaderMode(!screenReaderMode); playSound('click'); } }} style={{ width: '40px', height: '24px', background: screenReaderMode ? 'var(--accent-primary)' : 'var(--stroke)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s', flexShrink: 0 }}>
                                            <div style={{ position: 'absolute', height: '16px', width: '16px', left: screenReaderMode ? '20px' : '4px', bottom: '4px', backgroundColor: screenReaderMode ? '#000' : 'white', transition: '.4s', borderRadius: '50%' }}></div>
                                        </div>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Text & Chat</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ fontWeight: 600 }}>Chat Font Size</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Changes the font size inside messages.</div>
                                        </div>
                                        <select value={fontSize} onChange={(e) => setFontSize(e.target.value as any)} aria-label="Chat font size" className="auth-input" style={{ width: 'auto', padding: '8px 12px', margin: 0, height: '36px' }}>
                                            <option value="small">Small</option>
                                            <option value="medium">Medium</option>
                                            <option value="large">Large</option>
                                            <option value="extra-large">Extra Large</option>
                                        </select>
                                    </div>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ fontWeight: 600 }}>Compact Message Mode</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Show messages in a denser, more compact layout.</div>
                                        </div>
                                        <div role="switch" aria-checked={compactMode} aria-label="Compact Message Mode" tabIndex={0} onClick={() => { setCompactMode(!compactMode); playSound('click'); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCompactMode(!compactMode); playSound('click'); } }} style={{ width: '40px', height: '24px', background: compactMode ? 'var(--accent-primary)' : 'var(--stroke)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s', flexShrink: 0 }}>
                                            <div style={{ position: 'absolute', height: '16px', width: '16px', left: compactMode ? '20px' : '4px', bottom: '4px', backgroundColor: compactMode ? '#000' : 'white', transition: '.4s', borderRadius: '50%' }}></div>
                                        </div>
                                    </div>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ fontWeight: 600 }}>Seasonal Effects</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Show seasonal particle effects (snowflakes, cherry blossoms, etc.).</div>
                                        </div>
                                        <div role="switch" aria-checked={seasonalEnabled} aria-label="Seasonal Effects" tabIndex={0} onClick={() => { const next = !seasonalEnabled; setSeasonalEnabled(next); localStorage.setItem('gratonite-seasonal-effects', next ? 'true' : 'false'); window.dispatchEvent(new Event('seasonal-effects-toggle')); playSound('click'); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const next = !seasonalEnabled; setSeasonalEnabled(next); localStorage.setItem('gratonite-seasonal-effects', next ? 'true' : 'false'); window.dispatchEvent(new Event('seasonal-effects-toggle')); playSound('click'); } }} style={{ width: '40px', height: '24px', background: seasonalEnabled ? 'var(--accent-primary)' : 'var(--stroke)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s', flexShrink: 0 }}>
                                            <div style={{ position: 'absolute', height: '16px', width: '16px', left: seasonalEnabled ? '20px' : '4px', bottom: '4px', backgroundColor: seasonalEnabled ? '#000' : 'white', transition: '.4s', borderRadius: '50%' }}></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Theme Import / Export */}
                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px', marginTop: '32px' }}>Import / Export</h3>
                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={() => {
                                            const themeData = {
                                                _format: 'gratonite-theme',
                                                _version: 1,
                                                theme,
                                                colorMode,
                                                fontFamily,
                                                fontSize,
                                                glassMode,
                                                buttonShape,
                                                accentColor,
                                                highContrast,
                                                compactMode,
                                                reducedEffects,
                                                lowPower,
                                                showChannelBackgrounds,
                                                playMovingBackgrounds,
                                                screenReaderMode,
                                                linkUnderlines,
                                                focusIndicatorSize,
                                                colorBlindMode,
                                            };
                                            const blob = new Blob([JSON.stringify(themeData, null, 2)], { type: 'application/json' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `gratonite-theme-${theme}.json`;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                            addToast({ title: 'Theme exported', variant: 'success' });
                                            playSound('click');
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                            borderRadius: '8px', padding: '10px 16px', color: 'var(--text-primary)',
                                            cursor: 'pointer', fontSize: '14px', fontWeight: 500,
                                        }}
                                        onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                    >
                                        <Download size={16} /> Export Theme
                                    </button>
                                    <button
                                        onClick={() => {
                                            const input = document.createElement('input');
                                            input.type = 'file';
                                            input.accept = '.json,.gratonite-theme';
                                            input.onchange = (ev) => {
                                                const file = (ev.target as HTMLInputElement).files?.[0];
                                                if (!file) return;
                                                const reader = new FileReader();
                                                reader.onload = () => {
                                                    try {
                                                        const data = JSON.parse(reader.result as string);
                                                        if (!data || typeof data !== 'object') throw new Error('Invalid file');
                                                        if (data.theme) setTheme(data.theme as AppTheme);
                                                        if (data.colorMode) setColorMode(data.colorMode as ColorMode);
                                                        if (data.fontFamily) setFontFamily(data.fontFamily as FontFamily);
                                                        if (data.fontSize) setFontSize(data.fontSize as FontSize);
                                                        if (data.glassMode) setGlassMode(data.glassMode as GlassMode);
                                                        if (data.buttonShape) setButtonShape(data.buttonShape as ButtonShape);
                                                        if (data.accentColor) setAccentColor(data.accentColor);
                                                        if (typeof data.highContrast === 'boolean') setHighContrast(data.highContrast);
                                                        if (typeof data.compactMode === 'boolean') setCompactMode(data.compactMode);
                                                        if (typeof data.reducedEffects === 'boolean') setReducedEffects(data.reducedEffects);
                                                        if (typeof data.lowPower === 'boolean') setLowPower(data.lowPower);
                                                        if (typeof data.showChannelBackgrounds === 'boolean') setShowChannelBackgrounds(data.showChannelBackgrounds);
                                                        if (typeof data.playMovingBackgrounds === 'boolean') setPlayMovingBackgrounds(data.playMovingBackgrounds);
                                                        if (typeof data.screenReaderMode === 'boolean') setScreenReaderMode(data.screenReaderMode);
                                                        if (typeof data.linkUnderlines === 'boolean') setLinkUnderlines(data.linkUnderlines);
                                                        if (data.focusIndicatorSize) setFocusIndicatorSize(data.focusIndicatorSize as FocusIndicatorSize);
                                                        if (data.colorBlindMode) setColorBlindMode(data.colorBlindMode as ColorBlindMode);
                                                        addToast({ title: 'Theme imported successfully', variant: 'success' });
                                                        playSound('click');
                                                    } catch {
                                                        addToast({ title: 'Invalid theme file', variant: 'error' });
                                                    }
                                                };
                                                reader.readAsText(file);
                                            };
                                            input.click();
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                                            borderRadius: '8px', padding: '10px 16px', color: 'var(--text-primary)',
                                            cursor: 'pointer', fontSize: '14px', fontWeight: 500,
                                        }}
                                        onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                    >
                                        <Upload size={16} /> Import Theme
                                    </button>
                                </div>
                            </>
                        )}

                        {activeTab === 'sound' && (
                            <>
                                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Sound</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Configure UI sounds, notifications, and ambient audio.</p>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Volume Controls</h3>
                                <div style={{ background: 'var(--bg-tertiary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--stroke)', marginBottom: '32px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Mute All Sounds</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Silence all UI sounds and notifications.</div>
                                        </div>
                                        <div
                                            onClick={() => {
                                                const next = !soundMuted;
                                                setSoundMutedState(next);
                                                setSoundMuted(next);
                                            }}
                                            style={{ width: '40px', height: '24px', background: soundMuted ? 'var(--bg-elevated)' : 'var(--success)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s', flexShrink: 0, border: soundMuted ? '1px solid var(--stroke)' : 'none' }}
                                        >
                                            <div style={{ position: 'absolute', height: '16px', width: '16px', left: soundMuted ? '20px' : '4px', bottom: '4px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%' }}></div>
                                        </div>
                                    </div>

                                    {/* Ambient Volume */}
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Ambient Volume</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>Controls background ambient sounds (lo-fi, nature, space).</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <VolumeX size={16} color="var(--text-muted)" />
                                            <input
                                                type="range" min="0" max="1" step="0.05"
                                                value={ambientVolume}
                                                onChange={(e) => {
                                                    const v = parseFloat(e.target.value);
                                                    setAmbientVolume(v);
                                                    localStorage.setItem('gratonite_ambient_volume', String(v));
                                                    window.dispatchEvent(new StorageEvent('storage', { key: 'gratonite_ambient_volume', newValue: String(v) }));
                                                }}
                                                style={{ flex: 1, accentColor: '#8b5cf6', height: '4px', cursor: 'pointer' }}
                                                disabled={soundMuted}
                                            />
                                            <Volume2 size={16} color="var(--text-muted)" />
                                            <span style={{ fontSize: '13px', color: 'var(--text-muted)', minWidth: '32px', textAlign: 'right' }}>{Math.round(ambientVolume * 100)}%</span>
                                        </div>
                                    </div>

                                    {/* Notification Volume */}
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Notification Volume</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>Controls message, mention, and join/leave sounds.</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <VolumeX size={16} color="var(--text-muted)" />
                                            <input
                                                type="range" min="0" max="1" step="0.05"
                                                value={notificationVolume}
                                                onChange={(e) => {
                                                    const v = parseFloat(e.target.value);
                                                    setNotificationVolume(v);
                                                    localStorage.setItem('gratonite_notification_volume', String(v));
                                                    window.dispatchEvent(new StorageEvent('storage', { key: 'gratonite_notification_volume', newValue: String(v) }));
                                                    // Also sync to the global sound volume for backward compatibility
                                                    setSoundVolumeState(v);
                                                    setSoundVolume(v);
                                                    saveSettingsToApi({ soundVolume: Math.round(v * 100) });
                                                }}
                                                style={{ flex: 1, accentColor: 'var(--accent-primary)', height: '4px', cursor: 'pointer' }}
                                                disabled={soundMuted}
                                            />
                                            <Volume2 size={16} color="var(--text-muted)" />
                                            <span style={{ fontSize: '13px', color: 'var(--text-muted)', minWidth: '32px', textAlign: 'right' }}>{Math.round(notificationVolume * 100)}%</span>
                                        </div>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Sound Pack</h3>
                                <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '32px' }}>
                                    {[
                                        { id: 'default', label: 'Default', desc: 'Clean modern tones', icon: '🎵' },
                                        { id: 'soft', label: 'Soft', desc: 'Gentle, quiet sounds', icon: '🌿' },
                                        { id: 'retro', label: 'Retro', desc: '8-bit chiptune vibes', icon: '👾' },
                                    ].map(pack => {
                                        const isSelected = soundPack === pack.id;
                                        return (
                                            <div
                                                key={pack.id}
                                                onClick={() => {
                                                    setSoundPackState(pack.id);
                                                    setSoundPack(pack.id);
                                                    if (!soundMuted) playSound('notification');
                                                }}
                                                style={{
                                                    background: isSelected ? 'rgba(82, 109, 245, 0.1)' : 'var(--bg-tertiary)',
                                                    border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                                    borderRadius: '12px',
                                                    padding: '20px 16px',
                                                    cursor: 'pointer',
                                                    textAlign: 'center',
                                                    transition: 'all 0.2s',
                                                    position: 'relative',
                                                }}
                                            >
                                                <div style={{ fontSize: '28px', marginBottom: '8px' }}>{pack.icon}</div>
                                                <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px', color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{pack.label}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{pack.desc}</div>
                                                {isSelected && (
                                                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'var(--accent-primary)', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Check size={11} color="#000" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Ambient Sound</h3>
                                <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
                                    {[
                                        { id: 'off', label: 'Off', desc: 'No ambient audio', color: 'var(--text-muted)' },
                                        { id: 'lofi', label: 'Lo-fi', desc: 'Warm chord pad', color: '#8b5cf6' },
                                        { id: 'nature', label: 'Nature', desc: 'Wind & birdsong', color: '#10b981' },
                                        { id: 'space', label: 'Space', desc: 'Deep space drone', color: '#526df5' },
                                    ].map(amb => {
                                        const isSelected = ambientMode === amb.id;
                                        return (
                                            <div
                                                key={amb.id}
                                                onClick={() => {
                                                    setAmbientMode(amb.id);
                                                    localStorage.setItem('gratonite_ambient_mode', amb.id);
                                                    window.dispatchEvent(new CustomEvent('ambient-mode-change', { detail: amb.id }));
                                                }}
                                                style={{
                                                    background: isSelected ? `${amb.color}15` : 'var(--bg-tertiary)',
                                                    border: `2px solid ${isSelected ? amb.color : 'var(--stroke)'}`,
                                                    borderRadius: '12px',
                                                    padding: '16px 10px',
                                                    cursor: 'pointer',
                                                    textAlign: 'center',
                                                    transition: 'all 0.2s',
                                                    position: 'relative',
                                                }}
                                            >
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: isSelected ? `${amb.color}25` : 'var(--bg-elevated)', border: `1.5px solid ${isSelected ? amb.color : 'var(--stroke)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', color: amb.color, fontSize: '14px' }}>
                                                    {amb.id === 'off' ? '✕' : amb.id === 'lofi' ? '♪' : amb.id === 'nature' ? '🍃' : '✦'}
                                                </div>
                                                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px', color: isSelected ? amb.color : 'var(--text-primary)' }}>{amb.label}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{amb.desc}</div>
                                                {isSelected && amb.id !== 'off' && (
                                                    <div style={{ position: 'absolute', top: 6, right: 6, background: amb.color, borderRadius: '50%', width: '8px', height: '8px', boxShadow: `0 0 8px ${amb.color}80` }}></div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Sound Events</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {[
                                        { label: 'Message Sent', desc: 'Play a sound when you send a message', key: 'messageSend' },
                                        { label: 'Notification', desc: 'Play a sound when you receive a notification', key: 'notification' },
                                        { label: 'Mention', desc: 'Alert sound when someone mentions you', key: 'mention' },
                                        { label: 'User Join/Leave', desc: 'Sounds for users entering or leaving voice channels', key: 'join' },
                                    ].map(ev => (
                                        <div key={ev.key} style={{ background: 'var(--bg-tertiary)', padding: '14px 16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '14px' }}>{ev.label}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{ev.desc}</div>
                                            </div>
                                            <button
                                                onClick={() => { if (!soundMuted) playSound(ev.key as any); }}
                                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', padding: '6px 12px', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                            >
                                                Preview ▶
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ height: '1px', background: 'var(--stroke)', margin: '32px 0' }} />

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Voice Processing</h3>
                                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--stroke)', overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Noise Suppression</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>Filters background noise from your microphone using Web Audio processing.</div>
                                        </div>
                                        <div
                                            onClick={() => {
                                                const next = !noiseSuppressionEnabled;
                                                setNoiseSuppressionEnabledState(next);
                                                try { localStorage.setItem('noiseSuppression', String(next)); } catch {}
                                            }}
                                            style={{
                                                width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer', flexShrink: 0,
                                                background: noiseSuppressionEnabled ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                                                border: `1px solid ${noiseSuppressionEnabled ? 'transparent' : 'var(--stroke)'}`,
                                                position: 'relative', transition: 'background 0.2s ease',
                                            }}
                                        >
                                            <div style={{
                                                width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                                                position: 'absolute', top: '2px', left: noiseSuppressionEnabled ? '22px' : '2px',
                                                transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                            }} />
                                        </div>
                                    </div>
                                </div>

                                {/* Email Notifications */}
                                <div style={{ height: '1px', background: 'var(--stroke)', margin: '24px 0' }} />
                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Email Notifications</h3>
                                <div style={{ background: 'var(--bg-tertiary)', padding: '20px', borderRadius: '12px', border: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={emailMentions} onChange={e => {
                                            setEmailMentions(e.target.checked);
                                            api.users.updateSettings({ emailNotifications: { mentions: e.target.checked, dms: emailDms, frequency: emailFrequency } }).catch(() => {});
                                        }} style={{ accentColor: 'var(--accent-primary)' }} />
                                        Email when mentioned while offline
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={emailDms} onChange={e => {
                                            setEmailDms(e.target.checked);
                                            api.users.updateSettings({ emailNotifications: { mentions: emailMentions, dms: e.target.checked, frequency: emailFrequency } }).catch(() => {});
                                        }} style={{ accentColor: 'var(--accent-primary)' }} />
                                        Email for DMs while offline
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                                        <span>Frequency:</span>
                                        <select
                                            value={emailFrequency}
                                            onChange={e => {
                                                const val = e.target.value as 'instant' | 'daily' | 'never';
                                                setEmailFrequency(val);
                                                api.users.updateSettings({ emailNotifications: { mentions: emailMentions, dms: emailDms, frequency: val } }).catch(() => {});
                                            }}
                                            style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}
                                        >
                                            <option value="instant">Instant</option>
                                            <option value="daily">Daily Digest</option>
                                            <option value="never">Never</option>
                                        </select>
                                    </div>
                                </div>
                            </>
                        )}
                        {activeTab === 'privacy' && <SettingsPrivacyTab addToast={addToast} userProfile={userProfile} onNavigateTab={(tab) => setActiveTab(tab as typeof activeTab)} />}
                        {activeTab === 'connections' && <SettingsConnectionsTab addToast={addToast} />}
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
        </>
    );
};

export default SettingsModal;
