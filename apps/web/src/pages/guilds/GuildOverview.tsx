import { useEffect, useMemo, useState } from 'react';
import { Hash as HashIcon, Mic, Users, Zap, Calendar, ArrowLeft, X } from 'lucide-react';
import { useOutletContext, Link, useParams, useNavigate } from 'react-router-dom';
import { api, API_BASE, getAccessToken } from '../../lib/api';
import { useUser } from '../../contexts/UserContext';
import { getDeterministicGradient } from '../../utils/colors';
import { onVoiceStateUpdate, type VoiceStateUpdatePayload } from '../../lib/socket';
import type { GuildSessionChannel, GuildSessionInfo, GuildSessionErrorCode } from '../../hooks/useGuildSession';
import GuildWelcomeModal from '../../components/modals/GuildWelcomeModal';
import { useIsMobile } from '../../hooks/useIsMobile';
import Skeleton from '../../components/ui/Skeleton';
import { PortalThemeProvider } from '../../portal/themes/PortalThemeProvider';
import { Portal, type PortalTask } from '../../portal/Portal';

interface GuildData {
    id: string;
    name: string;
    ownerId: string;
    description: string | null;
    iconHash: string | null;
    bannerHash: string | null;
    memberCount: number;
    createdAt: string;
}

interface ChannelData {
    id: string;
    name: string;
    type: string;
    parentId: string | null;
    position: number;
    topic: string | null;
}

type GuildOverviewContext = {
    setActiveModal: (modal: 'invite' | 'guildSettings' | 'memberOptions' | null) => void;
    guildSession?: {
        guildInfo: GuildSessionInfo | null;
        channels: GuildSessionChannel[];
        loading: boolean;
        errorCode: GuildSessionErrorCode;
        enabled: boolean;
    };
};

