import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Compass, Bot, Palette, Star, Users, ArrowRight, X, Shield, MessageSquare, Globe, ExternalLink, Server } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { useTheme, AppTheme } from '../../components/ui/ThemeProvider';
import { api, API_BASE } from '../../lib/api';
import { StarRating } from '../../components/ui/StarRating';

type Tab = 'portals' | 'bots' | 'themes' | 'templates';

type PortalInfo = {
    id: string;
    name: string;
    description: string;
    bannerUrl: string | null;
    iconHash: string | null;
    members: number;
    online: number;
    tags: string[];
    category: string | null;
    verified: boolean;
    featured: boolean;
    isPinned: boolean;
    isPublic: boolean;
    mutualFriends: { name: string; avatar: string }[];
    averageRating: number;
    totalRatings: number;
};

const CATEGORIES = [
    { id: '', label: 'All' },
    { id: 'gaming', label: 'Gaming' },
    { id: 'music', label: 'Music' },
    { id: 'art', label: 'Art' },
    { id: 'tech', label: 'Tech' },
    { id: 'community', label: 'Community' },
    { id: 'anime', label: 'Anime' },
    { id: 'education', label: 'Education' },
    { id: 'other', label: 'Other' },
];

const initialPortals: PortalInfo[] = [];
const SUPPORTED_THEMES: AppTheme[] = ['default', 'glass', 'neobrutalism', 'synthwave', 'y2k', 'memphis', 'artdeco', 'terminal', 'aurora', 'vaporwave', 'nord', 'solarized', 'bubblegum', 'obsidian', 'sakura', 'midnight', 'forest', 'cyberpunk', 'pastel', 'monochrome', 'ocean', 'fire', 'desert', 'lavender', 'coffee', 'matrix', 'rose_gold', 'emerald', 'dracula', 'monokai', 'catppuccin', 'gruvbox', 'tokyo_night', 'everforest', 'arctic', 'neon', 'midnight_blue'];

// Preview colors for built-in themes (bg, accent). Used when no DB entry exists.
const BUILTIN_THEME_PREVIEWS: Record<string, { bg: string; accent: string; label: string; tags: string[] }> = {
    default:       { bg: '#313338', accent: '#5865f2', label: 'Default',       tags: ['Built-in', 'Dark'] },
    glass:         { bg: '#1a1a2e', accent: '#5865f2', label: 'Glass',         tags: ['Built-in', 'Dark'] },
    neobrutalism:  { bg: '#f0f0f0', accent: '#ff4444', label: 'Neobrutalism',  tags: ['Built-in', 'Light'] },
    synthwave:     { bg: '#0d0221', accent: '#ff2d78', label: 'Synthwave',     tags: ['Built-in', 'Dark'] },
    y2k:           { bg: '#ffebf5', accent: '#ff69b4', label: 'Y2K',           tags: ['Built-in', 'Light'] },
    memphis:       { bg: '#fff9f0', accent: '#ff6b35', label: 'Memphis',       tags: ['Built-in', 'Light'] },
    artdeco:       { bg: '#0a0a0a', accent: '#c8a951', label: 'Art Deco',      tags: ['Built-in', 'Dark'] },
    terminal:      { bg: '#001100', accent: '#00ff00', label: 'Terminal',      tags: ['Built-in', 'Dark'] },
    aurora:        { bg: '#0d1117', accent: '#00ffcc', label: 'Aurora',        tags: ['Built-in', 'Dark'] },
    vaporwave:     { bg: '#1a0033', accent: '#ff71ce', label: 'Vaporwave',     tags: ['Built-in', 'Dark'] },
    nord:          { bg: '#2e3440', accent: '#88c0d0', label: 'Nord',          tags: ['Built-in', 'Dark'] },
    solarized:     { bg: '#002b36', accent: '#268bd2', label: 'Solarized',     tags: ['Built-in', 'Dark'] },
    bubblegum:     { bg: '#fce4ec', accent: '#e91e8c', label: 'Bubblegum',     tags: ['Built-in', 'Light'] },
    obsidian:      { bg: '#0a0a0a', accent: '#8b5cf6', label: 'Obsidian',      tags: ['Built-in', 'Dark'] },
    sakura:        { bg: '#fff5f7', accent: '#ff6b9d', label: 'Sakura',        tags: ['Built-in', 'Light'] },
    midnight:      { bg: '#0a0a1a', accent: '#6c63ff', label: 'Midnight',      tags: ['Built-in', 'Dark'] },
    forest:        { bg: '#0d1a0d', accent: '#4caf50', label: 'Forest',        tags: ['Built-in', 'Dark'] },
    cyberpunk:     { bg: '#0a0a0f', accent: '#00ff88', label: 'Cyberpunk',     tags: ['Built-in', 'Dark'] },
    pastel:        { bg: '#fdf6f9', accent: '#e8a4c9', label: 'Pastel',        tags: ['Built-in', 'Light'] },
    monochrome:    { bg: '#0d0d0d', accent: '#e0e0e0', label: 'Monochrome',    tags: ['Built-in', 'Dark'] },
    ocean:         { bg: '#0a1628', accent: '#00b4d8', label: 'Ocean',         tags: ['Built-in', 'Dark'] },
    fire:          { bg: '#0d0600', accent: '#ff4500', label: 'Fire',          tags: ['Built-in', 'Dark'] },
    desert:        { bg: '#f5ede0', accent: '#c1440e', label: 'Desert',        tags: ['Built-in', 'Light'] },
    lavender:      { bg: '#1a1228', accent: '#b48ade', label: 'Lavender',      tags: ['Built-in', 'Dark'] },
    coffee:        { bg: '#1a1008', accent: '#c8913f', label: 'Coffee',        tags: ['Built-in', 'Dark'] },
    matrix:        { bg: '#000000', accent: '#00ff41', label: 'Matrix',        tags: ['Built-in', 'Dark'] },
    rose_gold:     { bg: '#2d1b1b', accent: '#e8936b', label: 'Rose Gold',     tags: ['Built-in', 'Dark'] },
    emerald:       { bg: '#0a1a0e', accent: '#2ecc71', label: 'Emerald',       tags: ['Built-in', 'Dark'] },
    dracula:       { bg: '#282a36', accent: '#ff79c6', label: 'Dracula',       tags: ['Built-in', 'Dark'] },
    monokai:       { bg: '#272822', accent: '#a6e22e', label: 'Monokai',       tags: ['Built-in', 'Dark'] },
    catppuccin:    { bg: '#1e1e2e', accent: '#cba6f7', label: 'Catppuccin',    tags: ['Built-in', 'Dark'] },
    gruvbox:       { bg: '#282828', accent: '#fabd2f', label: 'Gruvbox',       tags: ['Built-in', 'Dark'] },
    tokyo_night:   { bg: '#1a1b26', accent: '#7aa2f7', label: 'Tokyo Night',   tags: ['Built-in', 'Dark'] },
    everforest:    { bg: '#2d353b', accent: '#a7c080', label: 'Everforest',    tags: ['Built-in', 'Dark'] },
    arctic:        { bg: '#eceff4', accent: '#5e81ac', label: 'Arctic',        tags: ['Built-in', 'Light'] },
    neon:          { bg: '#0a0010', accent: '#ff00ff', label: 'Neon',          tags: ['Built-in', 'Dark'] },
    midnight_blue: { bg: '#0a0f1e', accent: '#00b4ff', label: 'Midnight Blue', tags: ['Built-in', 'Dark'] },
};

