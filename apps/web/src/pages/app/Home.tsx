import { useState } from 'react';
import { Hash, Compass, MessageSquare, ClipboardList, Heart, Settings, Star, Monitor, Search, Plus } from 'lucide-react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import { api, API_BASE } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';
import { useIsMobile } from '../../hooks/useIsMobile';
import { getDeterministicGradient } from '../../utils/colors';

type Guild = {
    id: string;
    name: string;
    iconHash?: string | null;
    memberCount: number;
};

type OutletContextType = {
    setActiveModal: (modal: 'settings' | 'userProfile' | 'createGuild' | null) => void;
    guilds: Guild[];
};

const Home = () => {
    const { setActiveModal, guilds } = useOutletContext<OutletContextType>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const isMobile = useIsMobile();
    const [joiningLounge, setJoiningLounge] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const handleJoinLounge = async () => {
        if (joiningLounge) return;
        setJoiningLounge(true);
        try {
            let loungeGuildId = '';

            try {
                const lounge = await api.guilds.resolveGratoniteLounge();
                loungeGuildId = lounge.id;
            } catch {
                // fall back to env/discover below
            }

            if (!loungeGuildId) {
                loungeGuildId = String(import.meta.env.VITE_GRATONITE_LOUNGE_GUILD_ID ?? '').trim();
            }

            if (!loungeGuildId) {
                const discoverRows = await api.guilds.discover({ limit: 100 });
                loungeGuildId =
                    discoverRows.find((g) => g.isPinned)?.id ||
                    discoverRows.find((g) => g.isFeatured)?.id ||
                    '';
            }

            if (!loungeGuildId) {
                throw new Error('Lounge guild is not configured yet.');
            }

            await api.guilds.join(loungeGuildId);
            navigate(`/guild/${loungeGuildId}`);
            addToast({ title: 'Joined Gratonite Lounge', variant: 'success' });
        } catch (err: any) {
            addToast({
                title: 'Unable to join lounge',
                description: err?.message || 'Please try again in a moment.',
                variant: 'error',
            });
        } finally {
            setJoiningLounge(false);
        }
    };

    // Mobile: full-page server list
    if (isMobile) {
        const filteredGuilds = guilds.filter(g =>
            g.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return (
            <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ padding: '16px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '12px' }}>Servers</h1>

                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search servers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px 10px 36px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--stroke)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '14px',
                                outline: 'none',
                            }}
                        />
                    </div>

                    {/* Quick actions */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                        <button
                            onClick={() => setActiveModal('createGuild')}
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '10px',
                                background: 'var(--accent-primary)',
                                color: 'var(--bg-app, #111)',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                minHeight: '44px',
                            }}
                        >
                            <Plus size={16} />
                            Create Portal
                        </button>
                        <button
                            onClick={() => navigate('/discover')}
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '10px',
                                background: 'var(--bg-tertiary)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--stroke)',
                                borderRadius: '8px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                minHeight: '44px',
                            }}
                        >
                            <Compass size={16} />
                            Discover
                        </button>
                    </div>

                    {/* Guild list */}
                    {filteredGuilds.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                            {searchQuery ? 'No servers match your search' : 'No servers yet — create or join one!'}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {filteredGuilds.map(g => (
                                <Link
                                    key={g.id}
                                    to={`/guild/${g.id}`}
                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                >
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '12px',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: '10px',
                                        border: '1px solid var(--stroke)',
                                    }}>
                                        {g.iconHash ? (
                                            <img
                                                src={`${API_BASE}/guilds/${g.id}/icon/${g.iconHash}`}
                                                alt={g.name}
                                                style={{ width: '44px', height: '44px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: '44px',
                                                height: '44px',
                                                borderRadius: '12px',
                                                background: getDeterministicGradient(g.id),
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                fontSize: '18px',
                                                fontWeight: 700,
                                                color: 'white',
                                            }}>
                                                {g.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {g.name}
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                                {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Desktop: existing action cards layout
    return (
        <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: 'clamp(16px, 4vw, 48px) clamp(12px, 3vw, 24px)', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-hover))', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(212, 175, 55, 0.2)' }}>
                    <Hash size={32} color="#111" />
                </div>

                <h1 style={{ fontSize: '32px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>Gratonite</h1>
                <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '48px' }}>Welcome back. What would you like to do?</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '16px', width: '100%' }}>
                    {/* Action Cards */}
                    <div className="action-card hover-lift" onClick={() => setActiveModal('createGuild')} style={{ cursor: 'pointer' }}>
                        <div className="action-card-icon">
                            <Hash size={24} />
                        </div>
                        <div className="action-card-text">
                            <div className="action-title">Create a Portal</div>
                            <div className="action-subtext">Start your own community</div>
                        </div>
                    </div>

                    <div className="action-card hover-lift" onClick={() => navigate('/discover')} style={{ cursor: 'pointer' }}>
                        <div className="action-card-icon">
                            <Compass size={24} />
                        </div>
                        <div className="action-card-text">
                            <div className="action-title">Discover Gratonite</div>
                            <div className="action-subtext">Explore public portals</div>
                        </div>
                    </div>

                    <div className="action-card hover-lift" onClick={handleJoinLounge} style={{ cursor: joiningLounge ? 'wait' : 'pointer', opacity: joiningLounge ? 0.7 : 1 }}>
                        <div className="action-card-icon">
                            <MessageSquare size={24} />
                        </div>
                        <div className="action-card-text">
                            <div className="action-title">Join Gratonite Lounge</div>
                            <div className="action-subtext">{joiningLounge ? 'Joining lounge...' : 'Chat with the community'}</div>
                        </div>
                    </div>

                    <div className="action-card hover-lift" onClick={() => setActiveModal('bugReport' as any)} style={{ cursor: 'pointer' }}>
                        <div className="action-card-icon">
                            <ClipboardList size={24} />
                        </div>
                        <div className="action-card-text">
                            <div className="action-title">Give Feedback or Report a Bug</div>
                            <div className="action-subtext">Help us improve</div>
                        </div>
                    </div>

                    <div className="action-card hover-lift" onClick={() => navigate('/download')} style={{ cursor: 'pointer' }}>
                        <div className="action-card-icon">
                            <Monitor size={24} />
                        </div>
                        <div className="action-card-text">
                            <div className="action-title">Download Desktop App</div>
                            <div className="action-subtext">macOS, Windows &amp; Linux</div>
                        </div>
                    </div>

                    <div className="action-card hover-lift" onClick={() => window.open('https://buymeacoffee.com/codya', '_blank')} style={{ cursor: 'pointer' }}>
                        <div className="action-card-icon">
                            <Heart size={24} />
                        </div>
                        <div className="action-card-text">
                            <div className="action-title">Donate to Gratonite</div>
                            <div className="action-subtext">Support development</div>
                        </div>
                    </div>

                    <div className="action-card hover-lift" onClick={() => setActiveModal('settings')} style={{ cursor: 'pointer' }}>
                        <div className="action-card-icon">
                            <Settings size={24} />
                        </div>
                        <div className="action-card-text">
                            <div className="action-title">Open Settings</div>
                            <div className="action-subtext">Customize your experience</div>
                        </div>
                    </div>

                    <div className="action-card hover-lift" onClick={() => navigate('/fame')} style={{ cursor: 'pointer', gridColumn: 'span 2', background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.04))', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <div className="action-card-icon" style={{ background: 'linear-gradient(135deg, var(--warning), #d97706)' }}>
                            <Star size={24} color="#111" fill="#111" />
                        </div>
                        <div className="action-card-text">
                            <div className="action-title" style={{ color: 'var(--warning)' }}>FAME Dashboard</div>
                            <div className="action-subtext">Give FAME, view leaderboards, and rate servers · You have 5 FAME tokens to give today</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;
