import '../../themes/overrides/neobrutalism.css';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { resolveTheme, addRecentTheme, getScheduledTheme } from '../../themes/registry';
import { applyThemeSync, applyThemeWithTransition } from '../../themes/injector';
import type { ThemeVariables } from '../../themes/types';

export type AppTheme = string; // Now accepts any theme ID (preset or custom)
export type ColorMode = 'light' | 'dark';
export type FontFamily = 'inter' | 'outfit' | 'space-grotesk' | 'fira-code';
export type FontSize = 'small' | 'medium' | 'large' | 'extra-large';
export type GlassMode = 'off' | 'subtle' | 'full';
export type ButtonShape = 'rounded' | 'square' | 'pill';
export type FocusIndicatorSize = 'normal' | 'large';
export type ColorBlindMode = 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';
export type MessageDensity = 'compact' | 'comfortable' | 'cozy';

type ThemeContextType = {
    theme: AppTheme;
    colorMode: ColorMode;
    fontFamily: FontFamily;
    fontSize: FontSize;
    setTheme: (theme: AppTheme) => void;
    setColorMode: (mode: ColorMode) => void;
    setFontFamily: (font: FontFamily) => void;
    setFontSize: (size: FontSize) => void;
    showChannelBackgrounds: boolean;
    setShowChannelBackgrounds: (show: boolean) => void;
    playMovingBackgrounds: boolean;
    setPlayMovingBackgrounds: (play: boolean) => void;
    glassMode: GlassMode;
    setGlassMode: (mode: GlassMode) => void;
    reducedEffects: boolean;
    setReducedEffects: (reduced: boolean) => void;
    lowPower: boolean;
    setLowPower: (low: boolean) => void;
    accentColor: string;
    setAccentColor: (color: string) => void;
    highContrast: boolean;
    setHighContrast: (hc: boolean) => void;
    compactMode: boolean;
    setCompactMode: (compact: boolean) => void;
    buttonShape: ButtonShape;
    setButtonShape: (shape: ButtonShape) => void;
    screenReaderMode: boolean;
    setScreenReaderMode: (sr: boolean) => void;
    linkUnderlines: boolean;
    setLinkUnderlines: (lu: boolean) => void;
    focusIndicatorSize: FocusIndicatorSize;
    setFocusIndicatorSize: (size: FocusIndicatorSize) => void;
    colorBlindMode: ColorBlindMode;
    setColorBlindMode: (cb: ColorBlindMode) => void;
    lowDataMode: boolean;
    setLowDataMode: (ldm: boolean) => void;
    messageDensity: MessageDensity;
    setMessageDensity: (density: MessageDensity) => void;
    /** Preview a theme temporarily (revert with null) */
    previewTheme: (themeId: string | null) => void;
    isPreviewActive: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
    return ctx;
};

/**
 * Resolve the ThemeVariables for a given theme + color mode.
 * Falls back to the theme's default mode if the requested mode isn't available.
 */
function resolveVars(themeId: string, mode: ColorMode): ThemeVariables | null {
    const def = resolveTheme(themeId);
    if (!def) return null;
    return mode === 'light' ? def.light : def.dark;
}

function normalizeGlassMode(value: string | null): GlassMode {
    switch (value) {
        case 'subtle':
        case 'full':
        case 'off':
            return value;
        case 'medium':
            return 'subtle';
        case 'heavy':
            return 'full';
        default:
            return 'full';
    }
}

