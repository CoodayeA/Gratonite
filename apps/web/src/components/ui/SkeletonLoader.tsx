import React from 'react';
import Skeleton from './Skeleton';

/* ────────────────────────────────────────────
   Reusable skeleton compositions for common
   loading placeholders across the app.
   Uses the existing Skeleton primitive which
   relies on the .skeleton-box CSS class.
   ──────────────────────────────────────────── */

/** A single message-row skeleton (avatar + name + text lines) */
export const SkeletonMessageRow = ({ grouped = false }: { grouped?: boolean }) => (
    <div className="gt-skeleton-state gt-skeleton-message-row" style={{
        display: 'flex',
        gap: '12px',
        padding: grouped ? '4px 16px' : '16px 16px 4px 16px',
        alignItems: 'flex-start',
    }}>
        {!grouped ? (
            <Skeleton variant="circle" width={40} height={40} style={{ flexShrink: 0 }} />
        ) : (
            <div style={{ width: 40, flexShrink: 0 }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
            {!grouped && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Skeleton variant="text" width={randomBetween(80, 140)} height={14} />
                    <Skeleton variant="text" width={48} height={10} />
                </div>
            )}
            <Skeleton variant="text" width={`${randomBetween(50, 95)}%`} height={14} />
            {!grouped && Math.random() > 0.4 && (
                <Skeleton variant="text" width={`${randomBetween(30, 70)}%`} height={14} />
            )}
        </div>
    </div>
);

/** Multiple message-row skeletons, optionally with grouping feel */
export const SkeletonMessageList = ({ count = 6 }: { count?: number }) => {
    // Precompute the skeleton pattern once so it stays stable across re-renders
    const rows = React.useMemo(() => {
        const items: { key: number; grouped: boolean }[] = [];
        for (let i = 0; i < count; i++) {
            items.push({ key: i, grouped: i > 0 && i % 3 !== 0 });
        }
        return items;
    }, [count]);

    return (
        <div className="gt-skeleton-state gt-skeleton-message-list" style={{ padding: '8px 0' }}>
            {rows.map(r => (
                <SkeletonMessageRow key={r.key} grouped={r.grouped} />
            ))}
        </div>
    );
};

/** Channel-list sidebar item skeleton */
export const SkeletonChannelItem = () => (
    <div className="gt-skeleton-state gt-skeleton-channel-item" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        margin: '0 8px',
        borderRadius: '6px',
    }}>
        <Skeleton variant="rect" width={20} height={20} style={{ borderRadius: '4px', flexShrink: 0 }} />
        <Skeleton variant="text" width={randomBetween(60, 130)} height={14} />
    </div>
);

/** Category header skeleton + a few channel items */
export const SkeletonChannelGroup = ({ channels = 3 }: { channels?: number }) => (
    <div className="gt-skeleton-state gt-skeleton-channel-group" style={{ marginBottom: '8px' }}>
        <div style={{ padding: '8px 16px 4px' }}>
            <Skeleton variant="text" width={randomBetween(70, 120)} height={10} />
        </div>
        {Array.from({ length: channels }).map((_, i) => (
            <SkeletonChannelItem key={`skeleton-channel-${i}`} />
        ))}
    </div>
);

/** Skeleton for a user/member row in the members sidebar */
export const SkeletonMemberItem = () => (
    <div className="gt-skeleton-state gt-skeleton-member-item" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '6px 12px',
        margin: '0 8px',
        borderRadius: '6px',
    }}>
        <Skeleton variant="circle" width={32} height={32} style={{ flexShrink: 0 }} />
        <Skeleton variant="text" width={randomBetween(60, 120)} height={14} />
    </div>
);

/** Member sidebar skeleton: category header + member rows */
export const SkeletonMemberList = ({ count = 8 }: { count?: number }) => (
    <div className="gt-skeleton-state gt-skeleton-member-list" style={{ padding: '8px 0' }}>
        <div style={{ padding: '8px 16px 4px' }}>
            <Skeleton variant="text" width={90} height={10} />
        </div>
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonMemberItem key={`skeleton-member-${i}`} />
        ))}
    </div>
);

/** DM conversation skeleton item (avatar + name) */
export const SkeletonDmItem = () => (
    <div className="gt-skeleton-state gt-skeleton-dm-item" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        margin: '0 8px',
        borderRadius: '6px',
    }}>
        <Skeleton variant="circle" width={32} height={32} style={{ flexShrink: 0 }} />
        <Skeleton variant="text" width={randomBetween(70, 140)} height={14} />
    </div>
);