const GuildOverview = () => {
    const { setActiveModal, guildSession } = useOutletContext<GuildOverviewContext>();
    const { guildId } = useParams<{ guildId: string }>();
    const navigate = useNavigate();
    const { user: currentUser } = useUser();
    const isMobile = useIsMobile();
    const [legacyGuild, setLegacyGuild] = useState<GuildData | null>(null);
    const [legacyChannels, setLegacyChannels] = useState<ChannelData[]>([]);
    const [legacyLoading, setLegacyLoading] = useState(false);
    const [voiceParticipants, setVoiceParticipants] = useState<Record<string, number>>({});
    const [iconImgError, setIconImgError] = useState(false);
    const [ownerUser, setOwnerUser] = useState<{ id: string; username: string; displayName: string | null } | null>(null);
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const [onboardingData, setOnboardingData] = useState<{ welcomeMessage: string | null; rulesChannelId: string | null } | null>(null);
    
    const guild = (guildSession?.enabled ? guildSession.guildInfo : legacyGuild) as GuildData | null;
    const channels = (guildSession?.enabled ? guildSession.channels : legacyChannels) as ChannelData[];
    const loading = guildSession?.enabled ? (guildSession.loading ?? false) : legacyLoading;
    const errorCode = guildSession?.enabled ? (guildSession.errorCode ?? null) : null;
    const guildFetchEnabled = guildSession?.enabled ?? true;

    // Fetch onboarding status and show welcome modal if not completed
    useEffect(() => {
        if (!guildId) return;
        // Check "don't show again" dismissal
        try {
            const dismissed = JSON.parse(localStorage.getItem('gratonite-welcome-dismissed') || '{}');
            if (dismissed[guildId]) return;
        } catch { /* ignore */ }
        // Check if welcome screen is enabled for this guild
        try {
            const wcRaw = localStorage.getItem('gratonite-welcome-config');
            if (wcRaw) {
                const wcAll = JSON.parse(wcRaw);
                if (wcAll[`${guildId}_enabled`] === false) return;
            }
        } catch { /* ignore */ }
        void fetch(`${API_BASE}/guilds/${guildId}/onboarding`, {
            credentials: 'include',
            headers: {
                Authorization: `Bearer ${getAccessToken() ?? ''}`,
            },
        })
            .then(r => r.ok ? r.json() : null)
            .then((data: { completed: boolean; welcomeMessage: string | null; rulesChannelId: string | null } | null) => {
                if (data && !data.completed && data.welcomeMessage) {
                    setOnboardingData({ welcomeMessage: data.welcomeMessage, rulesChannelId: data.rulesChannelId });
                    setShowWelcomeModal(true);
                }
            })
            .catch(() => {});
    }, [guildId]);

    // Fetch guild owner info
    useEffect(() => {
        if (!guild?.ownerId) return;
        api.users.get(guild.ownerId).then((u: any) => setOwnerUser({ id: u.id, username: u.username, displayName: u.displayName })).catch(() => {});
    }, [guild?.ownerId]);

    useEffect(() => {
        if (guildFetchEnabled || !guildId) return;
        setLegacyLoading(true);
        void api.guilds.get(guildId)
            .then((g) => setLegacyGuild(g as GuildData))
            .catch(() => setLegacyGuild(null))
            .finally(() => setLegacyLoading(false));
        void api.channels.getGuildChannels(guildId)
            .then((chs) => setLegacyChannels(chs as ChannelData[]))
            .catch(() => setLegacyChannels([]));
    }, [guildFetchEnabled, guildId]);

    // Fetch voice states for all voice channels
    useEffect(() => {
        if (!guildId || channels.length === 0) return;

        const voiceChannelIds = channels
            .filter(c => c.type === 'voice' || c.type === 'GUILD_VOICE' || c.type === 'stage' || c.type === 'GUILD_STAGE_VOICE')
            .map(c => c.id);

        // Fetch voice states for each voice channel
        const fetchVoiceStates = async () => {
            const counts: Record<string, number> = {};
            
            await Promise.all(
                voiceChannelIds.map(async (channelId) => {
                    try {
                        const states = await api.voice.getChannelStates(channelId);
                        counts[channelId] = Array.isArray(states) ? states.length : 0;
                    } catch {
                        counts[channelId] = 0;
                    }
                })
            );

            setVoiceParticipants(counts);
        };

        void fetchVoiceStates();
    }, [guildId, channels]);

    // Subscribe to voice state updates
    useEffect(() => {
        if (!guildId) return;

        const unsubscribe = onVoiceStateUpdate((data: VoiceStateUpdatePayload) => {
            // Update participant count for the channel
            setVoiceParticipants(prev => {
                const current = prev[data.channelId] || 0;
                const newCount = data.type === 'join' ? current + 1 : Math.max(0, current - 1);
                return { ...prev, [data.channelId]: newCount };
            });
        });

        return () => { unsubscribe(); };
    }, [guildId]);

    const textChannels = channels.filter(c => c.type !== 'category' && c.type !== 'GUILD_CATEGORY' && c.type !== 'voice' && c.type !== 'GUILD_VOICE' && c.type !== 'stage' && c.type !== 'GUILD_STAGE_VOICE');
    const voiceChannels = channels.filter(c => c.type === 'voice' || c.type === 'GUILD_VOICE' || c.type === 'stage' || c.type === 'GUILD_STAGE_VOICE');
    const isOwner = guild?.ownerId === currentUser.id;
    const openPortalSettings = () => setActiveModal('guildSettings');
    const setupChecklist = [
        {
            id: 'identity',
            label: 'Add an icon and description so people know what this portal is for.',
            hint: 'A clear icon, short description, and welcome note do most of the work for first impressions.',
            done: Boolean(guild?.iconHash && guild?.description),
            actionLabel: 'Open settings',
            onAction: openPortalSettings,
        },
        {
            id: 'text',
            label: 'Create at least one text channel for conversation.',
            hint: 'Start with a simple chat channel and one forum or help space before you branch out.',
            done: textChannels.length > 0,
            actionLabel: 'Add channels',
            onAction: openPortalSettings,
        },
        {
            id: 'voice',
            label: 'Create at least one voice channel for drop-ins.',
            hint: 'One open hangout room is enough for launch. You can add events or stage rooms later.',
            done: voiceChannels.length > 0,
            actionLabel: 'Add voice room',
            onAction: openPortalSettings,
        },
        {
            id: 'invite',
            label: 'Invite your first people so the space stops feeling empty.',
            hint: 'Send invites only after the basics are ready so newcomers land somewhere that already feels welcoming.',
            done: (guild?.memberCount ?? 0) > 1,
            actionLabel: 'Create invite',
            onAction: () => setActiveModal('invite'),
        },
    ];
    const completedSetupCount = setupChecklist.filter((item) => item.done).length;
    const portalCompletionPercent = setupChecklist.length
        ? Math.round((completedSetupCount / setupChecklist.length) * 100)
        : 0;
    const setupComplete = portalCompletionPercent === 100;
    const [setupDismissed, setSetupDismissed] = useState<boolean>(() => {
        if (!guildId) return false;
        try {
            const raw = JSON.parse(localStorage.getItem('gratonite-portal-setup-dismissed') || '{}');
            return Boolean(raw[guildId]);
        } catch { return false; }
    });
    // Auto-dismiss when fully complete so a one-off regression doesn't pop the
    // whole onboarding back unprompted.
    useEffect(() => {
        if (!guildId || !setupComplete || setupDismissed) return;
        try {
            const raw = JSON.parse(localStorage.getItem('gratonite-portal-setup-dismissed') || '{}');
            raw[guildId] = true;
            localStorage.setItem('gratonite-portal-setup-dismissed', JSON.stringify(raw));
        } catch { /* ignore */ }
        setSetupDismissed(true);
    }, [guildId, setupComplete, setupDismissed]);
    const showSetupQuests = !setupComplete && !setupDismissed;
    const portalTasks: PortalTask[] = useMemo(
        () =>
            setupChecklist.map((item) => ({
                id: item.id,
                label: item.label,
                description: item.hint,
                completed: item.done,
            })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [setupChecklist.map((s) => `${s.id}:${s.done}`).join('|')],
    );
    const portalTaskActions = useMemo(() => {
        const map: Record<string, () => void> = {};
        for (const item of setupChecklist) map[item.id] = item.onAction;
        return map;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setupChecklist.map((s) => s.id).join('|')]);
    const nextSetupStep = setupChecklist.find((item) => !item.done);
    const ownerLaunchTips = [
        'Pin one welcome thread or forum prompt so the first visitors know exactly where to speak.',
        'Keep your first launch small: a general chat, one help or topic channel, and one voice room is enough.',
        'After a few people join, watch which channels stay quiet and archive the extras before the layout sprawls.',
    ];

    const guildName = guild?.name || 'Loading...';
    const guildInitial = guildName.charAt(0).toUpperCase();
    const createdDate = guild?.createdAt ? new Date(guild.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';

    const bannerUrl = guild?.bannerHash ? `${API_BASE}/files/${guild.bannerHash}` : null;
    const isBannerVideo = bannerUrl?.endsWith('.mp4') || bannerUrl?.endsWith('.webm');
    const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });
    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    if (guildFetchEnabled && errorCode === 'FORBIDDEN') {
        return (
            <div className="main-content-wrapper" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
                <div style={{ maxWidth: '520px', width: '100%', background: 'var(--bg-elevated)', border: 'var(--border-structural, 3px solid #000)', borderRadius: 'var(--radius-lg, 0)', boxShadow: 'var(--shadow-panel, 8px 8px 0 #000)', padding: '24px', display: 'grid', gap: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-display)' }}>You no longer have access to this portal</h2>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Your membership may have changed or the invite expired.</p>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button className="auth-button" style={{ margin: 0 }} onClick={() => navigate('/')}>Back to Home</button>
                        <button className="auth-button" style={{ margin: 0, background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} onClick={() => setActiveModal('invite')}>Open Invite</button>
                    </div>
                </div>
            </div>
        );
    }

    if (guildFetchEnabled && errorCode === 'NOT_FOUND') {
        return (
            <div className="main-content-wrapper" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
                <div style={{ maxWidth: '520px', width: '100%', background: 'var(--bg-elevated)', border: 'var(--border-structural, 3px solid #000)', borderRadius: 'var(--radius-lg, 0)', boxShadow: 'var(--shadow-panel, 8px 8px 0 #000)', padding: '24px', display: 'grid', gap: '16px' }}>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-display)' }}>Portal not found or deleted</h2>
                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>This portal may have been removed or the URL is no longer valid.</p>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button className="auth-button" style={{ margin: 0 }} onClick={() => navigate('/')}>Back to Home</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <PortalThemeProvider guildId={guildId ?? ''}>
        <div className="guild-homescreen">
            {showWelcomeModal && guild && onboardingData && onboardingData.welcomeMessage && (
                <GuildWelcomeModal
                    guildId={guild.id}
                    guildName={guild.name}
                    memberCount={guild.memberCount}
                    iconHash={guild.iconHash}
                    bannerHash={guild.bannerHash}
                    welcomeMessage={onboardingData.welcomeMessage}
                    rulesChannelId={onboardingData.rulesChannelId}
                    onClose={() => setShowWelcomeModal(false)}
                />
            )}
            {loading && !guild && (
                <div className="guild-skeleton-container">
                    <div className="skeleton-header">
                        <Skeleton variant="text" width="60%" height={40} style={{ marginBottom: '12px' }} />
                        <Skeleton variant="text" width="40%" height={20} />
                    </div>
                    <div className="skeleton-section">
                        <Skeleton variant="text" width={120} height={16} style={{ marginBottom: '16px' }} />
                        <div className="skeleton-grid">
                            <Skeleton variant="card" width="100%" height={80} />
                            <Skeleton variant="card" width="100%" height={80} />
                            <Skeleton variant="card" width="100%" height={80} />
                        </div>
                    </div>
                    <div className="skeleton-section">
                        <Skeleton variant="text" width={120} height={16} style={{ marginBottom: '16px' }} />
                        <div className="skeleton-grid">
                            <Skeleton variant="card" width="100%" height={64} />
                            <Skeleton variant="card" width="100%" height={64} />
                        </div>
                    </div>
                </div>
            )}
            {/* Guild Banner */}
            {bannerUrl && (
                <div className="guild-banner">
                    {isBannerVideo ? (
                        <video
                            src={bannerUrl}
                            autoPlay={!prefersReducedMotion}
                            loop
                            muted
                            playsInline
                            poster={bannerUrl.replace(/\.(mp4|webm)$/i, '.jpg')}
                        />
                    ) : (
                        <img src={bannerUrl} alt={`${guildName} banner`} />
                    )}
                    <div className="guild-banner-overlay" />
                </div>
            )}
            {isMobile && (
                <div className="guild-mobile-header">
                    <button className="mobile-back-btn" onClick={() => navigate('/')}>
                        <ArrowLeft size={20} />
                    </button>
                    <span>{guildName}</span>
                </div>
            )}
            {guild && (
                <div className="guild-portal-hero">
                    <Portal
                        data={{
                            guildId: guild.id,
                            guildName: guild.name,
                            guildDescription: guild.description,
                            iconHash: guild.iconHash,
                            memberCount: guild.memberCount,
                            tasks: portalTasks,
                            completionPercent: portalCompletionPercent,
                            showQuests: showSetupQuests,
                            onTaskAction: (id) => portalTaskActions[id]?.(),
                            onOpenSettings: openPortalSettings,
                        }}
                    />
                </div>
            )}
            {guild && showSetupQuests && nextSetupStep && (
                <div className="portal-next-step-chip" role="region" aria-label="Portal setup">
                    <span className="portal-next-step-label">
                        <strong>Next:</strong> {nextSetupStep.label}
                    </span>
                    <button
                        type="button"
                        className="portal-next-step-action"
                        onClick={nextSetupStep.onAction}
                    >
                        {nextSetupStep.actionLabel}
                    </button>
                    <button
                        type="button"
                        className="portal-next-step-dismiss"
                        aria-label="Hide setup tips for this portal"
                        onClick={() => {
                            if (!guildId) return;
                            try {
                                const raw = JSON.parse(localStorage.getItem('gratonite-portal-setup-dismissed') || '{}');
                                raw[guildId] = true;
                                localStorage.setItem('gratonite-portal-setup-dismissed', JSON.stringify(raw));
                            } catch { /* ignore */ }
                            setSetupDismissed(true);
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>
            )}
            <div className="guild-main-content">
                {/* Left Column: Channels */}
                <div className="guild-channels-section">
                    {!guild && (
                        <div className="guild-hero">
                            <h1>Welcome to {guildName}</h1>
                            <p className="guild-subtitle">Loading…</p>
                        </div>
                    )}

                    {/* Text Channels Grid */}
                    <div className="guild-section">
                        <h3 className="guild-section-title">Text Channels</h3>
                        <div className="channels-grid">
                            {textChannels.length === 0 && (
                                <div className="empty-state">
                                    <div className="empty-state-title">No text channels yet</div>
                                    <div className="empty-state-description">
                                        {isOwner
                                            ? 'Start with one chat channel for everyday conversation, plus a forum if you want longer threads.'
                                            : 'The owner has not added a text channel yet.'}
                                    </div>
                                    {isOwner && (
                                        <div className="empty-state-actions">
                                            <button className="auth-button" onClick={() => setActiveModal('guildSettings')} style={{ margin: 0, background: 'var(--accent-primary)', color: '#000' }}>
                                                Open Portal Settings
                                            </button>
                                            <button className="auth-button" onClick={() => setActiveModal('invite')} style={{ margin: 0, background: 'var(--bg-tertiary)' }}>
                                                Invite your first people
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {textChannels.map(ch => (
                                <Link key={ch.id} to={`/guild/${guildId}/channel/${ch.id}`} className="channel-card-link">
                                    <div className="channel-card">
                                        <div className="channel-card-header">
                                            <HashIcon size={16} className="channel-icon" /> {ch.name}
                                        </div>
                                        {ch.topic && <p className="channel-topic">{ch.topic}</p>}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Voice Channels Grid */}
                    <div className="guild-section">
                        <h3 className="guild-section-title">Voice Channels</h3>
                        <div className="channels-grid">
                            {voiceChannels.length === 0 && (
                                <div className="empty-state">
                                    <div className="empty-state-title">No voice channels yet</div>
                                    <div className="empty-state-description">
                                        {isOwner
                                            ? 'Add a voice room for quick calls, hangouts, or events once people start arriving.'
                                            : 'Voice spaces have not been set up here yet.'}
                                    </div>
                                    {isOwner && (
                                        <button className="auth-button" onClick={() => setActiveModal('guildSettings')} style={{ margin: 0, background: 'var(--bg-tertiary)', width: 'fit-content' }}>
                                            Open Portal Settings
                                        </button>
                                    )}
                                </div>
                            )}
                            {voiceChannels.map(ch => {
                                const participantCount = voiceParticipants[ch.id] || 0;
                                return (
                                    <Link key={ch.id} to={`/guild/${guildId}/voice/${ch.id}`} className="channel-card-link">
                                        <div className="channel-card">
                                            <div className="channel-card-header">
                                                <Mic size={16} className="channel-icon" /> {ch.name}
                                            </div>
                                            {participantCount > 0 && (
                                                <div className="voice-participants-badge">
                                                    <Users size={14} />
                                                    <span>{participantCount} {participantCount === 1 ? 'user' : 'users'} in voice</span>
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Column: Guild Identity & Actions */}
                <aside className="guild-sidebar">
                    {/* Guild identity is rendered in the Portal hero above; sidebar focuses on actions/widgets */}

                    {/* Primary Actions */}
                    <div className="guild-actions">
                        <button className="auth-button guild-action-primary" onClick={() => setActiveModal('invite')}>Create Invite</button>
                        {isOwner ? (
                            <>
                                <button className="auth-button guild-action-secondary" onClick={() => setActiveModal('guildSettings')}>Portal Settings</button>
                                <Link to={`/guild/${guildId}/workflows`} style={{ textDecoration: 'none' }}>
                                    <button className="auth-button guild-action-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}>
                                        <Zap size={16} /> Automations
                                    </button>
                                </Link>
                                <Link to={`/guild/${guildId}/events`} style={{ textDecoration: 'none' }}>
                                    <button className="auth-button guild-action-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}>
                                        <Calendar size={16} /> Events
                                    </button>
                                </Link>
                            </>
                        ) : (
                            <button className="auth-button guild-action-secondary" onClick={() => setActiveModal('memberOptions')}>Community options</button>
                        )}
                    </div>

                    {/* Setup Checklist Card (for owners only) */}
                    {isOwner && (
                        <div className="guild-setup-card">
                            <div className="setup-card-header">
                                <div>
                                    <div className="setup-card-label">Setup Checklist</div>
                                    <div className="setup-card-title">Get this portal ready</div>
                                    <div className="setup-card-description">
                                        {completedSetupCount}/{setupChecklist.length} basics done. Finish the essentials, then share an invite.
                                    </div>
                                </div>
                                <div className="progress-bar">
                                    <div className="progress-fill" style={{ width: `${(completedSetupCount / setupChecklist.length) * 100}%` }} />
                                </div>
                            </div>

                            <div className="setup-items-container">
                                {setupChecklist.map((item) => (
                                    <div key={item.id} className={`setup-item pulse-wave ${item.done ? 'setup-item-done' : ''}`}>
                                        <div className="setup-item-checkbox">
                                            {item.done ? '✓' : ''}
                                        </div>
                                        <div className="setup-item-content">
                                            <div className="setup-item-label">{item.label}</div>
                                            {!item.done && (
                                                <div className="setup-item-hint">{item.hint}</div>
                                            )}
                                        </div>
                                        {!item.done && (
                                            <button className="auth-button setup-item-action" onClick={item.onAction}>
                                                {item.actionLabel}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Tips Section */}
                            <div className="setup-tips-section">
                                <div className="setup-tip-card">
                                    <div className="setup-tip-label">Next best step</div>
                                    <div className="setup-tip-title">
                                        {nextSetupStep ? nextSetupStep.label : 'Your launch basics are done.'}
                                    </div>
                                    <div className="setup-tip-description">
                                        {nextSetupStep
                                            ? nextSetupStep.hint
                                            : 'Now focus on seeding a first conversation, checking your moderation settings, and inviting people in waves.'}
                                    </div>
                                </div>
                                <div className="setup-tip-card">
                                    <div className="setup-tip-title">Launch tips for admins</div>
                                    <div className="setup-tips-list">
                                        {ownerLaunchTips.map((tip) => (
                                            <div key={tip} className="setup-tip-item">
                                                <span className="setup-tip-bullet">•</span>
                                                <span>{tip}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </aside>
            </div>
        </div>
        </PortalThemeProvider>
    );
};

export default GuildOverview;
