const STORAGE_KEY = 'gratonite-guild-themes';

export type GuildThemeMap = Record<string, string>; // guildId → theme name

/** Get all per-guild theme overrides */
export function getGuildThemes(): GuildThemeMap {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

/** Get theme override for a specific guild */
export function getGuildTheme(guildId: string): string | null {
    const map = getGuildThemes();
    return map[guildId] || null;
}

/** Set theme override for a specific guild */
export function setGuildTheme(guildId: string, theme: string): void {
    const map = getGuildThemes();
    map[guildId] = theme;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('gratonite:guild-theme-changed', { detail: { guildId, theme } }));
}

/** Remove theme override for a specific guild */
export function removeGuildTheme(guildId: string): void {
    const map = getGuildThemes();
    delete map[guildId];
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('gratonite:guild-theme-changed', { detail: { guildId, theme: null } }));
}

/** Check if a guild has a custom theme */
export function hasGuildTheme(guildId: string): boolean {
    return !!getGuildTheme(guildId);
}

// ── Item 24: Per-channel theme overrides ──

const CHANNEL_THEME_KEY = 'gratonite-channel-themes';

export type ChannelThemeMap = Record<string, string>; // channelId → theme id

/** Get all per-channel theme overrides */
export function getChannelThemes(): ChannelThemeMap {
    try {
        const raw = localStorage.getItem(CHANNEL_THEME_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

/** Get theme override for a specific channel */
export function getChannelTheme(channelId: string): string | null {
    const map = getChannelThemes();
    return map[channelId] || null;
}

/** Set theme override for a specific channel */
export function setChannelTheme(channelId: string, themeId: string): void {
    const map = getChannelThemes();
    map[channelId] = themeId;
    try {
        localStorage.setItem(CHANNEL_THEME_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('gratonite:channel-theme-changed', { detail: { channelId, themeId } }));
}

/** Remove theme override for a specific channel */
export function removeChannelTheme(channelId: string): void {
    const map = getChannelThemes();
    delete map[channelId];
    try {
        localStorage.setItem(CHANNEL_THEME_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('gratonite:channel-theme-changed', { detail: { channelId, themeId: null } }));
}

/** Check if a channel has a custom theme */
export function hasChannelTheme(channelId: string): boolean {
    return !!getChannelTheme(channelId);
}
