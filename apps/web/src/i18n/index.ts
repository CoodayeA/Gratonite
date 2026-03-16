/**
 * Internationalization system (Feature 12: Full i18n Coverage).
 * Supports 9 locales with 200+ keys, string interpolation, and dynamic loading.
 */
import { applyDirection } from '../utils/rtl';

// Import all locale files
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import pt from './locales/pt.json';
import ja from './locales/ja.json';

// Lazy-loaded locales (loaded on demand)
let zh: Record<string, string> | null = null;
let ko: Record<string, string> | null = null;
let ar: Record<string, string> | null = null;

export type Locale = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'ja' | 'zh' | 'ko' | 'ar';

const staticTranslations: Record<string, Record<string, string>> = {
    en, es, fr, de, pt, ja,
};

async function loadLocale(locale: Locale): Promise<Record<string, string>> {
    if (staticTranslations[locale]) return staticTranslations[locale];
    switch (locale) {
        case 'zh':
            if (!zh) zh = (await import('./locales/zh.json')).default;
            return zh;
        case 'ko':
            if (!ko) ko = (await import('./locales/ko.json')).default;
            return ko;
        case 'ar':
            if (!ar) ar = (await import('./locales/ar.json')).default;
            return ar;
        default:
            return en;
    }
}

let currentLocale: Locale = 'en';
let currentTranslations: Record<string, string> = en;

export function setLocale(locale: Locale): void {
    currentLocale = locale;
    localStorage.setItem('gratonite:locale', locale);
    applyDirection(locale);

    // Load translations (sync for static, async for lazy)
    if (staticTranslations[locale]) {
        currentTranslations = staticTranslations[locale];
        window.dispatchEvent(new CustomEvent('gratonite:locale-changed'));
    } else {
        loadLocale(locale).then(translations => {
            currentTranslations = translations;
            window.dispatchEvent(new CustomEvent('gratonite:locale-changed'));
        });
    }
}

export function getLocale(): Locale {
    return currentLocale;
}

/**
 * Translate a key with optional interpolation and plural support.
 *
 * Interpolation: t('chat.typing', { user: 'Alice' }) => "Alice is typing..."
 * Plurals: t('guild.member_count', { count: 5 }) => "5 members"
 *   If a key_one / key_other variant exists, it is used for count === 1 / otherwise.
 */
export function t(key: string, params?: Record<string, string | number>): string {
    let text: string | undefined;

    // Plural resolution: look for key_one / key_other when count is provided
    if (params && typeof params.count === 'number') {
        const pluralSuffix = params.count === 1 ? '_one' : '_other';
        text =
            currentTranslations[key + pluralSuffix] ??
            (en as Record<string, string>)[key + pluralSuffix];
    }

    // Fall back to the base key
    if (!text) {
        text = currentTranslations[key] ?? (en as Record<string, string>)[key] ?? key;
    }

    // Interpolate {param} tokens
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
    }
    return text;
}

export function initI18n(): void {
    const saved = localStorage.getItem('gratonite:locale') as Locale | null;
    if (saved && AVAILABLE_LOCALES.some(l => l.code === saved)) {
        setLocale(saved);
    }
}

// Re-export RTL utilities for convenience
export { isRtlLocale, getDirection, applyDirection } from '../utils/rtl';

export const AVAILABLE_LOCALES: Array<{ code: Locale; name: string; nativeName: string }> = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' },
    { code: 'ko', name: 'Korean', nativeName: '한국어' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
];
