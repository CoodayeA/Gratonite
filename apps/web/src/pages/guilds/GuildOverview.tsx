import { useEffect, useState } from 'react';
import { Hash as HashIcon, Mic, Users, Zap, Calendar, ArrowLeft, Settings, Link2 } from 'lucide-react';
import { useOutletContext, Link, useParams, useNavigate } from 'react-router-dom';
import { api, API_BASE, getAccessToken } from '../../lib/api';
import { useUser } from '../../contexts/UserContext';
import { getDeterministicGradient } from '../../utils/colors';
import { onVoiceStateUpdate, type VoiceStateUpdatePayload } from '../../lib/socket';
import type { GuildSessionChannel, GuildSessionInfo, GuildSessionErrorCode } from '../../hooks/useGuildSession';
import GuildWelcomeModal from '../../components/modals/GuildWelcomeModal';
import { useIsMobile } from '../../hooks/useIsMobile';
import Skeleton from '../../components/ui/Skeleton';

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
    const guildName = guild?.name || 'Loading...';
    const guildInitial = guildName.charAt(0).toUpperCase();
    const createdDate = guild?.createdAt ? new Date(guild.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';
    const ownerLabel = ownerUser ? (ownerUser.displayName || ownerUser.username || '').trim() : '';

    const bannerUrl = guild?.bannerHash ? `${API_BASE}/files/${guild.bannerHash}` : null;
    const isBannerVideo = bannerUrl?.endsWith('.mp4') || bannerUrl?.endsWith('.webm');

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
                        <video src={bannerUrl} autoPlay loop muted playsInline />
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
            <div className="guild-main-content guild-overview-layout">
                <section className="guild-overview-panel" aria-label={`${guildName} overview`}>
                    <div className="guild-overview-avatar" style={{ background: getDeterministicGradient(guildName) }}>
                        {(guild?.iconHash && !iconImgError) ? (
                            <img
                                src={`${API_BASE}/files/${guild.iconHash}`}
                                alt=""
                                onError={() => setIconImgError(true)}
                            />
                        ) : (
                            <span>{guildInitial}</span>
                        )}
                    </div>
                    <div className="guild-overview-copy">
                        <h1>{guildName}</h1>
                        <div className="guild-overview-meta">
                            <span>{guild?.memberCount ?? 0} members</span>
                            {createdDate && <span>Since {createdDate}</span>}
                            {ownerLabel && <span>By @{ownerLabel}</span>}
                        </div>
                        {guild?.description ? (
                            <p>{guild.description}</p>
                        ) : (
                            <p>Choose a channel below to start chatting, ask a question, or drop into voice.</p>
                        )}
                    </div>
                </section>

                <nav className="guild-quick-actions" aria-label="Community actions">
                    <button className="guild-quick-action guild-quick-action-primary" onClick={() => setActiveModal('invite')}>
                        <Link2 size={16} />
                        Invite
                    </button>
                    {isOwner ? (
                        <>
                            <button className="guild-quick-action" onClick={() => setActiveModal('guildSettings')}>
                                <Settings size={16} />
                                Settings
                            </button>
                            <Link to={`/guild/${guildId}/workflows`} className="guild-quick-action">
                                <Zap size={16} />
                                Automations
                            </Link>
                            <Link to={`/guild/${guildId}/events`} className="guild-quick-action">
                                <Calendar size={16} />
                                Events
                            </Link>
                        </>
                    ) : (
                        <button className="guild-quick-action" onClick={() => setActiveModal('memberOptions')}>
                            <Settings size={16} />
                            Options
                        </button>
                    )}
                </nav>

                <div className="guild-channels-section">
                    <div className="guild-section">
                        <h3 className="guild-section-title">Text Channels</h3>
                        <div className="channels-list">
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
                                <Link key={ch.id} to={`/guild/${guildId}/channel/${ch.id}`} className="channel-row-link">
                                    <div className="channel-row">
                                        <HashIcon size={18} className="channel-icon" />
                                        <div className="channel-row-copy">
                                            <div className="channel-row-name">{ch.name}</div>
                                            {ch.topic && <p className="channel-topic">{ch.topic}</p>}
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="guild-section">
                        <h3 className="guild-section-title">Voice Channels</h3>
                        <div className="channels-list">
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
                                    <Link key={ch.id} to={`/guild/${guildId}/voice/${ch.id}`} className="channel-row-link">
                                        <div className="channel-row">
                                            <Mic size={18} className="channel-icon" />
                                            <div className="channel-row-copy">
                                                <div className="channel-row-name">{ch.name}</div>
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
            </div>
        </div>
    );
};

export default GuildOverview;
