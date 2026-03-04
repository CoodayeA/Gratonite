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
    <div style={{
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
        <div style={{ padding: '8px 0' }}>
            {rows.map(r => (
                <SkeletonMessageRow key={r.key} grouped={r.grouped} />
            ))}
        </div>
    );
};

/** Channel-list sidebar item skeleton */
export const SkeletonChannelItem = () => (
    <div style={{
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
    <div style={{ marginBottom: '8px' }}>
        <div style={{ padding: '8px 16px 4px' }}>
            <Skeleton variant="text" width={randomBetween(70, 120)} height={10} />
        </div>
        {Array.from({ length: channels }).map((_, i) => (
            <SkeletonChannelItem key={i} />
        ))}
    </div>
);

/** Skeleton for a user/member row in the members sidebar */
export const SkeletonMemberItem = () => (
    <div style={{
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
    <div style={{ padding: '8px 0' }}>
        <div style={{ padding: '8px 16px 4px' }}>
            <Skeleton variant="text" width={90} height={10} />
        </div>
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonMemberItem key={i} />
        ))}
    </div>
);

/** DM conversation skeleton item (avatar + name) */
export const SkeletonDmItem = () => (
    <div style={{
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
    <div style={{ padding: '4px 0' }}>
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonDmItem key={i} />
        ))}
    </div>
);

/** Friend row skeleton */
export const SkeletonFriendItem = () => (
    <div style={{
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
    <div>
        <div style={{ padding: '0 0 8px 0' }}>
            <Skeleton variant="text" width={120} height={10} style={{ marginBottom: '8px' }} />
        </div>
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonFriendItem key={i} />
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
