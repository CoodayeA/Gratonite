import React, { useState, useRef, useCallback } from 'react';
import { API_BASE, getAccessToken } from '../../lib/api';
import Avatar from '../ui/Avatar';
import { ReactionSummaryPopover } from './ReactionSummaryPopover';

export const ReactionBadge = ({ emoji, emojiUrl, isCustom, count, me, messageApiId, channelId, onReaction }: { emoji: string; emojiUrl?: string; isCustom?: boolean; count: number; me: boolean; messageApiId?: string; channelId?: string; onReaction?: (apiId: string, emoji: string, me: boolean) => void }) => {
    const [tooltip, setTooltip] = useState<{ users: Array<{ id?: string; displayName?: string; username: string; avatarHash?: string | null }>; total: number } | null>(null);
    const [bouncing, setBouncing] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleMouseEnter = () => {
        if (!messageApiId || !channelId) return;
        timerRef.current = setTimeout(() => {
            fetch(`${API_BASE}/channels/${channelId}/messages/${messageApiId}/reactions/${encodeURIComponent(emoji)}`, {
                headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
            }).then(r => r.ok ? r.json() : []).then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setTooltip({ users: data.slice(0, 5), total: count });
                }
            }).catch(() => {});
        }, 300);
    };

    const handleMouseLeave = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setTooltip(null);
    };

    // Debounce rapid reaction toggles to prevent duplicate API calls
    const handleClick = useCallback(() => {
        if (!messageApiId) return;
        setBouncing(true);
        setTimeout(() => setBouncing(false), 350);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            onReaction?.(messageApiId, emoji, me);
        }, 500);
    }, [messageApiId, emoji, me, onReaction]);

    const [showAllReactors, setShowAllReactors] = useState(false);

    return (
        <>
            <button
                onClick={handleClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className={bouncing ? 'reaction-bounce' : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', background: me ? 'rgba(var(--accent-primary-rgb, 139,92,246), 0.15)' : 'var(--bg-tertiary)', border: `1px solid ${me ? 'var(--accent-primary)' : 'var(--stroke)'}`, cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', transition: 'all 0.15s', position: 'relative' }}
            >
                {isCustom && emojiUrl ? <img src={emojiUrl} width={16} height={16} alt={emoji} style={{ verticalAlign: 'middle' }} loading="lazy" /> : <span>{emoji}</span>} <span style={{ fontSize: '11px', fontWeight: 600 }}>{count}</span>
                {tooltip && (
                    <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '8px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 50, minWidth: '120px', fontSize: '12px', color: 'var(--text-primary)', pointerEvents: 'auto' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {tooltip.users.map((u, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Avatar userId={u.id || ''} displayName={u.displayName || u.username} avatarHash={u.avatarHash} size={20} />
                                    <span style={{ whiteSpace: 'nowrap' }}>{u.displayName || u.username}</span>
                                </div>
                            ))}
                        </div>
                        {tooltip.total > 5 && (
                            <div style={{ marginTop: '4px', color: 'var(--text-muted)', fontSize: '11px' }}>
                                and {tooltip.total - 5} more...
                                <button onClick={(e) => { e.stopPropagation(); setShowAllReactors(true); }} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '11px', padding: '0 4px', fontWeight: 600 }}>View all</button>
                            </div>
                        )}
                    </div>
                )}
            </button>
            {showAllReactors && messageApiId && channelId && (
                <ReactionSummaryPopover emoji={emoji} emojiUrl={emojiUrl} isCustom={isCustom} count={count} messageApiId={messageApiId} channelId={channelId} />
            )}
        </>
    );
};

export default ReactionBadge;