/** DM list skeleton */
export const SkeletonDmList = ({ count = 5 }: { count?: number }) => (
    <div className="gt-skeleton-state gt-skeleton-dm-list" style={{ padding: '4px 0' }}>
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonDmItem key={`skeleton-dm-${i}`} />
        ))}
    </div>
);

/** Friend row skeleton */
export const SkeletonFriendItem = () => (
    <div className="gt-skeleton-state gt-skeleton-friend-item" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderBottom: '1px solid var(--stroke)',
    }}>
        <Skeleton variant="circle" width={40} height={40} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Skeleton variant="text" width={randomBetween(80, 160)} height={14} />
            <Skeleton variant="text" width={randomBetween(40, 80)} height={10} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
            <Skeleton variant="circle" width={32} height={32} />
            <Skeleton variant="circle" width={32} height={32} />
        </div>
    </div>
);

/** Friends list skeleton */
export const SkeletonFriendList = ({ count = 5 }: { count?: number }) => (
    <div className="gt-skeleton-state gt-skeleton-friend-list">
        <div style={{ padding: '0 0 8px 0' }}>
            <Skeleton variant="text" width={120} height={10} style={{ marginBottom: '8px' }} />
        </div>
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonFriendItem key={`skeleton-friend-${i}`} />
        ))}
    </div>
);

/** Profile page skeleton: avatar + name + bio + stats */
export const SkeletonProfile = () => (
    <div className="gt-skeleton-state gt-skeleton-profile" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <Skeleton variant="circle" width={80} height={80} />
        <Skeleton variant="text" width={140} height={20} />
        <Skeleton variant="text" width={200} height={14} />
        <div style={{ display: 'flex', gap: '24px', marginTop: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <Skeleton variant="text" width={32} height={18} />
                <Skeleton variant="text" width={50} height={10} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <Skeleton variant="text" width={32} height={18} />
                <Skeleton variant="text" width={50} height={10} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <Skeleton variant="text" width={32} height={18} />
                <Skeleton variant="text" width={50} height={10} />
            </div>
        </div>
    </div>
);

/** Shop card grid skeleton */
export const SkeletonShopGrid = ({ count = 8 }: { count?: number }) => (
    <div className="gt-skeleton-state gt-skeleton-shop-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
        {Array.from({ length: count }).map((_, i) => (
            <div key={`skeleton-shop-${i}`} className="gt-skeleton-card" style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--stroke)' }}>
                <Skeleton variant="rect" width="100%" height={160} style={{ borderRadius: 0 }} />
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <Skeleton variant="text" width={randomBetween(100, 180)} height={16} />
                    <Skeleton variant="text" width={randomBetween(60, 120)} height={12} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                        <Skeleton variant="text" width={60} height={14} />
                        <Skeleton variant="rect" width={80} height={32} style={{ borderRadius: '8px' }} />
                    </div>
                </div>
            </div>
        ))}
    </div>
);

/** Settings panel skeleton: sidebar + content area */
export const SkeletonSettingsPanel = () => (
    <div className="gt-skeleton-state gt-skeleton-settings-panel" style={{ display: 'flex', gap: '24px', padding: '24px' }}>
        <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={`skeleton-setting-${i}`} variant="text" width={randomBetween(100, 180)} height={32} style={{ borderRadius: '6px' }} />
            ))}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Skeleton variant="text" width={200} height={24} />
            <Skeleton variant="text" width="80%" height={14} />
            <Skeleton variant="rect" width="100%" height={48} style={{ borderRadius: '8px' }} />
            <Skeleton variant="rect" width="100%" height={48} style={{ borderRadius: '8px' }} />
            <Skeleton variant="rect" width="100%" height={48} style={{ borderRadius: '8px' }} />
        </div>
    </div>
);

/** Leaderboard row skeleton: rank + avatar + name + score */
export const SkeletonLeaderboardRow = ({ highlighted = false }: { highlighted?: boolean }) => (
    <div className="gt-skeleton-state gt-skeleton-leaderboard-row" style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 8px', borderRadius: 'var(--radius-md)',
        background: highlighted ? 'var(--bg-elevated)' : 'transparent',
        marginBottom: '4px',
        border: highlighted ? '1px solid var(--stroke)' : 'none',
    }}>
        <Skeleton variant="text" width={20} height={14} />
        <Skeleton variant="circle" width={36} height={36} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <Skeleton variant="text" width={`${randomBetween(50, 80)}%`} height={14} />
            <Skeleton variant="text" width={`${randomBetween(25, 45)}%`} height={10} />
        </div>
        <Skeleton variant="text" width={48} height={14} />
    </div>
);

/** Leaderboard list skeleton: top-3 highlighted, rest plain */
export const SkeletonLeaderboardList = ({ count = 8 }: { count?: number }) => (
    <div className="gt-skeleton-state gt-skeleton-leaderboard-list">
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonLeaderboardRow key={`skeleton-lb-${i}`} highlighted={i < 3} />
        ))}
    </div>
);

