import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, ZoomIn, ZoomOut, RotateCw, Volume2, VolumeX, Eye, EyeOff, Copy, Info, Link2 } from 'lucide-react';
import { useTheme, ButtonShape } from '../ui/ThemeProvider';
import { useToast } from '../ui/ToastManager';
import { useUser } from '../../contexts/UserContext';
import { isSoundMuted, setSoundMuted, getSoundVolume, setSoundVolume, getSoundPack, setSoundPack, playSound } from '../../utils/SoundManager';
import { api, API_BASE } from '../../lib/api';

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

        // Draw image
        const iw = imgEl.naturalWidth * zoom;
        const ih = imgEl.naturalHeight * zoom;
        ctx.drawImage(imgEl, offset.x - iw / 2, offset.y - ih / 2, iw, ih);

        // Dim outside crop
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.globalCompositeOperation = 'destination-out';
        if (aspect === 'circle') {
            ctx.beginPath();
            ctx.arc(CANVAS_W / 2, CANVAS_H / 2, CROP_W / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(CROP_X, CROP_Y, CROP_W, CROP_H);
        }
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
        if (!dragging) return;
        const dx = e.clientX - dragStart.current.mx;
        const dy = e.clientY - dragStart.current.my;
        setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
    };
    const onMouseUp = () => setDragging(false);

    const handleConfirm = () => {
        if (!imgEl) return;
        const out = document.createElement('canvas');
        out.width = CROP_W;
        out.height = CROP_H;
        const ctx = out.getContext('2d')!;
        if (aspect === 'circle') {
            ctx.beginPath();
            ctx.arc(CROP_W / 2, CROP_H / 2, CROP_W / 2, 0, Math.PI * 2);
            ctx.clip();
        }
        // The image is drawn on the preview canvas at:
        //   x = offset.x - iw/2,  y = offset.y - ih/2
        // The crop region starts at (CROP_X, CROP_Y) on the preview canvas.
        // So the image position relative to the crop region is:
        //   imgDrawX = (offset.x - iw/2) - CROP_X
        //   imgDrawY = (offset.y - ih/2) - CROP_Y
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
                />

                {/* Zoom slider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <ZoomOut size={16} color="var(--text-muted)" />
                    <input
                        type="range"
                        min={0.3}
                        max={3}
                        step={0.01}
                        value={zoom}
                        onChange={e => setZoom(parseFloat(e.target.value))}
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

// ─── Privacy Toggle Component ────────────────────────────────────────────────

const PrivacyToggle = ({ label, description, storageKey, defaultValue }: { label: string; description: string; storageKey: string; defaultValue: boolean }) => {
    const [enabled, setEnabled] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            return saved !== null ? saved === 'true' : defaultValue;
        } catch {
            return defaultValue;
        }
    });

    const toggle = () => {
        const next = !enabled;
        setEnabled(next);
        try { localStorage.setItem(storageKey, String(next)); } catch {}
    };

    return (
        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>{description}</div>
            </div>
            <div
                onClick={toggle}
                style={{
                    width: '44px', height: '24px', borderRadius: '12px', cursor: 'pointer',
                    background: enabled ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                    border: `1px solid ${enabled ? 'transparent' : 'var(--stroke)'}`,
                    position: 'relative', transition: 'background 0.2s ease', flexShrink: 0,
                }}
            >
                <div style={{
                    width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                    position: 'absolute', top: '2px', left: enabled ? '22px' : '2px',
                    transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
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
    userProfile?: any;
    setUserProfile?: any;
    userTheme?: any;
    setUserTheme?: any;
}) => {
    const [activeTab, setActiveTab] = useState<'account' | 'profile' | 'security' | 'sessions' | 'theme' | 'accessibility' | 'sound' | 'feedback' | 'privacy' | 'connections' | 'achievements' | 'stats' | 'wardrobe'>('account');
    const [feedbackCategory, setFeedbackCategory] = useState('general');
    const [feedbackBody, setFeedbackBody] = useState('');
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
    const [customHex, setCustomHex] = useState('');
    const [soundMuted, setSoundMutedState] = useState(isSoundMuted());
    const [soundVolume, setSoundVolumeState] = useState(getSoundVolume());
    const [soundPack, setSoundPackState] = useState(getSoundPack());
    const [noiseSuppressionEnabled, setNoiseSuppressionEnabledState] = useState(
        () => localStorage.getItem('noiseSuppression') === 'true',
    );
    const [ambientMode, setAmbientMode] = useState<string>(
        () => localStorage.getItem('gratonite_ambient_mode') ?? 'off'
    );
    const [nameplateStyle, setNameplateStyle] = useState<'none' | 'rainbow' | 'fire' | 'ice' | 'gold' | 'glitch'>(userProfile?.nameplateStyle || 'none');
    const [previewAvatarFrame, setPreviewAvatarFrame] = useState<'none' | 'neon' | 'gold' | 'glass'>(userProfile?.avatarFrame || 'none');
    const [bioValue, setBioValue] = useState(userProfile?.bio || '');
    const [bioSaving, setBioSaving] = useState(false);
    const [cropTarget, setCropTarget] = useState<'avatar' | 'banner' | null>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [joinedGuilds, setJoinedGuilds] = useState<Array<{ id: string; name: string; iconHash: string | null; memberCount: number; nickname?: string | null }>>([]);
    const [nicknameDrafts, setNicknameDrafts] = useState<Record<string, string>>({});
    const [savingNicknameForGuildId, setSavingNicknameForGuildId] = useState<string | null>(null);
    const [achievements, setAchievements] = useState<any[]>([]);
    const [userStats, setUserStats] = useState<any>(null);

    // Wardrobe tab state
    const [wardrobeItems, setWardrobeItems] = useState<any[]>([]);
    const [wardrobeCategory, setWardrobeCategory] = useState<string>('avatar_frame');
    const [wardrobePreviewFrame, setWardrobePreviewFrame] = useState<string>('none');
    const [wardrobePreviewFrameColor, setWardrobePreviewFrameColor] = useState<string | undefined>();
    const [wardrobePreviewNameplate, setWardrobePreviewNameplate] = useState<string>('none');
    const [wardrobeLoading, setWardrobeLoading] = useState(false);
    const [wardrobeSaving, setWardrobeSaving] = useState(false);
    const [wardrobeSelectedIds, setWardrobeSelectedIds] = useState<Record<string, string>>({}); // type -> itemId

    // Escape to close
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // Inline editing states for account fields
    const [editingField, setEditingField] = useState<'displayName' | 'username' | 'email' | null>(null);
    const { user: ctxUser, updateUser, refetchUser } = useUser();
    const [editDisplayName, setEditDisplayName] = useState('');
    const [editUsername, setEditUsername] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [tempEditValue, setTempEditValue] = useState('');

    // Populate edit fields from UserContext on mount / when user changes
    useEffect(() => {
        if (ctxUser.id) {
            setEditDisplayName(prev => prev || ctxUser.name);
            setEditUsername(prev => prev || ctxUser.handle);
            setEditEmail(prev => prev || ctxUser.email);
        }
    }, [ctxUser.id, ctxUser.name, ctxUser.handle, ctxUser.email]);

    // Change password state
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPw, setShowCurrentPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);

    // Delete account state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    // 2FA states
    const [authenticatorEnabled, setAuthenticatorEnabled] = useState(false);
    const [showAuthenticatorSetup, setShowAuthenticatorSetup] = useState(false);
    const [mfaLoading, setMfaLoading] = useState(false);
    const [mfaQrCodeUrl, setMfaQrCodeUrl] = useState('');
    const [mfaSecret, setMfaSecret] = useState('');
    const [mfaVerifyCode, setMfaVerifyCode] = useState('');
    const [mfaDisableCode, setMfaDisableCode] = useState('');
    const [showMfaDisableDialog, setShowMfaDisableDialog] = useState(false);
    const [smsEnabled, setSmsEnabled] = useState(false);
    const [showSmsSetup, setShowSmsSetup] = useState(false);
    const [smsCode, setSmsCode] = useState('');
    const [showBackupCodes, setShowBackupCodes] = useState(false);
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [backupCodesLoading, setBackupCodesLoading] = useState(false);
    const [backupCodesVerifyCode, setBackupCodesVerifyCode] = useState('');
    const [showBackupCodesVerify, setShowBackupCodesVerify] = useState(false);

    // Connections tab state
    const PROVIDERS = ['github', 'twitch', 'steam', 'twitter', 'youtube'] as const;
    type Provider = typeof PROVIDERS[number];
    const [connectionUsernames, setConnectionUsernames] = useState<Record<Provider, string>>({
        github: '', twitch: '', steam: '', twitter: '', youtube: '',
    });
    const [connectionProfileUrls, setConnectionProfileUrls] = useState<Record<Provider, string>>({
        github: '', twitch: '', steam: '', twitter: '', youtube: '',
    });
    const [connectionSaving, setConnectionSaving] = useState<Provider | null>(null);
    const [connectionRemoving, setConnectionRemoving] = useState<Provider | null>(null);

    useEffect(() => {
        if (activeTab !== 'connections') return;
        fetch(`${API_BASE}/users/@me/connections`, {
            credentials: 'include',
            headers: { Authorization: `Bearer ${localStorage.getItem('gratonite_access_token') ?? ''}` },
        })
            .then(r => r.ok ? r.json() : [])
            .then((rows: any[]) => {
                if (!Array.isArray(rows)) return;
                const usernames: Record<string, string> = {};
                const profileUrls: Record<string, string> = {};
                rows.forEach((r: any) => {
                    usernames[r.provider] = r.providerUsername ?? '';
                    profileUrls[r.provider] = r.profileUrl ?? '';
                });
                setConnectionUsernames(prev => ({ ...prev, ...usernames }) as Record<Provider, string>);
                setConnectionProfileUrls(prev => ({ ...prev, ...profileUrls }) as Record<Provider, string>);
            })
            .catch(() => {});
    }, [activeTab]);

    // Fetch wardrobe inventory
    useEffect(() => {
        if (activeTab !== 'wardrobe') return;
        setWardrobeLoading(true);
        api.inventory.get().then((data: any) => {
            const items = data.items ?? [];
            setWardrobeItems(items);
            // Pre-select currently equipped items
            const selected: Record<string, string> = {};
            for (const item of items) {
                if (item.equipped) selected[item.type] = item.itemId;
            }
            setWardrobeSelectedIds(selected);
            const equippedFrame = items.find((i: any) => i.type === 'avatar_frame' && i.equipped);
            const equippedNameplate = items.find((i: any) => i.type === 'nameplate' && i.equipped);
            if (equippedFrame) {
                const cfg = (equippedFrame.assetConfig ?? {}) as Record<string, unknown>;
                setWardrobePreviewFrame((cfg.frameStyle as string) ?? 'neon');
                setWardrobePreviewFrameColor(cfg.glowColor as string | undefined);
            }
            if (equippedNameplate) {
                const cfg = (equippedNameplate.assetConfig ?? {}) as Record<string, unknown>;
                setWardrobePreviewNameplate((cfg.nameplateStyle as string) ?? 'none');
            }
        }).catch(() => {}).finally(() => setWardrobeLoading(false));
    }, [activeTab]);

    // Fetch achievements and stats
    useEffect(() => {
        if (activeTab !== 'achievements' && activeTab !== 'stats') return;
        const token = localStorage.getItem('gratonite_access_token') ?? '';
        fetch(`${API_BASE}/users/@me/achievements`, {
            credentials: 'include',
            headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.ok ? r.json() : []).then((data: any[]) => { if (Array.isArray(data)) setAchievements(data); }).catch(() => {});
        fetch(`${API_BASE}/users/@me/stats`, {
            credentials: 'include',
            headers: { Authorization: `Bearer ${token}` },
        }).then(r => r.ok ? r.json() : null).then((data: any) => { if (data) setUserStats(data); }).catch(() => {});
    }, [activeTab]);

    const saveConnection = async (provider: Provider) => {
        const username = connectionUsernames[provider];
        if (!username.trim()) return;
        setConnectionSaving(provider);
        try {
            await fetch(`${API_BASE}/users/@me/connections`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('gratonite_access_token') ?? ''}`,
                },
                body: JSON.stringify({
                    provider,
                    providerUsername: username.trim(),
                    profileUrl: connectionProfileUrls[provider].trim() || undefined,
                }),
            });
            addToast({ title: `${provider} connected`, variant: 'success' });
        } catch {
            addToast({ title: `Failed to save ${provider}`, variant: 'error' });
        } finally {
            setConnectionSaving(null);
        }
    };

    const removeConnection = async (provider: Provider) => {
        setConnectionRemoving(provider);
        try {
            await fetch(`${API_BASE}/users/@me/connections/${provider}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: { Authorization: `Bearer ${localStorage.getItem('gratonite_access_token') ?? ''}` },
            });
            setConnectionUsernames(prev => ({ ...prev, [provider]: '' }));
            setConnectionProfileUrls(prev => ({ ...prev, [provider]: '' }));
            addToast({ title: `${provider} removed`, variant: 'success' });
        } catch {
            addToast({ title: `Failed to remove ${provider}`, variant: 'error' });
        } finally {
            setConnectionRemoving(null);
        }
    };

    const PROVIDER_LABELS: Record<Provider, string> = {
        github: 'GitHub',
        twitch: 'Twitch',
        steam: 'Steam',
        twitter: 'Twitter / X',
        youtube: 'YouTube',
    };

    const [showServerOverrideInfo, setShowServerOverrideInfo] = useState(false);

    useEffect(() => {
        setNameplateStyle(userProfile?.nameplateStyle || 'none');
        setPreviewAvatarFrame(userProfile?.avatarFrame || 'none');
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

    const { theme, setTheme, colorMode, setColorMode, fontFamily, setFontFamily, fontSize, setFontSize, showChannelBackgrounds, setShowChannelBackgrounds, playMovingBackgrounds, setPlayMovingBackgrounds, glassMode, setGlassMode, reducedEffects, setReducedEffects, lowPower, setLowPower, accentColor, setAccentColor, highContrast, setHighContrast, compactMode, setCompactMode, buttonShape, setButtonShape } = useTheme();
    const { addToast } = useToast();

    useEffect(() => {
        if (activeTab !== 'profile') return;
        let cancelled = false;
        api.guilds.getMine()
            .then((rows: any[]) => {
                if (cancelled) return;
                const normalized = (Array.isArray(rows) ? rows : []).map((g: any) => ({
                    id: g.id,
                    name: g.name,
                    iconHash: g.iconHash ?? null,
                    memberCount: typeof g.memberCount === 'number' ? g.memberCount : 0,
                    nickname: g.nickname ?? '',
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
    useEffect(() => {
        if (settingsLoadedRef.current) return;
        settingsLoadedRef.current = true;
        api.users.getSettings().then((s: any) => {
            if (s?.theme) setTheme(s.theme);
            if (s?.colorMode) setColorMode(s.colorMode);
            if (s?.fontFamily) setFontFamily(s.fontFamily);
            if (s?.fontSize) setFontSize(s.fontSize);
            if (s?.glassMode !== undefined) setGlassMode(s.glassMode);
            if (s?.buttonShape) setButtonShape(s.buttonShape);
            if (s?.highContrast !== undefined) setHighContrast(s.highContrast);
            if (s?.compactMode !== undefined) setCompactMode(s.compactMode);
            if (s?.accentColor) setAccentColor(s.accentColor);
            if (s?.reducedMotion !== undefined) setReducedEffects(s.reducedMotion);
            if (s?.lowPower !== undefined) setLowPower(s.lowPower);
            if (s?.soundVolume !== undefined) {
                setSoundVolumeState(s.soundVolume);
                setSoundVolume(s.soundVolume);
            }
        }).catch(() => { /* settings may not exist yet */ });

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
        saveSettingsToApi({ theme, colorMode, fontFamily, fontSize, glassMode, buttonShape, highContrast, compactMode, accentColor, reducedMotion: reducedEffects, lowPower });
    }, [theme, colorMode, fontFamily, fontSize, glassMode, buttonShape, highContrast, compactMode, accentColor, reducedEffects, lowPower, saveSettingsToApi]);

    const persistedAvatarUrl = ctxUser.avatarHash ? `${API_BASE}/files/${ctxUser.avatarHash}` : null;
    const persistedBannerUrl = ctxUser.bannerHash ? `${API_BASE}/files/${ctxUser.bannerHash}` : null;
    const avatarStyle = persistedAvatarUrl ? `url(${persistedAvatarUrl})` : (userProfile?.avatarStyle || 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))');
    const avatarFrame = previewAvatarFrame;
    const bannerStyle = persistedBannerUrl ? `url(${persistedBannerUrl})` : (userProfile?.bannerStyle || 'var(--accent-purple)');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    const applyGlobalAvatarFrame = (frame: 'none' | 'neon' | 'gold' | 'glass') => {
        setPreviewAvatarFrame(frame);
        if (setUserProfile) {
            setUserProfile((prev: any) => ({ ...prev, avatarFrame: frame }));
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
            setUserProfile((prev: any) => ({ ...prev, nameplateStyle: style }));
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
        } catch (err: any) {
            addToast({ title: 'Failed to update server nickname', description: err?.message || 'Unknown error', variant: 'error' });
        } finally {
            setSavingNicknameForGuildId(null);
        }
    };

    return (
        <>
            <div className="modal-overlay">
                <div className="settings-modal flex-row glass-panel" style={{ width: 'min(960px, 90vw)', height: 'min(680px, 85vh)', padding: 0, overflow: 'hidden' }}>
                    {/* Left Sidebar */}
                    <div style={{ width: '220px', background: 'var(--bg-elevated)', padding: '32px 16px', borderRight: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div>
                            <div className="sidebar-section-label">ACCOUNT</div>
                            <div className={`sidebar-nav-item ${activeTab === 'account' ? 'active' : ''}`} onClick={() => setActiveTab('account')}>My Account</div>
                            <div className={`sidebar-nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Profile</div>
                            <div className={`sidebar-nav-item ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => setActiveTab('sessions')}>Sessions</div>
                            <div className={`sidebar-nav-item ${activeTab === 'privacy' ? 'active' : ''}`} onClick={() => setActiveTab('privacy')}>Privacy &amp; Safety</div>
                            <div className={`sidebar-nav-item ${activeTab === 'connections' ? 'active' : ''}`} onClick={() => setActiveTab('connections')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Link2 size={14} />Connections</div>
                            <div className={`sidebar-nav-item ${activeTab === 'achievements' ? 'active' : ''}`} onClick={() => setActiveTab('achievements')}>🏆 Achievements</div>
                            <div className={`sidebar-nav-item ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>📊 Stats</div>
                            <div className={`sidebar-nav-item ${activeTab === 'wardrobe' ? 'active' : ''}`} onClick={() => setActiveTab('wardrobe')}>👗 Wardrobe</div>
                        </div>
                        <div>
                            <div className="sidebar-section-label">APPEARANCE</div>
                            <div className={`sidebar-nav-item ${activeTab === 'theme' ? 'active' : ''}`} onClick={() => setActiveTab('theme')}>Theme</div>
                            <div className={`sidebar-nav-item ${activeTab === 'sound' ? 'active' : ''}`} onClick={() => setActiveTab('sound')}>Sound</div>
                            <div className={`sidebar-nav-item ${activeTab === 'accessibility' ? 'active' : ''}`} onClick={() => setActiveTab('accessibility')}>Accessibility</div>
                        </div>
                        <div>
                            <div className="sidebar-section-label">SUPPORT</div>
                            <div className={`sidebar-nav-item ${activeTab === 'feedback' ? 'active' : ''}`} onClick={() => setActiveTab('feedback')}>Send Feedback</div>
                        </div>
                    </div>

                    {/* Right Panel */}
                    <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', position: 'relative' }}>
                        <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <X size={24} />
                        </button>

                        {activeTab === 'account' && (
                            <>
                                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>My Account</h2>

                                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid var(--stroke)', marginBottom: '32px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
                                        <div style={{
                                            width: '80px', height: '80px', borderRadius: '50%',
                                            background: avatarStyle, backgroundSize: 'cover', backgroundPosition: 'center',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold'
                                        }}>
                                            {avatarStyle.includes('gradient') ? (editDisplayName?.[0]?.toUpperCase() || '?') : ''}
                                        </div>
                                        <button className="auth-button" onClick={() => setActiveTab('profile')} style={{ marginTop: 0, width: 'auto', padding: '0 16px', height: '36px', background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}>Edit User Profile</button>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {/* Display Name */}
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>DISPLAY NAME</div>
                                                    {editingField !== 'displayName' && <div style={{ fontSize: '15px' }}>{editDisplayName}</div>}
                                                </div>
                                                {editingField !== 'displayName' && (
                                                    <button onClick={() => { setEditingField('displayName'); setTempEditValue(editDisplayName); }} style={{ background: 'var(--accent-primary)', border: 'none', padding: '6px 16px', borderRadius: 'var(--radius-sm)', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Edit</button>
                                                )}
                                            </div>
                                            {editingField === 'displayName' && (
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                    <input
                                                        type="text"
                                                        value={tempEditValue}
                                                        onChange={e => setTempEditValue(e.target.value)}
                                                        autoFocus
                                                        style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                                                    />
                                                    <button onClick={() => { api.users.updateAccountBasics({ displayName: tempEditValue }).then(() => { setEditDisplayName(tempEditValue); updateUser({ name: tempEditValue }); setEditingField(null); addToast({ title: 'Display Name Updated', description: `Display name changed to "${tempEditValue}".`, variant: 'success' }); }).catch(() => addToast({ title: 'Failed to update display name', variant: 'error' })); }} style={{ background: 'var(--accent-primary)', border: 'none', padding: '8px 16px', borderRadius: 'var(--radius-sm)', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Save</button>
                                                    <button onClick={() => setEditingField(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Cancel</button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Username */}
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>USERNAME</div>
                                                    {editingField !== 'username' && <div style={{ fontSize: '15px' }}>{editUsername}</div>}
                                                </div>
                                                {editingField !== 'username' && (
                                                    <button onClick={() => { setEditingField('username'); setTempEditValue(editUsername); }} style={{ background: 'var(--accent-primary)', border: 'none', padding: '6px 16px', borderRadius: 'var(--radius-sm)', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Edit</button>
                                                )}
                                            </div>
                                            {editingField === 'username' && (
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                    <input
                                                        type="text"
                                                        value={tempEditValue}
                                                        onChange={e => setTempEditValue(e.target.value)}
                                                        autoFocus
                                                        style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                                                    />
                                                    <button onClick={() => { api.users.updateAccountBasics({ username: tempEditValue }).then(() => { setEditUsername(tempEditValue); updateUser({ handle: tempEditValue }); setEditingField(null); addToast({ title: 'Username Updated', description: `Username changed to "${tempEditValue}".`, variant: 'success' }); }).catch((e: any) => addToast({ title: 'Failed to update username', description: e?.message || 'Unknown error', variant: 'error' })); }} style={{ background: 'var(--accent-primary)', border: 'none', padding: '8px 16px', borderRadius: 'var(--radius-sm)', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Save</button>
                                                    <button onClick={() => setEditingField(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Cancel</button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Email */}
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '4px' }}>EMAIL</div>
                                                    {editingField !== 'email' && <div style={{ fontSize: '15px' }}>{editEmail}</div>}
                                                </div>
                                                {editingField !== 'email' && (
                                                    <button onClick={() => { setEditingField('email'); setTempEditValue(editEmail); }} style={{ background: 'var(--accent-primary)', border: 'none', padding: '6px 16px', borderRadius: 'var(--radius-sm)', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Edit</button>
                                                )}
                                            </div>
                                            {editingField === 'email' && (
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                    <input
                                                        type="email"
                                                        value={tempEditValue}
                                                        onChange={e => setTempEditValue(e.target.value)}
                                                        autoFocus
                                                        style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}
                                                    />
                                                    <button onClick={() => { api.users.updateAccountBasics({ email: tempEditValue }).then(() => { setEditEmail(tempEditValue); updateUser({ email: tempEditValue.toLowerCase() }); setEditingField(null); addToast({ title: 'Email Updated', description: 'Email saved. Please re-verify this address if required.', variant: 'success' }); }).catch((e: any) => addToast({ title: 'Failed to update email', description: e?.message || 'Unknown error', variant: 'error' })); }} style={{ background: 'var(--accent-primary)', border: 'none', padding: '8px 16px', borderRadius: 'var(--radius-sm)', color: '#000', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Save</button>
                                                    <button onClick={() => setEditingField(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '8px 16px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Cancel</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Password & Authentication</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '48px' }}>
                                    {!showPasswordForm ? (
                                        <button onClick={() => setShowPasswordForm(true)} className="auth-button" style={{ marginTop: 0, background: 'var(--accent-primary)', width: 'fit-content', padding: '0 24px' }}>Change Password</button>
                                    ) : (
                                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '20px', border: '1px solid var(--stroke)' }}>
                                            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px' }}>Change Password</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                <div>
                                                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>CURRENT PASSWORD</label>
                                                    <div style={{ position: 'relative' }}>
                                                        <input type={showCurrentPw ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" style={{ width: '100%', padding: '8px 36px 8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                                                        <button onClick={() => setShowCurrentPw(!showCurrentPw)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>{showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>NEW PASSWORD</label>
                                                    <div style={{ position: 'relative' }}>
                                                        <input type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" style={{ width: '100%', padding: '8px 36px 8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                                                        <button onClick={() => setShowNewPw(!showNewPw)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>{showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>CONFIRM NEW PASSWORD</label>
                                                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-primary)', border: `1px solid ${confirmPassword && confirmPassword !== newPassword ? 'var(--error)' : 'var(--stroke)'}`, borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                                                    {confirmPassword && confirmPassword !== newPassword && <div style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>Passwords do not match</div>}
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                    <button
                                                        onClick={() => {
                                                            if (currentPassword && newPassword && newPassword === confirmPassword) {
                                                                api.users.changePassword(currentPassword, newPassword).then(() => {
                                                                    setShowPasswordForm(false);
                                                                    setCurrentPassword('');
                                                                    setNewPassword('');
                                                                    setConfirmPassword('');
                                                                    addToast({ title: 'Password Changed', description: 'Your password has been updated successfully.', variant: 'success' });
                                                                }).catch((e: any) => addToast({ title: 'Failed to change password', description: e?.message || 'Check your current password', variant: 'error' }));
                                                            }
                                                        }}
                                                        disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}
                                                        style={{ background: currentPassword && newPassword && newPassword === confirmPassword ? 'var(--accent-primary)' : 'var(--bg-elevated)', border: 'none', padding: '8px 20px', borderRadius: 'var(--radius-sm)', color: currentPassword && newPassword && newPassword === confirmPassword ? '#000' : 'var(--text-muted)', cursor: currentPassword && newPassword && newPassword === confirmPassword ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '13px' }}
                                                    >Save</button>
                                                    <button onClick={() => { setShowPasswordForm(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', padding: '8px 20px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Cancel</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <button className="auth-button" onClick={() => setActiveTab('security')} style={{ marginTop: 0, background: 'var(--bg-tertiary)', color: 'white', border: '1px solid var(--stroke)', width: 'fit-content', padding: '0 24px' }}>Enable Two-Factor Auth</button>
                                </div>

                                <div style={{ paddingLeft: '16px', borderLeft: '4px solid var(--error)' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--error)', marginBottom: '8px' }}>Danger Zone</h3>
                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Permanently delete your account and all data.</p>
                                    {!showDeleteConfirm ? (
                                        <button onClick={() => setShowDeleteConfirm(true)} className="auth-button" style={{ marginTop: 0, background: 'transparent', border: '1px solid var(--error)', color: 'var(--error)', width: 'fit-content', padding: '0 24px' }}>Delete Account</button>
                                    ) : (
                                        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid var(--error)', borderRadius: 'var(--radius-md)', padding: '20px', marginTop: '8px' }}>
                                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--error)', marginBottom: '8px' }}>Are you absolutely sure?</div>
                                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>This action cannot be undone. This will permanently delete your account, messages, and remove all your data from our servers.</p>
                                            <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>Type DELETE to confirm</label>
                                            <input
                                                type="text"
                                                value={deleteConfirmText}
                                                onChange={e => setDeleteConfirmText(e.target.value)}
                                                placeholder="DELETE"
                                                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' }}
                                            />
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => {
                                                        if (deleteConfirmText === 'DELETE') {
                                                            api.users.deleteAccount('').then(() => {
                                                                setShowDeleteConfirm(false);
                                                                setDeleteConfirmText('');
                                                                addToast({ title: 'Account Deleted', description: 'Your account has been scheduled for deletion.', variant: 'success' });
                                                                window.location.href = '/login';
                                                            }).catch((e: any) => addToast({ title: 'Failed to delete account', description: e?.message || 'Unknown error', variant: 'error' }));
                                                        }
                                                    }}
                                                    disabled={deleteConfirmText !== 'DELETE'}
                                                    style={{ background: deleteConfirmText === 'DELETE' ? 'var(--error)' : 'var(--bg-elevated)', border: 'none', padding: '8px 20px', borderRadius: 'var(--radius-sm)', color: deleteConfirmText === 'DELETE' ? 'white' : 'var(--text-muted)', cursor: deleteConfirmText === 'DELETE' ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '13px' }}
                                                >Delete My Account</button>
                                                <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '8px 20px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>Cancel</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
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
                                                        } catch (err: any) {
                                                            addToast({ title: 'MFA Setup Failed', description: err?.message || 'Could not start MFA setup.', variant: 'error' });
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
                                                            } catch (err: any) {
                                                                addToast({ title: 'Failed to Disable', description: err?.message || 'Invalid code. Please try again.', variant: 'error' });
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
                                                                }
                                                                addToast({ title: 'Authenticator Enabled', description: '2FA via authenticator app is now active.', variant: 'success' });
                                                            } catch (err: any) {
                                                                addToast({ title: 'Verification Failed', description: err?.message || 'Invalid code. Please try again.', variant: 'error' });
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
                                                            } catch (err: any) {
                                                                addToast({ title: 'Failed', description: err?.message || 'Invalid code. Please try again.', variant: 'error' });
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
                                                    { id: 'glass', label: 'Frosted Glass' }
                                                ].map(frame => (
                                                    <button
                                                        key={frame.id}
                                                        onClick={() => applyGlobalAvatarFrame(frame.id as 'none' | 'neon' | 'gold' | 'glass')}
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
                                                        backdropFilter: 'blur(10px)',
                                                        background: 'rgba(255,255,255,0.1)',
                                                        borderColor: 'rgba(255,255,255,0.2)'
                                                    } : {})
                                                }}>
                                                    {avatarStyle.includes('gradient') || avatarFrame === 'glass' ? (userProfile?.name?.[0]?.toUpperCase() || '?') : ''}
                                                    <div style={{ position: 'absolute', bottom: 2, right: 2, width: '18px', height: '18px', background: 'var(--bg-elevated)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <div style={{ width: '12px', height: '12px', background: 'var(--success)', borderRadius: '50%' }}></div>
                                                    </div>
                                                </div>
                                                <h2 className={nameplateStyle !== 'none' ? `nameplate-${nameplateStyle}` : ''} style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '2px', letterSpacing: '-0.02em' }}>{userProfile?.name || 'User'}</h2>
                                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>{userProfile?.handle || ''}</p>

                                                <div style={{ height: '1px', background: 'var(--stroke)', marginBottom: '14px' }}></div>

                                                {/* About Me section */}
                                                <div style={{ marginBottom: '14px' }}>
                                                    <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.05em' }}>About Me</h4>
                                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{userProfile?.bio || 'No bio set.'}</p>
                                                </div>

                                                {/* Member Since */}
                                                <div>
                                                    <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.05em' }}>Member Since</h4>
                                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Feb 28, 2026</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTab === 'sessions' && (() => {
                            const getDeviceInfo = () => {
                                const ua = navigator.userAgent;
                                let browser = 'Unknown Browser';
                                let os = 'Unknown OS';
                                if (ua.includes('Chrome')) browser = 'Chrome';
                                else if (ua.includes('Firefox')) browser = 'Firefox';
                                else if (ua.includes('Safari')) browser = 'Safari';
                                if (ua.includes('Mac')) os = 'macOS';
                                else if (ua.includes('Windows')) os = 'Windows';
                                else if (ua.includes('Linux')) os = 'Linux';
                                return `${os} \u2022 ${browser}`;
                            };
                            return (
                            <>
                                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Active Sessions</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>This is your current active session.</p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ width: '40px', height: '40px', background: 'var(--bg-elevated)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>{getDeviceInfo()} <span style={{ background: 'var(--success)', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', textTransform: 'uppercase' }}>Current</span></div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Last active: Now</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                            );
                        })()}

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

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Theme Base</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '32px' }}>
                                    {[
                                        {
                                            id: 'default', label: 'Default', desc: 'Clean & modern',
                                            preview: { bg: '#0f172a', sidebar: '#1e293b', accent: '#3b82f6', text: '#94a3b8', msg1: '#2d3748', msg2: '#1e293b' }
                                        },
                                        {
                                            id: 'neobrutalism', label: 'NeoBrutalism', desc: 'Bold & loud',
                                            preview: { bg: '#fef3c7', sidebar: '#fbbf24', accent: '#000000', text: '#1c1c1c', msg1: '#ffffff', msg2: '#e5e7eb' }
                                        },
                                        {
                                            id: 'glass', label: 'Glass UI', desc: 'Frosted & ethereal',
                                            preview: { bg: '#0a0a1a', sidebar: 'rgba(255,255,255,0.05)', accent: '#8b5cf6', text: 'rgba(255,255,255,0.6)', msg1: 'rgba(255,255,255,0.08)', msg2: 'rgba(255,255,255,0.04)' }
                                        },
                                        {
                                            id: 'synthwave', label: 'Synthwave', desc: 'Retro neon future',
                                            preview: { bg: '#0d0221', sidebar: '#1a0533', accent: '#f72585', text: '#b5179e', msg1: '#240046', msg2: '#10002b' }
                                        },
                                        {
                                            id: 'memphis', label: 'Memphis', desc: 'Playful geometry',
                                            preview: { bg: '#fff5f5', sidebar: '#ffe0e0', accent: '#ff4d6d', text: '#555', msg1: '#fff0f3', msg2: '#ffe8ec' }
                                        },
                                        {
                                            id: 'y2k', label: 'Y2K Chrome', desc: 'Shiny millennium',
                                            preview: { bg: '#e8eaf6', sidebar: '#c5cae9', accent: '#5c6bc0', text: '#3949ab', msg1: '#ede7f6', msg2: '#d1c4e9' }
                                        },
                                    ].map(t => {
                                        const isSelected = theme === t.id;
                                        const p = t.preview;
                                        return (
                                            <div
                                                key={t.id}
                                                onClick={() => setTheme(t.id as any)}
                                                style={{
                                                    background: 'var(--bg-elevated)',
                                                    border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                                    borderRadius: '12px',
                                                    overflow: 'hidden',
                                                    cursor: 'pointer',
                                                    transition: 'border-color 0.2s, box-shadow 0.2s',
                                                    boxShadow: isSelected ? '0 0 0 1px var(--accent-primary)' : 'none',
                                                    position: 'relative',
                                                }}
                                            >
                                                {/* Mini preview */}
                                                <div style={{ height: '72px', background: p.bg, display: 'flex', gap: '4px', padding: '6px' }}>
                                                    <div style={{ width: '22px', background: p.sidebar, borderRadius: '4px', flexShrink: 0 }}></div>
                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                        <div style={{ height: '8px', width: '50%', background: p.accent, borderRadius: '3px' }}></div>
                                                        <div style={{ height: '6px', width: '80%', background: p.msg1, borderRadius: '3px' }}></div>
                                                        <div style={{ height: '6px', width: '60%', background: p.msg2, borderRadius: '3px' }}></div>
                                                        <div style={{ height: '6px', width: '70%', background: p.msg1, borderRadius: '3px', marginTop: '2px' }}></div>
                                                    </div>
                                                </div>
                                                {/* Label */}
                                                <div style={{ padding: '8px 10px' }}>
                                                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{t.label}</div>
                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t.desc}</div>
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
                                                    if (e.target.value.match(/^#[0-9A-Fa-f]{6}$/i)) {
                                                        applyAccentColor(e.target.value);
                                                    }
                                                }}
                                                style={{ width: '100px', height: '40px', marginBottom: 0 }}
                                            />
                                        </div>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Custom</span>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Button Shape</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '40px' }}>
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
                                        <div onClick={() => { setHighContrast(!highContrast); playSound('click'); }} style={{ width: '40px', height: '24px', background: highContrast ? 'var(--accent-primary)' : 'var(--stroke)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s', flexShrink: 0 }}>
                                            <div style={{ position: 'absolute', height: '16px', width: '16px', left: highContrast ? '20px' : '4px', bottom: '4px', backgroundColor: highContrast ? '#000' : 'white', transition: '.4s', borderRadius: '50%' }}></div>
                                        </div>
                                    </div>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ fontWeight: 600 }}>Reduce Motion</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Minimizes animations and movement across the UI.</div>
                                        </div>
                                        <div onClick={() => { setReducedEffects(!reducedEffects); playSound('click'); }} style={{ width: '40px', height: '24px', background: reducedEffects ? 'var(--accent-primary)' : 'var(--stroke)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s', flexShrink: 0 }}>
                                            <div style={{ position: 'absolute', height: '16px', width: '16px', left: reducedEffects ? '20px' : '4px', bottom: '4px', backgroundColor: reducedEffects ? '#000' : 'white', transition: '.4s', borderRadius: '50%' }}></div>
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
                                        <select value={fontSize} onChange={(e) => setFontSize(e.target.value as any)} className="auth-input" style={{ width: 'auto', padding: '8px 12px', margin: 0, height: '36px' }}>
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
                                        <div onClick={() => { setCompactMode(!compactMode); playSound('click'); }} style={{ width: '40px', height: '24px', background: compactMode ? 'var(--accent-primary)' : 'var(--stroke)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s', flexShrink: 0 }}>
                                            <div style={{ position: 'absolute', height: '16px', width: '16px', left: compactMode ? '20px' : '4px', bottom: '4px', backgroundColor: compactMode ? '#000' : 'white', transition: '.4s', borderRadius: '50%' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTab === 'sound' && (
                            <>
                                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Sound</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Configure UI sounds, notifications, and ambient audio.</p>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Master Volume</h3>
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
                                            style={{ width: '40px', height: '24px', background: soundMuted ? 'var(--error)' : 'var(--success)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s', flexShrink: 0 }}
                                        >
                                            <div style={{ position: 'absolute', height: '16px', width: '16px', left: soundMuted ? '20px' : '4px', bottom: '4px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%' }}></div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <VolumeX size={16} color="var(--text-muted)" />
                                        <input
                                            type="range" min="0" max="1" step="0.05"
                                            value={soundVolume}
                                            onChange={(e) => {
                                                const v = parseFloat(e.target.value);
                                                setSoundVolumeState(v);
                                                setSoundVolume(v);
                                                saveSettingsToApi({ soundVolume: v });
                                            }}
                                            style={{ flex: 1, accentColor: 'var(--accent-primary)', height: '4px', cursor: 'pointer' }}
                                            disabled={soundMuted}
                                        />
                                        <Volume2 size={16} color="var(--text-muted)" />
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)', minWidth: '32px', textAlign: 'right' }}>{Math.round(soundVolume * 100)}%</span>
                                    </div>
                                </div>

                                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Sound Pack</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '32px' }}>
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
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
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
                                        <input type="checkbox" defaultChecked={false} onChange={e => {
                                            api.users.updateSettings({ emailNotifications: { mentions: e.target.checked } }).catch(() => {});
                                        }} style={{ accentColor: 'var(--accent-primary)' }} />
                                        Email when mentioned while offline
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                        <input type="checkbox" defaultChecked={false} onChange={e => {
                                            api.users.updateSettings({ emailNotifications: { dms: e.target.checked } }).catch(() => {});
                                        }} style={{ accentColor: 'var(--accent-primary)' }} />
                                        Email for DMs while offline
                                    </label>
                                </div>
                            </>
                        )}
                        {activeTab === 'privacy' && (
                            <>
                                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Privacy &amp; Safety</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Control who can contact you and how messages are filtered.</p>

                                {/* DM & Message Requests */}
                                <div style={{ marginBottom: '32px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Direct Messages</h3>

                                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', overflow: 'hidden' }}>
                                        <PrivacyToggle
                                            label="Filter message requests"
                                            description="Automatically filter DMs from people you don't know into Message Requests. Suspected spam will be moved to a separate Spam folder."
                                            storageKey="privacy-filter-message-requests"
                                            defaultValue={true}
                                        />
                                        <div style={{ height: '1px', background: 'var(--stroke)' }} />
                                        <PrivacyToggle
                                            label="Allow DMs from server members"
                                            description="Allow direct messages from people in your shared servers. When disabled, only friends can DM you directly."
                                            storageKey="privacy-allow-server-dms"
                                            defaultValue={true}
                                        />
                                        <div style={{ height: '1px', background: 'var(--stroke)' }} />
                                        <PrivacyToggle
                                            label="Allow DMs from everyone"
                                            description="When enabled, anyone on Gratonite can send you a direct message. When disabled, only friends and server members (if allowed above) can message you."
                                            storageKey="privacy-allow-all-dms"
                                            defaultValue={false}
                                        />
                                    </div>
                                </div>

                                {/* Server-specific DM settings */}
                                <div style={{ marginBottom: '32px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Server Privacy Defaults</h3>

                                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', overflow: 'hidden' }}>
                                        <PrivacyToggle
                                            label="Allow DMs from new server members"
                                            description="When you join a new server, allow members of that server to send you direct messages. You can override this per-server in server settings."
                                            storageKey="privacy-new-server-dms"
                                            defaultValue={true}
                                        />
                                    </div>
                                </div>

                                {/* Content filtering */}
                                <div style={{ marginBottom: '32px' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Safe Messaging</h3>

                                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--stroke)', overflow: 'hidden' }}>
                                        <PrivacyToggle
                                            label="Scan messages from everyone"
                                            description="Automatically scan and filter direct messages from all users for explicit or harmful content."
                                            storageKey="privacy-scan-all-messages"
                                            defaultValue={true}
                                        />
                                        <div style={{ height: '1px', background: 'var(--stroke)' }} />
                                        <PrivacyToggle
                                            label="Block suspicious links"
                                            description="Automatically detect and block messages containing known phishing or malicious links."
                                            storageKey="privacy-block-suspicious-links"
                                            defaultValue={true}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                        {activeTab === 'connections' && (
                            <>
                                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Connected Accounts</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Link your third-party accounts to display them on your profile.</p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {PROVIDERS.map((provider) => (
                                        <div key={provider} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                                <Link2 size={16} color="var(--accent-primary)" />
                                                <span style={{ fontWeight: 600, fontSize: '14px' }}>{PROVIDER_LABELS[provider]}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input
                                                    type="text"
                                                    placeholder={`Your ${PROVIDER_LABELS[provider]} username`}
                                                    value={connectionUsernames[provider]}
                                                    onChange={e => setConnectionUsernames(prev => ({ ...prev, [provider]: e.target.value }))}
                                                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}
                                                />
                                                <button
                                                    onClick={() => saveConnection(provider)}
                                                    disabled={connectionSaving === provider || !connectionUsernames[provider].trim()}
                                                    style={{
                                                        padding: '8px 16px', borderRadius: '8px', border: 'none', fontWeight: 600, fontSize: '13px',
                                                        background: 'var(--accent-primary)', color: '#000', cursor: 'pointer', whiteSpace: 'nowrap',
                                                        opacity: (!connectionUsernames[provider].trim() || connectionSaving === provider) ? 0.6 : 1,
                                                    }}
                                                >
                                                    {connectionSaving === provider ? 'Saving...' : 'Save'}
                                                </button>
                                                {connectionUsernames[provider] && (
                                                    <button
                                                        onClick={() => removeConnection(provider)}
                                                        disabled={connectionRemoving === provider}
                                                        style={{
                                                            padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--stroke)', fontWeight: 600, fontSize: '13px',
                                                            background: 'var(--bg-elevated)', color: 'var(--error)', cursor: 'pointer',
                                                        }}
                                                    >
                                                        {connectionRemoving === provider ? '...' : 'Remove'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                        {activeTab === 'feedback' && (
                            <>
                                <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Send Feedback</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Help us improve Gratonite by sharing your thoughts, reporting bugs, or suggesting features.</p>

                                {feedbackSubmitted ? (
                                    <div style={{ textAlign: 'center', padding: '48px 0' }}>
                                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                            <Check size={32} color="#10b981" />
                                        </div>
                                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Feedback Sent!</h3>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>Thank you for helping us improve Gratonite.</p>
                                        <button onClick={() => { setFeedbackSubmitted(false); setFeedbackBody(''); setFeedbackCategory('general'); }} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                                            Send More Feedback
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <div>
                                            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Category</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                                                {[
                                                    { id: 'general', label: 'General' },
                                                    { id: 'bug', label: 'Bug Report' },
                                                    { id: 'feature', label: 'Feature Request' },
                                                    { id: 'ux', label: 'UX Issue' },
                                                ].map(cat => (
                                                    <button key={cat.id} onClick={() => setFeedbackCategory(cat.id)} style={{
                                                        padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                                                        background: feedbackCategory === cat.id ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                                        color: feedbackCategory === cat.id ? '#000' : 'var(--text-secondary)',
                                                        border: `1px solid ${feedbackCategory === cat.id ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                                    }}>{cat.label}</button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Your Feedback</label>
                                            <textarea
                                                value={feedbackBody}
                                                onChange={e => setFeedbackBody(e.target.value)}
                                                placeholder="Describe your feedback, bug, or suggestion in detail..."
                                                style={{ width: '100%', height: '140px', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', resize: 'none', fontFamily: 'inherit' }}
                                            />
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>{feedbackBody.length}/1000</div>
                                        </div>

                                        <button
                                            onClick={async () => {
                                                if (!feedbackBody.trim()) return;
                                                try {
                                                    await api.bugReports.create({
                                                        title: feedbackCategory === 'bug' ? 'Bug Report' : feedbackCategory === 'feature' ? 'Feature Request' : feedbackCategory === 'ux' ? 'UX Issue' : 'General Feedback',
                                                        summary: feedbackBody.trim(),
                                                        route: window.location.pathname,
                                                        pageUrl: window.location.href,
                                                        viewport: `${window.innerWidth}x${window.innerHeight}`,
                                                        userAgent: navigator.userAgent,
                                                        clientTimestamp: new Date().toISOString(),
                                                        metadata: { category: feedbackCategory },
                                                    });
                                                    setFeedbackSubmitted(true);
                                                    addToast({ title: 'Feedback Sent', description: 'Your feedback has been submitted. Thank you!', variant: 'success' });
                                                } catch {
                                                    addToast({ title: 'Error', description: 'Failed to submit feedback. Please try again.', variant: 'error' });
                                                }
                                            }}
                                            disabled={!feedbackBody.trim()}
                                            style={{
                                                padding: '12px 24px', borderRadius: '8px', border: 'none', fontWeight: 700, fontSize: '14px', cursor: feedbackBody.trim() ? 'pointer' : 'not-allowed',
                                                background: feedbackBody.trim() ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                                color: feedbackBody.trim() ? '#000' : 'var(--text-muted)',
                                                alignSelf: 'flex-start',
                                            }}
                                        >
                                            Submit Feedback
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                        {activeTab === 'achievements' && (
                            <div style={{ padding: '0 40px' }}>
                                <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Achievements</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
                                    {achievements.filter(a => a.earned).length} / {achievements.length} earned
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                                    {achievements.map((a: any) => (
                                        <div key={a.id} style={{
                                            padding: '16px',
                                            background: a.earned ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                            border: `1px solid ${a.earned ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                            opacity: a.earned ? 1 : 0.5,
                                            display: 'flex', flexDirection: 'column', gap: '8px',
                                        }}>
                                            <div style={{ fontSize: '24px' }}>
                                                {a.earned ? '🏆' : '🔒'}
                                            </div>
                                            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{a.name}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{a.description}</div>
                                            {a.earned && <div style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600 }}>+{a.points} pts</div>}
                                        </div>
                                    ))}
                                    {achievements.length === 0 && (
                                        <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                                            Loading achievements...
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'wardrobe' && (() => {
                            const wardrobeCats = [
                                { key: 'avatar_frame', label: 'Frames' },
                                { key: 'nameplate', label: 'Nameplates' },
                                { key: 'profile_effect', label: 'Effects' },
                                { key: 'decoration', label: 'Decorations' },
                            ];
                            const categoryItems = wardrobeItems.filter((i: any) => i.type === wardrobeCategory);
                            const handleWardrobeSelect = (item: any) => {
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
                                        const item = wardrobeItems.find((i: any) => i.itemId === itemId && i.type === type);
                                        if (!item) continue;
                                        const res = item.source === 'shop'
                                            ? await api.shop.equipItem(itemId)
                                            : await api.cosmetics.equipCosmetic(itemId);
                                        const cfg = (res?.assetConfig ?? item.assetConfig ?? {}) as Record<string, unknown>;
                                        if (type === 'avatar_frame') applyGlobalAvatarFrame((cfg.frameStyle as 'none' | 'neon' | 'gold' | 'glass') ?? 'neon');
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
                                                    {categoryItems.map((item: any) => {
                                                        const isSelected = wardrobeSelectedIds[item.type] === item.itemId;
                                                        const rarityColors: Record<string, string> = { common: '#9ca3af', uncommon: '#22c55e', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b' };
                                                        const rColor = rarityColors[item.rarity] ?? '#9ca3af';
                                                        return (
                                                            <div key={item.id} onClick={() => handleWardrobeSelect(item)} style={{
                                                                padding: '10px 8px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center',
                                                                background: isSelected ? 'rgba(82, 109, 245, 0.12)' : 'var(--bg-tertiary)',
                                                                border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                                                                transition: 'all 0.15s ease',
                                                            }}>
                                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: item.imageUrl ?? 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))', margin: '0 auto 6px', border: `2px solid ${rColor}` }} />
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
                                                    <div style={{
                                                        width: '72px', height: '72px', borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '28px',
                                                        boxShadow: wardrobePreviewFrame === 'neon'
                                                            ? `0 0 14px ${wardrobePreviewFrameColor ?? '#38bdf8'}`
                                                            : wardrobePreviewFrame === 'gold'
                                                                ? '0 0 0 2px #f59e0b, 0 0 10px rgba(245,158,11,0.5)'
                                                                : 'none',
                                                        border: wardrobePreviewFrame === 'glass' ? '2px solid rgba(255,255,255,0.35)' : 'none',
                                                    }}>
                                                        {userProfile?.name?.[0]?.toUpperCase() || '?'}
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

                        {activeTab === 'stats' && (
                            <div style={{ padding: '0 40px' }}>
                                <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>Your Stats</h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>Activity overview</p>
                                {userStats ? (
                                    <>
                                        {/* XP Progress bar */}
                                        <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--accent-primary)' }}>Level {userStats.level}</span>
                                                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{userStats.xp} / {userStats.xpToNextLevel} XP</span>
                                            </div>
                                            <div style={{ background: 'var(--bg-tertiary)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                                                <div style={{
                                                    height: '100%', borderRadius: '4px', background: 'var(--accent-primary)',
                                                    width: `${Math.min(100, ((userStats.xp - userStats.xpForCurrentLevel) / (userStats.xpToNextLevel - userStats.xpForCurrentLevel)) * 100)}%`,
                                                    transition: 'width 0.5s ease',
                                                }} />
                                            </div>
                                        </div>
                                        {/* Stats grid */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                                            {[
                                                { label: '🔥 Current Streak', value: `${userStats.currentStreak} days` },
                                                { label: '🏆 Best Streak', value: `${userStats.longestStreak} days` },
                                                { label: '🪙 Coins', value: userStats.coins },
                                                { label: '⭐ Achievements', value: userStats.achievementsEarned },
                                                { label: '🔖 Bookmarks', value: userStats.bookmarks },
                                            ].map(stat => (
                                                <div key={stat.label} style={{
                                                    padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                                                    border: '1px solid var(--stroke)', textAlign: 'center',
                                                }}>
                                                    <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '4px' }}>{stat.value}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{stat.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>Loading stats...</div>
                                )}
                            </div>
                        )}
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
        </>
    );
};

export default SettingsModal;
