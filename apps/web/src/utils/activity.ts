// ─── Activity Types ──────────────────────────────────────────────────────────

export type ActivityType = 'game' | 'music' | 'streaming' | 'watching';

export interface ActivityEntry {
    id: string;
    type: ActivityType;
    name: string;
    details?: string;
    state?: string;
    platform?: 'steam' | 'epic' | 'xbox' | 'playstation' | 'spotify' | 'crunchyroll' | 'twitch';
    startedAt: number;
    isRichPresence?: boolean;
}

export interface RegisteredGame {
    id: string;
    name: string;
    platform: string;
    enabled: boolean;
    lastPlayed?: number;
    coverColor: string;
}

export interface ActivityHistoryEntry {
    id: string;
    activityName: string;
    platform: string;
    startedAt: number;
    endedAt: number;
    duration: number; // ms
}

/**
 * Formats elapsed milliseconds into a human-readable duration string.
 */
export function formatElapsed(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return '<1m';
}

/**
 * Formats a timestamp into a relative date string.
 */
export function formatRelativeDate(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const DAY = 86400000;

    if (diff < DAY) return 'Today';
    if (diff < 2 * DAY) return 'Yesterday';
    const days = Math.floor(diff / DAY);
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
    return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
}
