import { useState, lazy, Suspense } from 'react';
import { Compass, MessageSquare, ClipboardList, Heart, Settings, Star, Monitor, Plus, Server, Zap, Users, ArrowRight, Bell, Search } from 'lucide-react';
import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import { api, API_BASE } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';
import { useIsMobile } from '../../hooks/useIsMobile';
import { getDeterministicGradient } from '../../utils/colors';
import { EmptyState } from '../../components/ui/EmptyState';
import { ActivityFeed } from '../../components/ActivityFeed';
import { CHANGELOG } from '../../data/changelog';

const DailyCheckIn = lazy(() => import('../../components/ui/DailyCheckIn'));

type Guild = {
    id: string;
    name: string;
    iconHash?: string | null;
    memberCount: number;
};

type OutletContextType = {
    setActiveModal: (modal: 'settings' | 'userProfile' | 'createGuild' | null) => void;
    guilds: Guild[];
    userProfile?: { name?: string; displayName?: string };
    setGratoniteBalance?: (balance: number) => void;
};

const handleCardKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        action();
    }
};

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
};

const Home = () => {
    const { setActiveModal, guilds, userProfile, setGratoniteBalance } = useOutletContext<OutletContextType>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const isMobile = useIsMobile();
    const [joiningLounge, setJoiningLounge] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const hasGuilds = guilds.length > 0;

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
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ padding: '16px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '12px' }}>Communities</h1>

                    {/* Search */}
                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search communities..."
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
                            Create Guild
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
                        searchQuery ? (
                            <EmptyState
                                type="search"
                                title="No communities match your search"
                                description="Try a different search term to find the community you want."
                            />
                        ) : (
                            <div style={{
                                padding: '20px',
                                background: 'var(--bg-secondary)',
                                borderRadius: '12px',
                                border: '1px solid var(--stroke)',
                                display: 'grid',
                                gap: '12px',
                            }}>
                                <EmptyState
                                    type="server"
                                    title="Choose your first move"
                                    description="Create your own community, join the Gratonite Lounge, or explore public spaces to see how Gratonite feels in action."
                                />
                                <div style={{ display: 'grid', gap: '8px' }}>
                                    <button
                                        onClick={() => setActiveModal('createGuild')}
                                        style={{
                                            width: '100%',
                                            minHeight: '44px',
                                            borderRadius: '10px',
                                            border: 'none',
                                            background: 'var(--accent-primary)',
                                            color: '#111',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Create your community
                                    </button>
                                    <button
                                        onClick={handleJoinLounge}
                                        disabled={joiningLounge}
                                        style={{
                                            width: '100%',
                                            minHeight: '44px',
                                            borderRadius: '10px',
                                            border: '1px solid var(--stroke)',
                                            background: 'var(--bg-tertiary)',
                                            color: 'var(--text-primary)',
                                            fontWeight: 600,
                                            cursor: joiningLounge ? 'wait' : 'pointer',
                                        }}
                                    >
                                        {joiningLounge ? 'Joining Gratonite Lounge...' : 'Join Gratonite Lounge'}
                                    </button>
                                    <button
                                        onClick={() => navigate('/discover')}
                                        style={{
                                            width: '100%',
                                            minHeight: '44px',
                                            borderRadius: '10px',
                                            border: '1px solid var(--stroke)',
                                            background: 'transparent',
                                            color: 'var(--text-secondary)',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Explore public communities
                                    </button>
                                </div>
                            </div>
                        )
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
                                                src={`${API_BASE}/files/${g.iconHash}`}
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

    const displayName = userProfile?.displayName || userProfile?.name || 'there';
    const hour = new Date().getHours();
    const timeEmoji = hour < 12 ? '\u2600\uFE0F' : hour < 18 ? '\u26A1' : '\uD83C\uDF19';
    const latestRelease = CHANGELOG[0];

    // Desktop: fully revamped home
    return (
        <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
            <style>{`
                @keyframes homeHeroShimmer {
                    0%   { transform: translate(-30%, -30%) scale(1); opacity: 0.35; }
                    50%  { transform: translate(10%, 20%) scale(1.3); opacity: 0.55; }
                    100% { transform: translate(-30%, -30%) scale(1); opacity: 0.35; }
                }
                @keyframes homeHeroShimmer2 {
                    0%   { transform: translate(60%, 60%) scale(1.2); opacity: 0.25; }
                    50%  { transform: translate(20%, 10%) scale(0.9); opacity: 0.45; }
                    100% { transform: translate(60%, 60%) scale(1.2); opacity: 0.25; }
                }
                .home-hero-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 18px;
                    border-radius: 100px;
                    font-size: 14px;
                    font-weight: 700;
                    cursor: pointer;
                    border: none;
                    transition: transform 0.15s, box-shadow 0.15s;
                    white-space: nowrap;
                }
                .home-hero-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.25); }
                .home-bento-card {
                    border-radius: 20px;
                    padding: 22px;
                    border: 1px solid var(--stroke);
                    background: var(--bg-secondary);
                    cursor: pointer;
                    transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    position: relative;
                    overflow: hidden;
                    text-decoration: none;
                    color: inherit;
                }
                .home-bento-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 12px 32px rgba(0,0,0,0.18);
                    border-color: var(--accent-primary);
                }
                .home-guild-pill {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    cursor: pointer;
                    text-decoration: none;
                    color: inherit;
                    flex-shrink: 0;
                    transition: transform 0.15s;
                }
                .home-guild-pill:hover { transform: translateY(-3px); }
            `}</style>

            <div style={{ maxWidth: '900px', margin: '0 auto', padding: 'clamp(20px, 4vw, 48px) clamp(16px, 3vw, 32px)', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* ── HERO BANNER ── */}
                <div style={{
                    position: 'relative',
                    borderRadius: '28px',
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, var(--accent-primary) 0%, #7c3aed 55%, #db2777 100%)',
                    padding: 'clamp(28px, 5vw, 44px) clamp(24px, 4vw, 40px)',
                    boxShadow: '0 20px 60px rgba(88,101,242,0.35)',
                }}>
                    {/* Animated blobs */}
                    <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none',
                    }}>
                        <div style={{ position: 'absolute', width: '340px', height: '340px', borderRadius: '50%', background: 'rgba(255,255,255,0.12)', animation: 'homeHeroShimmer 8s ease-in-out infinite', top: '-60px', left: '-60px' }} />
                        <div style={{ position: 'absolute', width: '280px', height: '280px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', animation: 'homeHeroShimmer2 11s ease-in-out infinite', bottom: '-40px', right: '-40px' }} />
                    </div>

                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                            {timeEmoji} {getGreeting()}
                        </div>
                        <h1 style={{ margin: 0, fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 900, fontFamily: 'var(--font-display)', color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                            Hey, {displayName}!
                        </h1>
                        <p style={{ margin: '10px 0 0', fontSize: '16px', color: 'rgba(255,255,255,0.75)', maxWidth: '420px', lineHeight: 1.5 }}>
                            Your communities are waiting. Pick up where you left off.
                        </p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '24px' }}>
                            <button className="home-hero-btn" onClick={() => navigate('/friends')} style={{ background: '#fff', color: '#111' }}>
                                <MessageSquare size={15} /> Start a DM
                            </button>
                            <button className="home-hero-btn" onClick={() => navigate('/discover')} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
                                <Compass size={15} /> Discover
                            </button>
                            <button className="home-hero-btn" onClick={() => setActiveModal('createGuild')} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>
                                <Plus size={15} /> Create Guild
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── FIRST-TIME ONBOARDING (no guilds) ── */}
                {!hasGuilds && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px,100%), 1fr))', gap: '12px' }}>
                        {[
                            { icon: <Plus size={20} />, title: 'Create a community', body: 'Start with a template, add channels, roles, invites.', color: 'var(--accent-primary)', bg: 'rgba(88,101,242,0.1)', action: () => setActiveModal('createGuild') },
                            { icon: <MessageSquare size={20} />, title: 'Join the Lounge', body: 'See a real Gratonite space and meet people already here.', color: '#10b981', bg: 'rgba(16,185,129,0.1)', action: handleJoinLounge },
                            { icon: <Compass size={20} />, title: 'Explore public spaces', body: 'Browse communities before you commit to anything.', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', action: () => navigate('/discover') },
                        ].map(item => (
                            <button
                                key={item.title}
                                onClick={item.action}
                                disabled={item.title === 'Join the Lounge' && joiningLounge}
                                style={{ textAlign: 'left', padding: '20px', borderRadius: '20px', border: '1px solid var(--stroke)', background: item.bg, color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'transform 0.15s', }}
                            >
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: item.color, color: '#fff' }}>{item.icon}</div>
                                <div style={{ fontWeight: 700, fontSize: '15px' }}>{item.title}</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.title === 'Join the Lounge' && joiningLounge ? 'Joining lounge...' : item.body}</div>
                            </button>
                        ))}
                    </div>
                )}

                {/* ── YOUR GUILDS ── */}
                {hasGuilds && (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                            <h2 style={{ margin: 0, fontSize: '13px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Your Guilds</h2>
                            <button onClick={() => setActiveModal('createGuild')} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '8px' }}>
                                <Plus size={13} /> New Guild
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
                            {guilds.map(g => (
                                <Link key={g.id} to={`/guild/${g.id}`} className="home-guild-pill">
                                    {g.iconHash ? (
                                        <img src={`${API_BASE}/files/${g.iconHash}`} alt={g.name} style={{ width: '56px', height: '56px', borderRadius: '16px', objectFit: 'cover', border: '2px solid var(--stroke)' }} />
                                    ) : (
                                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: getDeterministicGradient(g.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 800, color: '#fff', border: '2px solid rgba(255,255,255,0.1)' }}>
                                            {g.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', maxWidth: '64px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</span>
                                </Link>
                            ))}
                            {/* Add guild button */}
                            <button onClick={() => setActiveModal('createGuild')} className="home-guild-pill" style={{ background: 'none', border: 'none', padding: 0 }}>
                                <div style={{ width: '56px', height: '56px', borderRadius: '16px', border: '2px dashed var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                    <Plus size={20} />
                                </div>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', maxWidth: '64px', textAlign: 'center' }}>New</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* ── DAILY CHECK-IN ── */}
                <Suspense fallback={null}>
                    <DailyCheckIn onBalanceUpdate={setGratoniteBalance} />
                </Suspense>

                {/* ── BENTO GRID ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: 'minmax(140px, auto)', gap: '14px' }}>

                    {/* FAME — wide */}
                    <div className="home-bento-card" role="button" tabIndex={0} onClick={() => navigate('/fame')} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') navigate('/fame'); }}
                        style={{ gridColumn: 'span 2', background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(220,38,38,0.06))', borderColor: 'rgba(245,158,11,0.25)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Star size={22} color="#111" fill="#111" />
                            </div>
                            <ArrowRight size={16} color="var(--text-muted)" />
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '17px', color: '#f59e0b' }}>FAME Dashboard</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Give FAME, view leaderboards, and rate communities. You have 5 tokens to give today.</div>
                    </div>

                    {/* What's New */}
                    {latestRelease && (
                        <div className="home-bento-card" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.06))', borderColor: 'rgba(99,102,241,0.25)' }}
                            role="button" tabIndex={0} onClick={() => navigate('/inbox')} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') navigate('/inbox'); }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Bell size={20} color="#fff" />
                                </div>
                                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', background: 'rgba(99,102,241,0.2)', color: '#818cf8', padding: '3px 8px', borderRadius: '100px', textTransform: 'uppercase' }}>New</span>
                            </div>
                            <div style={{ fontWeight: 800, fontSize: '15px', color: '#818cf8', lineHeight: 1.3 }}>{latestRelease.title}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{latestRelease.date}</div>
                        </div>
                    )}

                    {/* Discover */}
                    <div className="home-bento-card" role="button" tabIndex={0} onClick={() => navigate('/discover')} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') navigate('/discover'); }}
                        style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(6,95,70,0.04))', borderColor: 'rgba(16,185,129,0.2)' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Compass size={22} color="#fff" />
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '16px', color: '#34d399' }}>Discover</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Find new communities to join.</div>
                    </div>

                    {/* Friends / DMs */}
                    <div className="home-bento-card" role="button" tabIndex={0} onClick={() => navigate('/friends')} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') navigate('/friends'); }}
                        style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.1), rgba(219,39,119,0.04))', borderColor: 'rgba(236,72,153,0.2)' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg, #ec4899, #db2777)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={22} color="#fff" />
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '16px', color: '#f472b6' }}>Friends & DMs</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Your people, your messages.</div>
                    </div>

                    {/* Download */}
                    <div className="home-bento-card" role="button" tabIndex={0} onClick={() => navigate('/download')} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') navigate('/download'); }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Monitor size={22} color="var(--text-primary)" />
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '15px' }}>Desktop & Mobile</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>macOS, Windows, Linux, Android</div>
                    </div>

                    {/* Self-host */}
                    <div className="home-bento-card" role="button" tabIndex={0} onClick={() => window.open('https://gratonite.chat/docs/self-hosting', '_blank')} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') window.open('https://gratonite.chat/docs/self-hosting', '_blank'); }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Server size={22} color="var(--text-primary)" />
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '15px' }}>Self-Host</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Run your own instance in 5 minutes.</div>
                    </div>

                    {/* Settings */}
                    <div className="home-bento-card" role="button" tabIndex={0} onClick={() => setActiveModal('settings')} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') setActiveModal('settings'); }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Settings size={22} color="var(--text-primary)" />
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '15px' }}>Settings</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Themes, privacy, notifications.</div>
                    </div>

                    {/* Feedback */}
                    <div className="home-bento-card" role="button" tabIndex={0} onClick={() => setActiveModal('bugReport' as any)} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') setActiveModal('bugReport' as any); }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ClipboardList size={22} color="var(--text-primary)" />
                        </div>
                        <div style={{ fontWeight: 800, fontSize: '15px' }}>Give Feedback</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Bug reports, ideas, anything.</div>
                    </div>

                    {/* Donate — wide */}
                    <div className="home-bento-card" role="button" tabIndex={0} onClick={() => window.open('https://buymeacoffee.com/codya', '_blank')} onKeyDown={e => { if (e.key==='Enter'||e.key===' ') window.open('https://buymeacoffee.com/codya', '_blank'); }}
                        style={{ gridColumn: 'span 2', background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(220,38,38,0.04))', borderColor: 'rgba(239,68,68,0.18)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Heart size={22} color="#fff" fill="#fff" />
                            </div>
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '16px' }}>Support Gratonite</div>
                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>Every coffee keeps the servers running and the team going. Thank you. ❤️</div>
                            </div>
                            <Zap size={16} color="var(--text-muted)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
                        </div>
                    </div>

                </div>

                {/* ── ACTIVITY FEED ── */}
                <div style={{ width: '100%' }}>
                    <h2 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Activity</h2>
                    <ActivityFeed />
                </div>

            </div>
        </div>
    );
};

export default Home;
