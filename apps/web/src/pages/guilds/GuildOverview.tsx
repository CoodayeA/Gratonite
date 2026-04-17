import { useEffect, useState } from 'react';
import { Hash as HashIcon, Mic, Users, Zap, Calendar, ArrowLeft } from 'lucide-react';
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
    const setupChecklist = [
        { id: 'identity', label: 'Add an icon and description so people know what this portal is for.', done: Boolean(guild?.iconHash && guild?.description) },
        { id: 'text', label: 'Create at least one text channel for conversation.', done: textChannels.length > 0 },
        { id: 'voice', label: 'Create at least one voice channel for drop-ins.', done: voiceChannels.length > 0 },
        { id: 'invite', label: 'Invite your first people so the space stops feeling empty.', done: (guild?.memberCount ?? 0) > 1 },
    ];
    const completedSetupCount = setupChecklist.filter((item) => item.done).length;

    const guildName = guild?.name || 'Loading...';
    const guildInitial = guildName.charAt(0).toUpperCase();
    const createdDate = guild?.createdAt ? new Date(guild.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '';

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
        <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto', flexDirection: 'column' }}>
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
                <div style={{ padding: '48px', maxWidth: '1400px', margin: '0 auto' }}>
                    {/* Skeleton header */}
                    <div style={{ marginBottom: '40px' }}>
                        <Skeleton variant="text" width="60%" height={40} style={{ marginBottom: '12px' }} />
                        <Skeleton variant="text" width="40%" height={20} />
                    </div>
                    {/* Skeleton channel sections */}
                    <div style={{ marginBottom: '24px' }}>
                        <Skeleton variant="text" width={120} height={16} style={{ marginBottom: '16px' }} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                            <Skeleton variant="card" width="100%" height={80} />
                            <Skeleton variant="card" width="100%" height={80} />
                            <Skeleton variant="card" width="100%" height={80} />
                        </div>
                    </div>
                    <div style={{ marginBottom: '24px' }}>
                        <Skeleton variant="text" width={120} height={16} style={{ marginBottom: '16px' }} />
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                            <Skeleton variant="card" width="100%" height={64} />
                            <Skeleton variant="card" width="100%" height={64} />
                        </div>
                    </div>
                </div>
            )}
            {/* Guild Banner */}
            {bannerUrl && (
                <div className="guild-banner" style={{ width: '100%', height: '240px', position: 'relative', overflow: 'hidden', flexShrink: 0, isolation: 'isolate' }}>
                    {isBannerVideo ? (
                        <video src={bannerUrl} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                        <img src={bannerUrl} alt={`${guildName} banner`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '80px', background: 'linear-gradient(transparent, var(--bg-primary))' }} />
                </div>
            )}
            {isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px' }}>
                    <button className="mobile-back-btn" onClick={() => navigate('/')}>
                        <ArrowLeft size={20} />
                    </button>
                    <span style={{ fontWeight: 600, fontSize: '16px' }}>{guildName}</span>
                </div>
            )}
            <div className="content-padding" style={{ padding: isMobile ? '24px 16px' : '48px 48px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) 340px', gap: isMobile ? '24px' : '48px', alignItems: 'start', maxWidth: '1400px', margin: '0 auto' }}>

                {/* Left Column: Channels */}
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: '8px', letterSpacing: '-0.5px' }}>Welcome to {guildName}</h1>
                    <p style={{ fontSize: '15px', color: 'var(--text-muted)', marginBottom: '40px' }}>
                        {isOwner && textChannels.length === 0 && voiceChannels.length === 0
                            ? 'This portal is still in setup mode. Knock out the basics below, then invite people in.'
                            : 'Select a channel below to jump into the conversation.'}
                    </p>

                    {/* Text Channels Grid */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h3 className="section-label" style={{ margin: 0 }}>Text Channels</h3>
                    </div>
                    <div className="channels-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', marginBottom: '40px' }}>
                        {textChannels.length === 0 && (
                            <div style={{
                                padding: '20px',
                                border: '1px dashed var(--stroke)',
                                borderRadius: '16px',
                                background: 'var(--bg-elevated)',
                                display: 'grid',
                                gap: '12px',
                            }}>
                                <div style={{ fontWeight: 700 }}>No text channels yet</div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
                                    {isOwner
                                        ? 'Start with one chat channel for everyday conversation, plus a forum if you want longer threads.'
                                        : 'The owner has not added a text channel yet.'}
                                </div>
                                {isOwner && (
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        <button className="auth-button" onClick={() => setActiveModal('guildSettings')} style={{ margin: 0, padding: '10px 14px', background: 'var(--accent-primary)', color: '#000', border: '3px solid #000', fontWeight: 800 }}>
                                            Open Portal Settings
                                        </button>
                                        <button className="auth-button" onClick={() => setActiveModal('invite')} style={{ margin: 0, padding: '10px 14px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '3px solid #000', fontWeight: 800 }}>
                                            Invite your first people
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                        {textChannels.map(ch => (
                            <Link key={ch.id} to={`/guild/${guildId}/channel/${ch.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <div className="channel-card">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontWeight: 600 }}>
                                        <HashIcon size={16} color="var(--text-muted)" /> {ch.name}
                                    </div>
                                    {ch.topic && <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{ch.topic}</p>}
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Voice Channels Grid */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h3 className="section-label" style={{ margin: 0 }}>Voice Channels</h3>
                    </div>
                    <div className="channels-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                        {voiceChannels.length === 0 && (
                            <div style={{
                                padding: '20px',
                                border: '1px dashed var(--stroke)',
                                borderRadius: '16px',
                                background: 'var(--bg-elevated)',
                                display: 'grid',
                                gap: '12px',
                            }}>
                                <div style={{ fontWeight: 700 }}>No voice channels yet</div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
                                    {isOwner
                                        ? 'Add a voice room for quick calls, hangouts, or events once people start arriving.'
                                        : 'Voice spaces have not been set up here yet.'}
                                </div>
                                {isOwner && (
                                    <button className="auth-button" onClick={() => setActiveModal('guildSettings')} style={{ margin: 0, padding: '10px 14px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '3px solid #000', fontWeight: 800, width: 'fit-content' }}>
                                        Open Portal Settings
                                    </button>
                                )}
                            </div>
                        )}
                        {voiceChannels.map(ch => {
                            const participantCount = voiceParticipants[ch.id] || 0;
                            return (
                                <Link key={ch.id} to={`/guild/${guildId}/voice/${ch.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                    <div className="channel-card">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                                                <Mic size={16} color="var(--text-muted)" /> {ch.name}
                                            </div>
                                        </div>
                                        {participantCount > 0 && (
                                            <div style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '6px', 
                                                fontSize: '12px', 
                                                color: 'var(--success)',
                                                marginTop: '4px'
                                            }}>
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

                {/* Right Column: Server Identity */}
                <div style={{
                    display: 'flex', flexDirection: 'column',
                    background: 'var(--bg-elevated)',
                    border: 'var(--border-structural, 3px solid #000)',
                    borderRadius: 'var(--radius-lg, 0)',
                    padding: '32px',
                    boxShadow: 'var(--shadow-panel, 8px 8px 0 #000)',
                    position: 'sticky',
                    top: '48px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                        <div style={{
                            width: '120px', height: '120px',
                            borderRadius: '24px',
                            background: (guild?.iconHash && !iconImgError) ? 'transparent' : getDeterministicGradient(guildName),
                            border: '4px solid var(--accent-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '48px', fontWeight: 'bold', color: 'white',
                            overflow: 'hidden',
                        }}>
                            {(guild?.iconHash && !iconImgError) ? (
                                <img
                                    src={`${API_BASE}/files/${guild.iconHash}`}
                                    alt={guildName}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    onError={() => setIconImgError(true)}
                                />
                            ) : guildInitial}
                        </div>
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>{guildName}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
                            {createdDate && <span>Est. {createdDate}</span>}
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></span>
                                {guild?.memberCount ?? 0} Members
                            </span>
                            {ownerUser && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Owned by <span style={{ color: 'var(--accent-primary)', cursor: 'pointer', fontWeight: 600 }}>@{ownerUser.displayName || ownerUser.username}</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {guild?.description && (
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, textAlign: 'center', marginBottom: '32px' }}>
                            {guild.description}
                        </p>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button className="auth-button" onClick={() => setActiveModal('invite')} style={{ margin: 0, padding: '12px', width: '100%', background: 'var(--accent-primary)', color: '#000', border: '3px solid #000', fontWeight: 800 }}>Create Invite</button>
                        {isOwner ? (
                            <>
                                <button className="auth-button" onClick={() => setActiveModal('guildSettings')} style={{ margin: 0, padding: '12px', width: '100%', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '3px solid #000', fontWeight: 800 }}>Portal Settings</button>
                                <Link to={`/guild/${guildId}/workflows`} style={{ textDecoration: 'none' }}>
                                    <button className="auth-button" style={{ margin: 0, padding: '12px', width: '100%', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '3px solid #000', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                        <Zap size={16} /> Automations
                                    </button>
                                </Link>
                                <Link to={`/guild/${guildId}/events`} style={{ textDecoration: 'none' }}>
                                    <button className="auth-button" style={{ margin: 0, padding: '12px', width: '100%', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '3px solid #000', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                        <Calendar size={16} /> Events
                                    </button>
                                </Link>
                            </>
                        ) : (
                            <button className="auth-button" onClick={() => setActiveModal('memberOptions')} style={{ margin: 0, padding: '12px', width: '100%', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '3px solid #000', fontWeight: 800 }}>Server Options</button>
                        )}
                    </div>

                    {isOwner && (
                        <div style={{
                            marginTop: '24px',
                            padding: '20px',
                            borderRadius: '16px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--stroke)',
                            display: 'grid',
                            gap: '14px',
                        }}>
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-primary)', marginBottom: '6px' }}>
                                    Setup checklist
                                </div>
                                <div style={{ fontSize: '18px', fontWeight: 800 }}>Get this portal ready for people</div>
                                <div style={{ marginTop: '6px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
                                    {completedSetupCount}/{setupChecklist.length} basics done. Finish the essentials, then share an invite.
                                </div>
                            </div>
                            <div style={{ display: 'grid', gap: '10px' }}>
                                {setupChecklist.map((item) => (
                                    <div key={item.id} style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '10px',
                                        padding: '10px 12px',
                                        borderRadius: '12px',
                                        background: 'var(--bg-elevated)',
                                        border: '1px solid var(--stroke)',
                                    }}>
                                        <div style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '999px',
                                            flexShrink: 0,
                                            marginTop: '2px',
                                            background: item.done ? 'var(--success)' : 'transparent',
                                            border: item.done ? 'none' : '2px solid var(--stroke)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#000',
                                            fontSize: '12px',
                                            fontWeight: 900,
                                        }}>
                                            {item.done ? '✓' : ''}
                                        </div>
                                        <div style={{ color: item.done ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.5, fontSize: '14px' }}>
                                            {item.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default GuildOverview;