/** Activity feed row skeleton: avatar + 2 text lines + timestamp */
export const SkeletonActivityFeed = ({ count = 6 }: { count?: number }) => (
    <div className="gt-skeleton-state gt-skeleton-activity-feed" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {Array.from({ length: count }).map((_, i) => (
            <div key={`skeleton-activity-${i}`} style={{
                display: 'flex', alignItems: 'flex-start', gap: '12px',
                padding: '12px 8px', borderBottom: '1px solid var(--stroke)',
            }}>
                <Skeleton variant="circle" width={36} height={36} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <Skeleton variant="text" width={`${randomBetween(60, 90)}%`} height={13} />
                    <Skeleton variant="text" width={`${randomBetween(30, 55)}%`} height={10} />
                </div>
            </div>
        ))}
    </div>
);

/** Moderation actions list skeleton: stats cards + chart + recent actions list */
export const SkeletonModDashboard = ({ rows = 6 }: { rows?: number }) => (
    <div className="gt-skeleton-state gt-skeleton-mod-dashboard">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={`skel-mod-stat-${i}`} style={{
                    background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                    padding: '16px', border: '1px solid var(--stroke)',
                    display: 'flex', flexDirection: 'column', gap: '8px',
                }}>
                    <Skeleton variant="text" width={120} height={11} />
                    <Skeleton variant="text" width={48} height={22} />
                </div>
            ))}
        </div>
        <div style={{
            background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '16px',
            border: '1px solid var(--stroke)', marginBottom: '24px',
        }}>
            <Skeleton variant="text" width={180} height={14} style={{ marginBottom: '12px' }} />
            <Skeleton variant="rect" width="100%" height={120} />
        </div>
        <div style={{
            background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '16px',
            border: '1px solid var(--stroke)',
        }}>
            <Skeleton variant="text" width={150} height={14} style={{ marginBottom: '12px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={`skel-mod-row-${i}`} style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '8px',
                        borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)',
                    }}>
                        <Skeleton variant="circle" width={24} height={24} style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <Skeleton variant="text" width={`${randomBetween(40, 70)}%`} height={12} />
                            <Skeleton variant="text" width={`${randomBetween(20, 40)}%`} height={10} />
                        </div>
                        <Skeleton variant="text" width={56} height={10} />
                    </div>
                ))}
            </div>
        </div>
    </div>
);

/** Bot store card grid skeleton: avatar + name + tagline + stats row */
export const SkeletonBotCardGrid = ({ count = 8 }: { count?: number }) => (
    <div className="gt-skeleton-state gt-skeleton-bot-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '16px', marginBottom: '32px',
    }}>
        {Array.from({ length: count }).map((_, i) => (
            <div key={`skel-bot-${i}`} style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                borderRadius: '12px', padding: '24px',
                display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Skeleton variant="rect" width={48} height={48} style={{ borderRadius: '12px', flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <Skeleton variant="text" width={`${randomBetween(50, 80)}%`} height={14} />
                        <Skeleton variant="text" width={`${randomBetween(30, 55)}%`} height={10} />
                    </div>
                </div>
                <Skeleton variant="text" width="100%" height={12} />
                <Skeleton variant="text" width={`${randomBetween(60, 90)}%`} height={12} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                    <Skeleton variant="text" width={70} height={11} />
                    <Skeleton variant="rect" width={72} height={28} style={{ borderRadius: '8px' }} />
                </div>
            </div>
        ))}
    </div>
);

/** Data export list skeleton: status icon + status label + date + action */
export const SkeletonExportList = ({ count = 3 }: { count?: number }) => (
    <div className="gt-skeleton-state gt-skeleton-export-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Skeleton variant="text" width={140} height={13} style={{ marginBottom: '4px' }} />
        {Array.from({ length: count }).map((_, i) => (
            <div key={`skel-export-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
                <Skeleton variant="circle" width={20} height={20} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Skeleton variant="text" width={`${randomBetween(30, 55)}%`} height={12} />
                    <Skeleton variant="text" width={`${randomBetween(20, 40)}%`} height={10} />
                </div>
                <Skeleton variant="rect" width={68} height={26} style={{ borderRadius: '6px' }} />
            </div>
        ))}
    </div>
);

/* ── helpers ──────────────────────────────── */

/** Return a deterministic-ish random int for widths. Uses a simple seeded approach
 *  but since these are decorative placeholders, Math.random is fine.
 *  The values are computed at module-parse time for each call site,
 *  so they stay stable within a single render cycle. */
function randomBetween(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min));
}
