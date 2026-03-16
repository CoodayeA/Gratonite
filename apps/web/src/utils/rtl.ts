/**
 * RTL Layout Support (Feature 13).
 * Utilities for detecting and applying right-to-left layout direction.
 */

const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ku', 'yi']);

export function isRtlLocale(locale: string): boolean {
    // Handle locale codes like 'ar-SA', 'he-IL'
    const base = locale.split('-')[0].toLowerCase();
    return RTL_LOCALES.has(base);
}

export function getDirection(locale: string): 'ltr' | 'rtl' {
    return isRtlLocale(locale) ? 'rtl' : 'ltr';
}

/**
 * Apply text direction to the document root element.
 * Call this whenever the locale changes.
 */
export function applyDirection(locale: string): void {
    const dir = getDirection(locale);
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;
}
