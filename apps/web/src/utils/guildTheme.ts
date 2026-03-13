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