const SERVER_TEMPLATES = [
    { id: '1', name: 'Gaming Community', description: 'Voice channels, LFG, game channels', memberCount: 1200, uses: 340, category: 'Gaming' },
    { id: '2', name: 'Study Group', description: 'Subject channels, library, study rooms', memberCount: 800, uses: 220, category: 'Education' },
    { id: '3', name: 'Music Label', description: 'Release channels, collab rooms, showcases', memberCount: 500, uses: 150, category: 'Music' },
    { id: '4', name: 'Art Studio', description: 'Portfolio, critique, commission channels', memberCount: 600, uses: 180, category: 'Art' },
    { id: '5', name: 'Tech Startup', description: 'Dev channels, standup, PR reviews', memberCount: 450, uses: 130, category: 'Tech' },
    { id: '6', name: 'Book Club', description: 'Reading lists, discussion threads, reviews', memberCount: 350, uses: 95, category: 'Education' },
];

// Portal Check-in Modal
const PortalCheckinModal = ({ portal, onClose }: { portal: PortalInfo; onClose: () => void }) => {
    const { addToast } = useToast();
    const navigate = useNavigate();
    const [joining, setJoining] = useState(false);
    const [joined, setJoined] = useState(false);
    const [iconBroken, setIconBroken] = useState(false);

    const handleJoin = async () => {
        setJoining(true);
        try {
            await api.guilds.join(portal.id);
            setJoined(true);
            addToast({ title: `Joined ${portal.name}!`, description: 'Welcome to the community.', variant: 'success' });
            navigate(`/guild/${portal.id}`);
        } catch {
            addToast({ title: 'Could not join', description: 'This portal may require an invite or no longer be available.', variant: 'error' });
        } finally {
            setJoining(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }} onClick={onClose}>
            <div style={{ width: 'min(520px, 95vw)', background: 'var(--bg-elevated)', borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--stroke)', boxShadow: '0 32px 64px rgba(0,0,0,0.6)', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                {/* Banner */}
                <div
                    style={{
                        height: '180px',
                        position: 'relative',
                        background: portal.bannerUrl
                            ? `url(${portal.bannerUrl}) center/cover`
                            : 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(2, 132, 199, 0.3))',
                    }}
                >
                    <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                        <X size={16} />
                    </button>
                    {portal.verified && (
                        <div style={{ position: 'absolute', top: 16, left: 16, background: 'var(--accent-primary)', borderRadius: '20px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: 'white' }}>
                            <Shield size={12} /> Verified
                        </div>
                    )}
                    {/* Portal icon */}
                    <div style={{ position: 'absolute', bottom: -28, left: 24, width: '56px', height: '56px', borderRadius: '14px', background: 'var(--bg-elevated)', border: '3px solid var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                        {portal.iconHash && !iconBroken ? (
                            <img src={`${API_BASE}/files/${portal.iconHash}`} alt={portal.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setIconBroken(true)} />
                        ) : (
                            portal.name.charAt(0).toUpperCase()
                        )}
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '40px 28px 28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <h2 style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{portal.name}</h2>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {portal.tags.map(tag => (
                                <span key={tag} style={{ fontSize: '11px', padding: '3px 8px', background: 'var(--bg-tertiary)', borderRadius: '6px', color: 'var(--text-secondary)' }}>{tag}</span>
                            ))}
                        </div>
                    </div>

                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>{portal.description}</p>

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: '24px', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{portal.members.toLocaleString()}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={12} /> Members</span>
                        </div>
                        <div style={{ width: '1px', background: 'var(--stroke)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{portal.mutualFriends.length}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><MessageSquare size={12} /> Mutual Friends</span>
                        </div>
                        <div style={{ width: '1px', background: 'var(--stroke)' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <StarRating value={portal.averageRating} readOnly size={14} />
                                <span style={{ fontSize: '16px', fontWeight: 700, color: '#f59e0b' }}>{portal.averageRating.toFixed(1)}</span>
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Star size={12} /> {portal.totalRatings} Ratings</span>
                        </div>
                    </div>

                    {/* Mutual friends */}
                    {portal.mutualFriends.length > 0 && (
                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--stroke)' }}>
                            <div style={{ display: 'flex' }}>
                                {portal.mutualFriends.map((f, i) => (
                                    <div key={f.name} style={{ width: '28px', height: '28px', borderRadius: '50%', background: f.avatar, border: '2px solid var(--bg-tertiary)', marginLeft: i === 0 ? 0 : '-8px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
                                        {f.name[0].toUpperCase()}
                                    </div>
                                ))}
                            </div>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>{portal.mutualFriends.map(f => f.name).join(' and ')}</strong> {portal.mutualFriends.length === 1 ? 'is' : 'are'} already in this portal
                            </span>
                        </div>
                    )}

                    {/* Public indicator */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
                        <Globe size={14} /> {portal.isPublic ? 'Public portal — anyone can join' : 'Limited visibility portal'}
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>Cancel</button>
                        <button
                            onClick={handleJoin}
                            disabled={joining || joined}
                            style={{ flex: 2, padding: '12px', borderRadius: '10px', background: joined ? 'var(--success)' : 'var(--accent-primary)', border: 'none', color: '#111', cursor: joining || joined ? 'default' : 'pointer', fontWeight: 700, fontSize: '14px', transition: 'background 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            {joined ? '✓ Joined!' : joining ? 'Joining...' : `Join ${portal.name}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Federated guild info from remote instances
type FederatedPortalInfo = {
    id: string;
    remoteGuildId: string;
    federationAddress: string;
    name: string;
    description: string | null;
    iconUrl: string | null;
    bannerUrl: string | null;
    memberCount: number;
    onlineCount: number;
    category: string | null;
    tags: string[];
    averageRating: number;
    totalRatings: number;
    instance: {
        id: string;
        baseUrl: string;
        trustLevel: string;
        trustScore: number;
        softwareVersion: string | null;
        lastSeenAt: string | null;
    };
};

// Sanitize a URL for safe use in CSS url() — strips parens and quotes
const safeCssUrl = (url: string): string => url.replace(/[()'"\\]/g, '');

const TRUST_BADGE: Record<string, { color: string; label: string }> = {
    verified: { color: '#10b981', label: 'Verified' },
    manually_trusted: { color: '#3b82f6', label: 'Trusted' },
    auto_discovered: { color: '#6b7280', label: 'Community' },
};

// Federated Join Modal
const FederatedJoinModal = ({ portal, onClose }: { portal: FederatedPortalInfo; onClose: () => void }) => {
    const instanceDomain = (() => {
        try { return new URL(portal.instance.baseUrl).hostname; } catch { return portal.instance.baseUrl; }
    })();
    const trustInfo = TRUST_BADGE[portal.instance.trustLevel] || TRUST_BADGE.auto_discovered;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }} onClick={onClose}>
            <div style={{ width: 'min(520px, 95vw)', background: 'var(--bg-elevated)', borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--stroke)', boxShadow: '0 32px 64px rgba(0,0,0,0.6)', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                {/* Banner */}
                <div
                    style={{
                        height: '180px',
                        position: 'relative',
                        background: portal.bannerUrl
                            ? `url(${safeCssUrl(portal.bannerUrl)}) center/cover`
                            : 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(139, 92, 246, 0.3))',
                    }}
                >
                    <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                        <X size={16} />
                    </button>
                    {/* Trust badge */}
                    <div style={{ position: 'absolute', top: 16, left: 16, background: trustInfo.color, borderRadius: '20px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: 'white' }}>
                        <Shield size={12} /> {trustInfo.label}
                    </div>
                    {/* Instance domain badge */}
                    <div style={{ position: 'absolute', bottom: 16, right: 16, background: 'rgba(0,0,0,0.6)', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Globe size={11} /> {instanceDomain}
                    </div>
                    {/* Guild icon */}
                    <div style={{ position: 'absolute', bottom: -28, left: 24, width: '56px', height: '56px', borderRadius: '14px', background: 'var(--bg-elevated)', border: '3px solid var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                        {portal.iconUrl ? (
                            <img src={portal.iconUrl} alt={portal.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            portal.name.charAt(0).toUpperCase()
                        )}
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '40px 28px 28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <h2 style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{portal.name}</h2>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {portal.tags.map(tag => (
                                <span key={tag} style={{ fontSize: '11px', padding: '3px 8px', background: 'var(--bg-tertiary)', borderRadius: '6px', color: 'var(--text-secondary)' }}>{tag}</span>
                            ))}
                        </div>
                    </div>

                    {portal.description && (
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>{portal.description}</p>
                    )}

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: '24px', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{portal.memberCount.toLocaleString()}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={12} /> Members</span>
                        </div>
                        {portal.onlineCount > 0 && (
                            <>
                                <div style={{ width: '1px', background: 'var(--stroke)' }} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontSize: '20px', fontWeight: 700, color: '#10b981' }}>{portal.onlineCount.toLocaleString()}</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Online</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Instance info bar */}
                    <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', border: '1px solid var(--stroke)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <Globe size={16} color="var(--text-muted)" />
                            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{instanceDomain}</span>
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: `${trustInfo.color}22`, color: trustInfo.color, fontWeight: 600 }}>{trustInfo.label}</span>
                        </div>
                        {portal.instance.softwareVersion && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                Gratonite v{portal.instance.softwareVersion}
                            </div>
                        )}
                    </div>

                    {/* Warning */}
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        This server is hosted on <strong style={{ color: 'var(--text-primary)' }}>{instanceDomain}</strong>. You'll need an account there to join.
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>Cancel</button>
                        <button
                            onClick={() => window.open(portal.instance.baseUrl + '/app/', '_blank')}
                            style={{ flex: 2, padding: '12px', borderRadius: '10px', background: 'var(--accent-primary)', border: 'none', color: '#111', cursor: 'pointer', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        >
                            Visit {instanceDomain} <ExternalLink size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Discover = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('portals');
    const [searchQuery, setSearchQuery] = useState('');
    const [joiningPortal, setJoiningPortal] = useState<PortalInfo | null>(null);
    const [portals, setPortals] = useState<PortalInfo[]>(initialPortals);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [tagFilters, setTagFilters] = useState<string[]>([]);
    const [tagInputValue, setTagInputValue] = useState('');
    const [sortOption, setSortOption] = useState<'members' | 'activity' | 'trending' | 'rating'>('members');
    const [_discoverBots, setDiscoverBots] = useState<any[]>([]);
    const [_discoverThemes, setDiscoverThemes] = useState<any[]>([]);
    const { addToast } = useToast();
    const { setTheme } = useTheme();
    const [isLoading, setIsLoading] = useState(false);
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [federatedPortals, setFederatedPortals] = useState<FederatedPortalInfo[]>([]);
    const [federatedLoading, setFederatedLoading] = useState(false);
    const [selectedFederated, setSelectedFederated] = useState<FederatedPortalInfo | null>(null);
    const [brokenIcons, setBrokenIcons] = useState<Set<string>>(new Set());

    useEffect(() => {
        api.get<string[]>('/guilds/tags').then(tags => {
            if (Array.isArray(tags)) setAvailableTags(tags);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        Promise.allSettled([
        api.botStore.list({ limit: 20 }).then(res => {
            const items: any[] = Array.isArray(res) ? res : (res as any).items ?? [];
            setDiscoverBots(items);
        }).catch(() => {
            addToast({ title: 'Failed to load bots', description: 'Could not fetch bot listings.', variant: 'error' });
        }),

        api.themes.browse().then((raw: any) => {
            const items = Array.isArray(raw) ? raw : raw?.items || [];
            setDiscoverThemes(items);
        }).catch(() => {
            addToast({ title: 'Failed to load themes', description: 'Could not fetch available themes.', variant: 'error' });
        }),
        ]);
    }, []);

    // Fetch federated portals from remote instances
    useEffect(() => {
        if (activeTab !== 'portals') return;
        setFederatedLoading(true);
        api.federation.discoverGuilds({ limit: 20, sort: 'members' })
            .then(results => setFederatedPortals(results))
            .catch(() => { /* Graceful degradation — federation may not be available */ })
            .finally(() => setFederatedLoading(false));
    }, [activeTab]);

    useEffect(() => {
        if (activeTab !== 'portals') return;
        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const rawQuery = searchQuery.trim();
                const hashtag = rawQuery.startsWith('#') ? rawQuery.slice(1) : undefined;
                const textQuery = rawQuery.startsWith('#') ? '' : rawQuery;
                const fetchAllDiscoverableGuilds = async () => {
                    const pageSize = 100;
                    const maxPages = 10;
                    const allGuilds: Awaited<ReturnType<typeof api.guilds.discover>> = [];
                    let offset = 0;
                    for (let page = 0; page < maxPages; page += 1) {
                        const batch = await api.guilds.discover({
                            q: textQuery || undefined,
                            hashtag: hashtag || undefined,
                            category: selectedCategory || undefined,
                            tag: tagFilters.length > 0 ? tagFilters[0] : undefined,
                            sort: sortOption,
                            limit: pageSize,
                            offset,
                        });
                        if (batch.length === 0) break;
                        allGuilds.push(...batch);
                        if (batch.length < pageSize) break;
                        offset += pageSize;
                    }
                    return allGuilds;
                };

                const guilds = await fetchAllDiscoverableGuilds();

                const mapped: PortalInfo[] = guilds.map((g) => ({
                    id: g.id,
                    name: g.name,
                    description: g.description ?? '',
                    bannerUrl: g.bannerHash ? `${API_BASE}/files/${g.bannerHash}` : null,
                    iconHash: g.iconHash ?? null,
                    members: g.memberCount,
                    online: 0,
                    tags: g.tags ?? [],
                    category: g.category ?? null,
                    verified: Boolean((g as any).verified),
                    featured: Boolean(g.featured),
                    isPinned: Boolean(g.isPinned),
                    isPublic: g.isPublic !== false,
                    mutualFriends: [],
                    averageRating: g.averageRating ?? 0,
                    totalRatings: g.totalRatings ?? 0,
                }));

                mapped.sort((a, b) => {
                    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
                    if (sortOption === 'rating') return (b.averageRating - a.averageRating) || (b.totalRatings - a.totalRatings);
                    if (a.featured !== b.featured) return a.featured ? -1 : 1;
                    return b.members - a.members;
                });

                setPortals(mapped);
            } catch {
                addToast({ title: 'Failed to load communities', description: 'Could not fetch discoverable portals.', variant: 'error' });
            } finally {
                setIsLoading(false);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [activeTab, addToast, searchQuery, selectedCategory, tagFilters, sortOption]);

    const renderTabs = () => (
        <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--stroke)', marginBottom: '32px' }}>
            <button
                onClick={() => setActiveTab('portals')}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0 0 12px 0', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                    color: activeTab === 'portals' ? 'var(--text-primary)' : 'var(--text-muted)',
                    borderBottom: activeTab === 'portals' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    transition: 'all 0.2s'
                }}
            >
                <Compass size={18} /> Portals
            </button>
            <button
                onClick={() => setActiveTab('bots')}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0 0 12px 0', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                    color: activeTab === 'bots' ? 'var(--text-primary)' : 'var(--text-muted)',
                    borderBottom: activeTab === 'bots' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    transition: 'all 0.2s'
                }}
            >
                <Bot size={18} /> Bots & Integrations
            </button>
            <button
                onClick={() => setActiveTab('themes')}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0 0 12px 0', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                    color: activeTab === 'themes' ? 'var(--text-primary)' : 'var(--text-muted)',
                    borderBottom: activeTab === 'themes' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    transition: 'all 0.2s'
                }}
            >
                <Palette size={18} /> Themes
            </button>
            <button
                onClick={() => setActiveTab('templates')}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0 0 12px 0', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px',
                    color: activeTab === 'templates' ? 'var(--text-primary)' : 'var(--text-muted)',
                    borderBottom: activeTab === 'templates' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    transition: 'all 0.2s'
                }}
            >
                <Globe size={18} /> Templates
            </button>
        </div>
    );

    const addTagFilter = (tag: string) => {
        const clean = tag.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
        if (clean && !tagFilters.includes(clean)) {
            setTagFilters(prev => [...prev, clean]);
        }
        setTagInputValue('');
    };

    const featuredPortals = portals
        .filter(p => p.featured || (p.averageRating >= 4.0 && p.totalRatings >= 3))
        .sort((a, b) => b.averageRating - a.averageRating)
        .slice(0, 8);

    const renderPortals = () => (
        <>
            {/* Featured Portals hero section */}
            {featuredPortals.length > 0 && (
                <div style={{ marginBottom: '28px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                        <Star size={18} color="#f59e0b" fill="#f59e0b" /> Featured Portals
                    </h2>
                    <div style={{
                        display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px',
                        scrollbarWidth: 'thin', scrollbarColor: 'var(--stroke) transparent',
                    }}>
                        {featuredPortals.map(portal => (
                            <div
                                key={portal.id}
                                className="portal-card hover-lift"
                                onClick={() => setJoiningPortal(portal)}
                                style={{ minWidth: '300px', flex: '0 0 auto', cursor: 'pointer' }}
                            >
                                <div style={{
                                    height: '180px', position: 'relative',
                                    background: portal.bannerUrl
                                        ? `url(${portal.bannerUrl}) center/cover`
                                        : 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(56, 189, 248, 0.25))',
                                }}>
                                    <div style={{ position: 'absolute', bottom: '-20px', left: '16px', width: '44px', height: '44px', borderRadius: '10px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', border: '2px solid var(--stroke)', fontSize: '18px', overflow: 'hidden' }}>
                                        {portal.iconHash && !brokenIcons.has(portal.iconHash) ? (
                                            <img src={`${API_BASE}/files/${portal.iconHash}`} alt={portal.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setBrokenIcons(s => new Set(s).add(portal.iconHash!))} />
                                        ) : (
                                            portal.name.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    {portal.featured && (
                                        <div style={{ position: 'absolute', top: '10px', left: '10px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(245,158,11,0.85)', color: '#fff', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Star size={10} fill="#fff" /> Featured
                                        </div>
                                    )}
                                </div>
                                <div style={{ padding: '28px 16px 16px' }}>
                                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>{portal.name}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                        <StarRating value={portal.averageRating} readOnly size={14} />
                                        <span style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 600 }}>{portal.averageRating.toFixed(1)}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({portal.totalRatings})</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Users size={12} /> {portal.members.toLocaleString()} members
                                        </span>
                                        <span style={{ padding: '6px 16px', fontSize: '12px', background: 'var(--accent-primary)', color: '#111', fontWeight: 600, borderRadius: '8px' }}>Join</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Self-Hosted Servers from federated instances */}
            {federatedPortals.length > 0 && (
                <div style={{ marginBottom: '28px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                        <Globe size={18} color="var(--accent-primary)" /> Self-Hosted Servers
                    </h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                        Communities running on independent Gratonite instances
                    </p>
                    <div style={{
                        display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '8px',
                        scrollbarWidth: 'thin', scrollbarColor: 'var(--stroke) transparent',
                    }}>
                        {federatedPortals.map(portal => {
                            const instanceDomain = (() => { try { return new URL(portal.instance.baseUrl).hostname; } catch { return portal.instance.baseUrl; } })();
                            const trustInfo = TRUST_BADGE[portal.instance.trustLevel] || TRUST_BADGE.auto_discovered;
                            return (
                                <div
                                    key={portal.id}
                                    className="portal-card hover-lift"
                                    onClick={() => setSelectedFederated(portal)}
                                    style={{ minWidth: '300px', flex: '0 0 auto', cursor: 'pointer' }}
                                >
                                    <div style={{
                                        height: '140px', position: 'relative',
                                        background: portal.bannerUrl
                                            ? `url(${safeCssUrl(portal.bannerUrl)}) center/cover`
                                            : 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(139, 92, 246, 0.3))',
                                    }}>
                                        {/* Instance domain badge */}
                                        <div style={{ position: 'absolute', top: '10px', left: '10px', padding: '2px 10px', borderRadius: '999px', background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.9)', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Globe size={10} /> {instanceDomain}
                                        </div>
                                        {/* Trust indicator */}
                                        <div style={{ position: 'absolute', top: '10px', right: '10px', padding: '2px 8px', borderRadius: '999px', background: trustInfo.color, color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <Shield size={9} /> {trustInfo.label}
                                        </div>
                                        {/* Guild icon */}
                                        <div style={{ position: 'absolute', bottom: '-20px', left: '16px', width: '44px', height: '44px', borderRadius: '10px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', border: '2px solid var(--stroke)', fontSize: '18px', overflow: 'hidden' }}>
                                            {portal.iconUrl ? (
                                                <img src={portal.iconUrl} alt={portal.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                portal.name.charAt(0).toUpperCase()
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ padding: '28px 16px 16px' }}>
                                        <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>{portal.name}</div>
                                        {portal.description && (
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {portal.description}
                                            </div>
                                        )}
                                        {portal.tags.length > 0 && (
                                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                                {portal.tags.slice(0, 3).map(tag => (
                                                    <span key={tag} style={{ fontSize: '10px', padding: '2px 7px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '999px', color: 'var(--text-muted)' }}>#{tag}</span>
                                                ))}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Users size={12} /> {portal.memberCount.toLocaleString()} members
                                            </span>
                                            <span style={{ padding: '6px 16px', fontSize: '12px', background: 'var(--accent-primary)', color: '#111', fontWeight: 600, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                Visit <ExternalLink size={10} />
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Filter bar */}
            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Category buttons */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginRight: '4px' }}>Category:</span>
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            style={{
                                borderRadius: '999px',
                                border: '1px solid var(--stroke)',
                                padding: '5px 12px',
                                background: selectedCategory === cat.id ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                color: selectedCategory === cat.id ? '#111' : 'var(--text-secondary)',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Popular tags */}
                {availableTags.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, marginRight: '4px' }}>Tags:</span>
                        {availableTags.slice(0, 12).map(tag => (
                            <button
                                key={tag}
                                onClick={() => {
                                    if (tagFilters.includes(tag)) {
                                        setTagFilters(prev => prev.filter(t => t !== tag));
                                    } else {
                                        setTagFilters(prev => [...prev, tag]);
                                    }
                                }}
                                style={{
                                    borderRadius: '999px',
                                    border: tagFilters.includes(tag) ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                    padding: '4px 10px',
                                    background: tagFilters.includes(tag) ? 'color-mix(in srgb, var(--accent-primary) 15%, transparent)' : 'var(--bg-tertiary)',
                                    color: tagFilters.includes(tag) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                #{tag}
                            </button>
                        ))}
                    </div>
                )}

                {/* Sort + tag filter row */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                        value={sortOption}
                        onChange={e => setSortOption(e.target.value as any)}
                        style={{ padding: '6px 10px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', outline: 'none' }}
                    >
                        <option value="members">Most Members</option>
                        <option value="activity">Active</option>
                        <option value="trending">Trending</option>
                        <option value="rating">Top Rated</option>
                    </select>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: 1 }}>
                        <input
                            type="text"
                            value={tagInputValue}
                            onChange={e => setTagInputValue(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && tagInputValue) { e.preventDefault(); addTagFilter(tagInputValue); } }}
                            placeholder="Filter by tag..."
                            style={{ padding: '6px 10px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', width: '140px' }}
                        />
                        {tagFilters.map(tag => (
                            <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)', border: '1px solid var(--accent-primary)', borderRadius: '999px', fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                #{tag}
                                <button onClick={() => setTagFilters(prev => prev.filter(t => t !== tag))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--accent-primary)', fontSize: '14px', lineHeight: 1 }}>×</button>
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {portals.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                    <Compass size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                    <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No communities to discover yet</p>
                    <p style={{ fontSize: '13px' }}>Public portals will appear here as the community grows.</p>
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '40px' }}>
                {portals.map(portal => (
                    <div key={portal.id} className="portal-card hover-lift" onClick={() => setJoiningPortal(portal)} style={{ cursor: 'pointer' }}>
                        <div
                            style={{
                                height: '140px',
                                position: 'relative',
                                background: portal.bannerUrl
                                    ? `url(${portal.bannerUrl}) center/cover`
                                    : 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(2, 132, 199, 0.3))',
                            }}
                        >
                            <div style={{ position: 'absolute', bottom: '-20px', left: '16px', width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.5)', border: '2px solid var(--stroke)', fontSize: '18px', overflow: 'hidden' }}>
                                {portal.iconHash && !brokenIcons.has(portal.iconHash) ? (
                                    <img src={`${API_BASE}/files/${portal.iconHash}`} alt={portal.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setBrokenIcons(s => new Set(s).add(portal.iconHash!))} />
                                ) : (
                                    portal.name.charAt(0).toUpperCase()
                                )}
                            </div>
                            {portal.isPinned && (
                                <div style={{ position: 'absolute', top: '10px', left: '10px', padding: '2px 8px', borderRadius: '999px', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '11px', fontWeight: 700 }}>
                                    PINNED
                                </div>
                            )}
                            {portal.category && (
                                <div style={{ position: 'absolute', top: '10px', right: '10px', padding: '2px 8px', borderRadius: '999px', background: 'var(--accent-primary)', color: '#111', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                                    {portal.category}
                                </div>
                            )}
                        </div>
                        <div style={{ padding: '28px 16px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <div style={{ fontSize: '16px', fontWeight: 600 }}>{portal.name}</div>
                                {portal.verified && <Shield size={14} color="var(--accent-primary)" />}
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {portal.description}
                            </div>
                            {portal.tags.length > 0 && (
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                    {portal.tags.slice(0, 3).map(tag => (
                                        <span key={tag} style={{ fontSize: '10px', padding: '2px 7px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '999px', color: 'var(--text-muted)' }}>#{tag}</span>
                                    ))}
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', marginBottom: '10px' }}>
                                {portal.averageRating > 0 ? (
                                    <>
                                        <StarRating value={portal.averageRating} readOnly size={12} />
                                        <span style={{ fontSize: '12px', color: '#f59e0b', fontWeight: 600 }}>
                                            {portal.averageRating.toFixed(1)}
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            ({portal.totalRatings})
                                        </span>
                                    </>
                                ) : (
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No ratings yet</span>
                                )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Users size={12} /> {portal.members.toLocaleString()} members
                                </span>
                                <span style={{ padding: '6px 16px', fontSize: '12px', background: 'var(--accent-primary)', color: '#111', fontWeight: 600, borderRadius: '8px' }}>Join</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );

    const botNames: string[] = _discoverBots.map((bot: any) => bot.name || 'Unnamed Bot');
    const botEmojis: string[] = _discoverBots.map(() => '🤖');
    const botDescs: string[] = _discoverBots.map((bot: any) => bot.shortDescription || bot.description || 'No description provided.');
    const botPortalCounts: string[] = _discoverBots.map((bot: any) => String(bot.installCount ?? bot.guildCount ?? 0));

    const renderBots = () => (
        <>
            {filteredBotIndices.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                    <Bot size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                    <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>No bots available yet</p>
                    <p style={{ fontSize: '13px' }}>Bots and integrations will appear here as developers build them.</p>
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {filteredBotIndices.map((i) => ({ bot: botNames[i], i })).map(({ bot, i }) => (
                    <div key={i} className="portal-card hover-lift" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ padding: '20px', flex: 1 }}>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--bg-tertiary), rgba(255,255,255,0.05))', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                                    {botEmojis[i]}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{bot}</h3>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        by <span style={{ color: 'var(--accent-primary)' }}>{_discoverBots[i]?.creatorName || _discoverBots[i]?.developerName || 'Verified Creator'}</span>
                                    </p>
                                </div>
                                <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>Verified</div>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                                {botDescs[i]}
                            </p>
                        </div>
                        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--stroke)', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>In {botPortalCounts[i]} Portals</span>
                            <button onClick={() => navigate('/bot-store')} className="auth-button" style={{ marginTop: 0, padding: '6px 16px', height: 'auto', width: 'auto', fontSize: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'white' }}>
                                View in Bot Store
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '48px', padding: '24px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--accent-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bot size={20} color="var(--accent-primary)" /> Create Your Own Bot
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Build custom commands, set permissions, and publish to the Bot Store.</p>
                </div>
                <button
                    className="auth-button"
                    onClick={() => navigate('/bot-builder')}
                    style={{ marginTop: 0, width: 'auto', padding: '0 24px', background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    Bot Builder <ArrowRight size={16} />
                </button>
            </div>
        </>
    );

    // Start with all built-in themes in SUPPORTED_THEMES order
    const builtinThemes = SUPPORTED_THEMES.map(id => {
        const p = BUILTIN_THEME_PREVIEWS[id] ?? { bg: '#313338', accent: '#5865f2', label: id, tags: ['Built-in'] };
        return { id, name: p.label, bg: p.bg, accent: p.accent, tags: p.tags, builtin: true };
    });

    // Merge DB/community themes — override built-in entry if same id, else append
    const dbThemeMap = new Map<string, { id: string; name: string; bg: string; accent: string; tags: string[]; builtin: boolean }>();
    (_discoverThemes ?? []).forEach((theme: any) => {
        const id = String(theme.id || '').trim();
        const normalizedId = (SUPPORTED_THEMES.includes(id as AppTheme) ? (id as AppTheme) : id) as AppTheme;
        const base = theme.variables || theme.vars || {};
        const bg = base['--bg-primary'] || base['--bg-app'] || base['background'] || theme.previewBackground || '#111214';
        const accent = base['--accent-primary'] || theme.accent || '#5865f2';
        const tags = Array.isArray(theme.tags) && theme.tags.length > 0 ? theme.tags : ['Community'];
        dbThemeMap.set(normalizedId, { id: normalizedId, name: theme.name || normalizedId, bg, accent, tags, builtin: false });
    });

    const allThemes = builtinThemes.map(t => dbThemeMap.has(t.id) ? dbThemeMap.get(t.id)! : t)
        .concat([...dbThemeMap.values()].filter(t => !SUPPORTED_THEMES.includes(t.id as AppTheme)));

    const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);

    const q = searchQuery.toLowerCase().trim();
    const filteredBotIndices = q ? botNames.map((b, i) => ({ b, i })).filter(({ b }) => b.toLowerCase().includes(q)).map(({ i }) => i) : botNames.map((_, i) => i);
    const filteredThemes = q ? allThemes.filter(t => t.name.toLowerCase().includes(q) || t.tags.some((tag: string) => tag.toLowerCase().includes(q))) : allThemes;

    const renderTemplates = () => {
        const filtered = searchQuery
            ? SERVER_TEMPLATES.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase()))
            : SERVER_TEMPLATES;
        return (
            <>
                <div style={{ marginBottom: '24px' }}>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Start your server with a pre-built template. Channels, roles, and permissions included.</p>
                </div>
                {filtered.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '32px' }}>No templates match "{searchQuery}"</p>}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {filtered.map(template => (
                        <div key={template.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'border-color 0.2s' }}
                            onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
                            onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--stroke)')}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{template.name}</h3>
                                    <span style={{ fontSize: '11px', padding: '2px 8px', background: 'var(--bg-tertiary)', borderRadius: '6px', color: 'var(--text-muted)' }}>{template.category}</span>
                                </div>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{template.description}</p>
                            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Users size={12} /> {template.uses} uses</span>
                            </div>
                            <button
                                onClick={() => { addToast({ title: 'Template Applied', description: `"${template.name}" template will be used when creating a new server.`, variant: 'success' }); }}
                                style={{ marginTop: 'auto', padding: '8px 16px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                            >
                                Use Template
                            </button>
                        </div>
                    ))}
                </div>
            </>
        );
    };

    const renderThemes = () => (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Click any theme to instantly apply it.</p>
            </div>
            {filteredThemes.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '32px' }}>No themes match "{searchQuery}"</p>}
            <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                {filteredThemes.map((theme) => (
                    <div key={theme.id}
                        onMouseEnter={() => setHoveredTheme(theme.id)}
                        onMouseLeave={() => setHoveredTheme(null)}
                        className="portal-card"
                        style={{ padding: '12px', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', transform: hoveredTheme === theme.id ? 'translateY(-4px)' : 'none', boxShadow: hoveredTheme === theme.id ? '0 8px 24px rgba(0,0,0,0.3)' : 'none' }}
                        onClick={() => {
                            setTheme(theme.id as AppTheme);
                            addToast({ title: `"${theme.name}" Applied`, description: 'Your theme has been updated!', variant: 'success' });
                        }}
                    >
                        {/* Theme preview card */}
                        <div style={{ height: '110px', background: theme.bg, borderRadius: 'var(--radius-sm)', marginBottom: '12px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                            {/* Fake sidebar */}
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '28px', background: 'rgba(0,0,0,0.3)' }} />
                            {/* Fake chat bubbles */}
                            <div style={{ position: 'absolute', left: 36, top: 12, right: 12, height: '12px', background: theme.accent, borderRadius: '6px', opacity: 0.9 }} />
                            <div style={{ position: 'absolute', left: 36, top: 30, right: 28, height: '10px', background: 'rgba(255,255,255,0.2)', borderRadius: '6px' }} />
                            <div style={{ position: 'absolute', left: 36, top: 46, right: 40, height: '10px', background: 'rgba(255,255,255,0.15)', borderRadius: '6px' }} />
                            {/* Fake input */}
                            <div style={{ position: 'absolute', left: 36, bottom: 10, right: 12, height: '18px', background: 'rgba(0,0,0,0.3)', borderRadius: '9px', border: `1px solid ${theme.accent}40` }} />
                            {/* Live indicator */}
                            {hoveredTheme === theme.id && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'white', background: theme.accent, padding: '6px 16px', borderRadius: '20px' }}>Apply Theme</span>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>{theme.name}</h3>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {theme.tags.map((tag: string) => (
                                <span key={tag} style={{ fontSize: '10px', padding: '2px 6px', background: 'var(--bg-tertiary)', borderRadius: '4px', color: 'var(--text-secondary)' }}>{tag}</span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: '48px', padding: '24px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--accent-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Palette size={20} color="var(--accent-primary)" /> Create Your Own Theme
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Use the Gratonite Theme Engine to build custom CSS layouts and dynamic backgrounds.</p>
                </div>
                <button
                    className="auth-button"
                    onClick={() => navigate('/theme-builder')}
                    style={{ marginTop: 0, width: 'auto', padding: '0 24px', background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    Theme Builder <ArrowRight size={16} />
                </button>
            </div>
        </>
    );

    return (
        <>
            <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 24px', width: '100%' }}>
                    <h1 style={{ fontSize: '32px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>Discover</h1>
                    <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '32px' }}>Find communities, bots, and themes to enhance your experience.</p>

                    <div style={{ position: 'relative', marginBottom: '32px' }}>
                        <Search size={20} style={{ position: 'absolute', left: 16, top: 14, color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ width: '100%', height: '48px', paddingLeft: '48px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', fontSize: '15px' }}
                            placeholder={`Search for ${activeTab}...`}
                        />
                    </div>

                    {/* Self-hosting banner */}
                    {!localStorage.getItem('dismiss-self-host-banner') && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '12px 16px', marginBottom: '20px', borderRadius: 'var(--radius-md)',
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(168,85,247,0.06))',
                            border: '1px solid rgba(99,102,241,0.2)',
                        }}>
                            <Server size={18} style={{ color: '#818cf8', flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>Want your own server?</strong>{' '}
                                Self-host Gratonite in 5 minutes. Full control, same features.{' '}
                                <a href="https://gratonite.chat/docs/self-hosting" target="_blank" rel="noreferrer"
                                   style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}>
                                    Learn more
                                </a>
                            </span>
                            <button
                                onClick={() => { localStorage.setItem('dismiss-self-host-banner', '1'); window.location.reload(); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    {renderTabs()}

                    <div className="discover-content">
                        {isLoading ? (
                            <div style={{ padding: 24 }}>
                                <div className="skeleton-pulse" style={{ width: '60%', height: 24, borderRadius: 6, marginBottom: 16 }} />
                                <div className="skeleton-pulse" style={{ width: '100%', height: 120, borderRadius: 8, marginBottom: 12 }} />
                                <div className="skeleton-pulse" style={{ width: '100%', height: 120, borderRadius: 8, marginBottom: 12 }} />
                                <div className="skeleton-pulse" style={{ width: '80%', height: 120, borderRadius: 8 }} />
                            </div>
                        ) : (
                            <>
                                {activeTab === 'portals' && renderPortals()}
                                {activeTab === 'bots' && renderBots()}
                                {activeTab === 'themes' && renderThemes()}
                                {activeTab === 'templates' && renderTemplates()}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {joiningPortal && (
                <PortalCheckinModal portal={joiningPortal} onClose={() => setJoiningPortal(null)} />
            )}

            {selectedFederated && (
                <FederatedJoinModal portal={selectedFederated} onClose={() => setSelectedFederated(null)} />
            )}
        </>
    );
};

export default Discover;