function normalizeButtonShape(value: string | null): ButtonShape {
    switch (value) {
        case 'pill':
        case 'square':
            return value;
        case 'sharp':
            return 'square';
        case 'rounded':
        default:
            return 'rounded';
    }
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [theme, setThemeState] = useState<AppTheme>(() => {
        const saved = localStorage.getItem('gratonite_theme');
        return saved || 'default';
    });

    const [colorMode, setColorModeState] = useState<ColorMode>(() => {
        const saved = localStorage.getItem('gratonite_color_mode');
        if (saved) return saved as ColorMode;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        return 'dark';
    });

    const [fontFamily, setFontFamilyState] = useState<FontFamily>(() => {
        return (localStorage.getItem('gratonite_font') as FontFamily) || 'inter';
    });

    const [fontSize, setFontSizeState] = useState<FontSize>(() => {
        return (localStorage.getItem('gratonite_font_size') as FontSize) || 'medium';
    });

    const [showChannelBackgrounds, setShowChannelBackgroundsState] = useState<boolean>(() => {
        const saved = localStorage.getItem('gratonite_show_bg');
        return saved !== null ? saved === 'true' : true;
    });

    const [playMovingBackgrounds, setPlayMovingBackgroundsState] = useState<boolean>(() => {
        const saved = localStorage.getItem('gratonite_play_bg');
        return saved !== null ? saved === 'true' : true;
    });

    const [glassMode, setGlassModeState] = useState<GlassMode>(() => {
        return normalizeGlassMode(localStorage.getItem('gratonite_glass_mode'));
    });

    const [reducedEffects, setReducedEffectsState] = useState<boolean>(() => {
        const saved = localStorage.getItem('gratonite_reduced_effects');
        if (saved !== null) return saved === 'true';
        return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    });

    const [lowPower, setLowPowerState] = useState<boolean>(() => {
        const saved = localStorage.getItem('gratonite_low_power');
        if (saved !== null) return saved === 'true';
        if ((window as any).gratoniteDesktop?.isDesktop) return true;
        return false;
    });

    const [accentColor, setAccentColorState] = useState<string>(() => {
        return localStorage.getItem('gratonite_accent_color') || '';
    });

    const [highContrast, setHighContrastState] = useState<boolean>(() => {
        const saved = localStorage.getItem('gratonite_high_contrast');
        return saved !== null ? saved === 'true' : false;
    });

    const [compactMode, setCompactModeState] = useState<boolean>(() => {
        const saved = localStorage.getItem('gratonite_compact_mode');
        return saved !== null ? saved === 'true' : false;
    });

    const [buttonShape, setButtonShapeState] = useState<ButtonShape>(() => {
        return normalizeButtonShape(localStorage.getItem('gratonite_button_shape'));
    });

    const [screenReaderMode, setScreenReaderModeState] = useState<boolean>(() => {
        const saved = localStorage.getItem('gratonite_screen_reader_mode');
        return saved !== null ? saved === 'true' : false;
    });

    const [linkUnderlines, setLinkUnderlinesState] = useState<boolean>(() => {
        const saved = localStorage.getItem('gratonite_link_underlines');
        return saved !== null ? saved === 'true' : false;
    });

    const [focusIndicatorSize, setFocusIndicatorSizeState] = useState<FocusIndicatorSize>(() => {
        return (localStorage.getItem('gratonite_focus_indicator_size') as FocusIndicatorSize) || 'normal';
    });

    const [colorBlindMode, setColorBlindModeState] = useState<ColorBlindMode>(() => {
        const saved = localStorage.getItem('gratonite_color_blind_mode');
        if (saved === 'true') return 'deuteranopia';
        if (saved === 'deuteranopia' || saved === 'protanopia' || saved === 'tritanopia') return saved;
        return 'none';
    });

    const [lowDataMode, setLowDataModeState] = useState<boolean>(() => {
        const saved = localStorage.getItem('gratonite_low_data_mode');
        if (saved !== null) return saved === 'true';
        if ((navigator as any).connection?.saveData) return true;
        return false;
    });

    const [messageDensity, setMessageDensityState] = useState<MessageDensity>(() => {
        const saved = localStorage.getItem('gratonite:density');
        if (saved === 'compact' || saved === 'comfortable' || saved === 'cozy') return saved;
        return 'comfortable';
    });

    // Preview state
    const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);
    const isPreviewActive = previewThemeId !== null;
    const activeThemeId = previewThemeId || theme;

    const setTheme = (newTheme: AppTheme) => {
        setThemeState(newTheme);
        localStorage.setItem('gratonite_theme', newTheme);
        addRecentTheme(newTheme);
    };

    const setColorMode = (newMode: ColorMode) => {
        setColorModeState(newMode);
        localStorage.setItem('gratonite_color_mode', newMode);
    };

    const setFontFamily = (newFont: FontFamily) => {
        setFontFamilyState(newFont);
        localStorage.setItem('gratonite_font', newFont);
    };

    const setFontSize = (newSize: FontSize) => {
        setFontSizeState(newSize);
        localStorage.setItem('gratonite_font_size', newSize);
    };

    const setShowChannelBackgrounds = (show: boolean) => {
        setShowChannelBackgroundsState(show);
        localStorage.setItem('gratonite_show_bg', show.toString());
    };

    const setPlayMovingBackgrounds = (play: boolean) => {
        setPlayMovingBackgroundsState(play);
        localStorage.setItem('gratonite_play_bg', play.toString());
    };

    const setGlassMode = (mode: GlassMode) => {
        const normalized = normalizeGlassMode(mode);
        setGlassModeState(normalized);
        localStorage.setItem('gratonite_glass_mode', normalized);
    };

    const setReducedEffects = (reduced: boolean) => {
        setReducedEffectsState(reduced);
        localStorage.setItem('gratonite_reduced_effects', reduced.toString());
    };

    const setLowPower = (low: boolean) => {
        setLowPowerState(low);
        localStorage.setItem('gratonite_low_power', low.toString());
    };

    const setAccentColor = (color: string) => {
        setAccentColorState(color);
        localStorage.setItem('gratonite_accent_color', color);
    };

    const setHighContrast = (hc: boolean) => {
        setHighContrastState(hc);
        localStorage.setItem('gratonite_high_contrast', hc.toString());
    };

    const setCompactMode = (compact: boolean) => {
        setCompactModeState(compact);
        localStorage.setItem('gratonite_compact_mode', compact.toString());
    };

    const setButtonShape = (shape: ButtonShape) => {
        const normalized = normalizeButtonShape(shape);
        setButtonShapeState(normalized);
        localStorage.setItem('gratonite_button_shape', normalized);
    };

    const setScreenReaderMode = (sr: boolean) => {
        setScreenReaderModeState(sr);
        localStorage.setItem('gratonite_screen_reader_mode', sr.toString());
    };

    const setLinkUnderlines = (lu: boolean) => {
        setLinkUnderlinesState(lu);
        localStorage.setItem('gratonite_link_underlines', lu.toString());
    };

    const setFocusIndicatorSize = (size: FocusIndicatorSize) => {
        setFocusIndicatorSizeState(size);
        localStorage.setItem('gratonite_focus_indicator_size', size);
    };

    const setColorBlindMode = (cb: ColorBlindMode) => {
        setColorBlindModeState(cb);
        localStorage.setItem('gratonite_color_blind_mode', cb);
    };

    const setLowDataMode = (ldm: boolean) => {
        setLowDataModeState(ldm);
        localStorage.setItem('gratonite_low_data_mode', ldm.toString());
    };

    const setMessageDensity = (density: MessageDensity) => {
        setMessageDensityState(density);
        localStorage.setItem('gratonite:density', density);
    };

    const previewTheme= (themeId: string | null) => {
        setPreviewThemeId(themeId);
    };

    // Apply theme variables via injector (replaces CSS [data-theme] approach)
    useEffect(() => {
        const vars = resolveVars(activeThemeId, colorMode);
        if (vars) {
            // Use transition animation for user-initiated theme changes
            if (previewThemeId !== null) {
                applyThemeSync(vars);
            } else {
                applyThemeWithTransition(vars);
            }
        }

        // Keep data-theme attribute for backward compatibility (neobrutalism overrides, etc.)
        document.documentElement.setAttribute('data-theme', activeThemeId);
        document.documentElement.setAttribute('data-color-mode', colorMode);
        document.documentElement.setAttribute('data-font', fontFamily);
        document.documentElement.setAttribute('data-font-size', fontSize);
        document.documentElement.setAttribute('data-glass-mode', glassMode);
        document.documentElement.setAttribute('data-button-shape', buttonShape);

        // Toggle classes
        const el = document.documentElement;
        el.classList.toggle('reduced-effects', reducedEffects);
        el.classList.toggle('low-power', lowPower);
        el.classList.toggle('high-contrast', highContrast);
        el.classList.toggle('compact-mode', compactMode);
        el.classList.toggle('screen-reader-mode', screenReaderMode);
        el.classList.toggle('link-underlines', linkUnderlines);
        el.classList.toggle('focus-large', focusIndicatorSize === 'large');
        el.classList.toggle('low-data-mode', lowDataMode);

        el.setAttribute('data-cb-mode', colorBlindMode);
        el.classList.toggle('color-blind-mode', colorBlindMode !== 'none');

        // Custom accent color override
        if (accentColor) {
            el.style.setProperty('--accent-primary', accentColor);
        }

        // Message density CSS custom properties and data attribute
        const densityMap: Record<MessageDensity, { padding: string; gap: string; avatarSize: string }> = {
            compact:     { padding: '2px 16px', gap: '0px',  avatarSize: '32px' },
            comfortable: { padding: '4px 16px', gap: '2px',  avatarSize: '40px' },
            cozy:        { padding: '8px 16px', gap: '8px',  avatarSize: '40px' },
        };
        const dm = densityMap[messageDensity] ?? densityMap.comfortable;
        el.style.setProperty('--msg-padding', dm.padding);
        el.style.setProperty('--msg-gap', dm.gap);
        el.style.setProperty('--avatar-size', dm.avatarSize);
        el.setAttribute('data-density', messageDensity);

        // Font family
        const fontMap: Record<FontFamily, string> = {
            'inter': "'Inter', sans-serif",
            'outfit': "'Outfit', sans-serif",
            'space-grotesk': "'Space Grotesk', sans-serif",
            'fira-code': "'Fira Code', monospace"
        };
        el.style.setProperty('--font-sans', fontMap[fontFamily] || fontMap['inter']);

        // Font size scaling
        const fontSizeMap: Record<FontSize, string> = {
            'small': '87.5%', 'medium': '100%', 'large': '112.5%', 'extra-large': '125%'
        };
        const scaleMap: Record<FontSize, number> = {
            'small': 0.875, 'medium': 1.0, 'large': 1.125, 'extra-large': 1.25
        };
        el.style.fontSize = fontSizeMap[fontSize] ?? '100%';
        el.style.setProperty('--font-scale', (scaleMap[fontSize] ?? 1.0).toString());

    }, [activeThemeId, colorMode, fontFamily, fontSize, glassMode, reducedEffects, lowPower, accentColor, highContrast, compactMode, buttonShape, screenReaderMode, linkUnderlines, focusIndicatorSize, colorBlindMode, lowDataMode, messageDensity, previewThemeId]);

    // --- B7: OS Accent Color Sync on desktop ---
    useEffect(() => {
        const desktop = (window as any).gratoniteDesktop;
        if (desktop?.getSystemAccentColor && !localStorage.getItem('gratonite_accent_color')) {
            desktop.getSystemAccentColor().then((color: string | null) => {
                if (color) {
                    setAccentColor(color);
                }
            }).catch(() => {});
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync Windows title bar overlay color with active theme
    useEffect(() => {
        if ((window as any).gratoniteDesktop?.setTitleBarOverlay) {
            requestAnimationFrame(() => {
                const style = getComputedStyle(document.documentElement);
                const bgApp = style.getPropertyValue('--bg-app').trim();
                const textPrimary = style.getPropertyValue('--text-primary').trim();
                if (bgApp && textPrimary) {
                    (window as any).gratoniteDesktop.setTitleBarOverlay({ color: bgApp, symbolColor: textPrimary });
                }
            });
        }
    }, [activeThemeId, colorMode]);

    // Scheduled theme auto-switch (Item 15)
    useEffect(() => {
        const checkSchedule = () => {
            const scheduled = getScheduledTheme();
            if (scheduled && scheduled !== theme && !previewThemeId) {
                setTheme(scheduled);
            }
        };
        checkSchedule();
        const interval = setInterval(checkSchedule, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [theme, previewThemeId]);

    return (
        <ThemeContext.Provider value={{
            theme, colorMode, fontFamily, fontSize,
            setTheme, setColorMode, setFontFamily, setFontSize,
            showChannelBackgrounds, setShowChannelBackgrounds,
            playMovingBackgrounds, setPlayMovingBackgrounds,
            glassMode, setGlassMode,
            reducedEffects, setReducedEffects,
            lowPower, setLowPower,
            accentColor, setAccentColor,
            highContrast, setHighContrast,
            compactMode, setCompactMode,
            buttonShape, setButtonShape,
            screenReaderMode, setScreenReaderMode,
            linkUnderlines, setLinkUnderlines,
            focusIndicatorSize, setFocusIndicatorSize,
            colorBlindMode, setColorBlindMode,
            lowDataMode, setLowDataMode,
            messageDensity, setMessageDensity,
            previewTheme, isPreviewActive,
        }}>
            <MotionConfig reducedMotion={reducedEffects ? 'always' : 'user'}>
                {children}
            </MotionConfig>
        </ThemeContext.Provider>
    );
};
