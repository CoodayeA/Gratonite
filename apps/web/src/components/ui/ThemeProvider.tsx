import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type AppTheme = 'default' | 'glass' | 'neobrutalism' | 'synthwave' | 'y2k' | 'memphis' | 'artdeco' | 'terminal' | 'aurora' | 'vaporwave' | 'nord' | 'solarized' | 'bubblegum' | 'obsidian' | 'sakura' | 'midnight' | 'forest';
export type ColorMode = 'light' | 'dark';
export type FontFamily = 'inter' | 'outfit' | 'space-grotesk' | 'fira-code';
export type FontSize = 'small' | 'medium' | 'large' | 'extra-large';
export type GlassMode = 'off' | 'subtle' | 'full';
export type ButtonShape = 'rounded' | 'sharp' | 'pill';

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
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
    return ctx;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [theme, setThemeState] = useState<AppTheme>(() => {
        const saved = localStorage.getItem('gratonite_theme');
        return (saved as AppTheme) || 'default';
    });

    const [colorMode, setColorModeState] = useState<ColorMode>(() => {
        const saved = localStorage.getItem('gratonite_color_mode');
        if (saved) return saved as ColorMode;
        // Check OS preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        return 'dark'; // default
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
        return (localStorage.getItem('gratonite_glass_mode') as GlassMode) || 'full';
    });

    const [reducedEffects, setReducedEffectsState] = useState<boolean>(() => {
        const saved = localStorage.getItem('gratonite_reduced_effects');
        return saved !== null ? saved === 'true' : false;
    });

    const [lowPower, setLowPowerState] = useState<boolean>(() => {
        const saved = localStorage.getItem('gratonite_low_power');
        return saved !== null ? saved === 'true' : false;
    });

    const [accentColor, setAccentColorState] = useState<string>(() => {
        return localStorage.getItem('gratonite_accent_color') || '#3b82f6';
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
        return (localStorage.getItem('gratonite_button_shape') as ButtonShape) || 'rounded';
    });

    const setTheme = (newTheme: AppTheme) => {
        setThemeState(newTheme);
        localStorage.setItem('gratonite_theme', newTheme);
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
        setGlassModeState(mode);
        localStorage.setItem('gratonite_glass_mode', mode);
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
        setButtonShapeState(shape);
        localStorage.setItem('gratonite_button_shape', shape);
    };

    // Apply data attributes so CSS can hook into them
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-color-mode', colorMode);
        document.documentElement.setAttribute('data-font', fontFamily);
        document.documentElement.setAttribute('data-font-size', fontSize);
        document.documentElement.setAttribute('data-glass-mode', glassMode);
        document.documentElement.setAttribute('data-button-shape', buttonShape);

        if (reducedEffects) document.documentElement.classList.add('reduced-effects');
        else document.documentElement.classList.remove('reduced-effects');

        if (lowPower) document.documentElement.classList.add('low-power');
        else document.documentElement.classList.remove('low-power');

        if (highContrast) document.documentElement.classList.add('high-contrast');
        else document.documentElement.classList.remove('high-contrast');

        if (compactMode) document.documentElement.classList.add('compact-mode');
        else document.documentElement.classList.remove('compact-mode');

        if (accentColor) {
            document.documentElement.style.setProperty('--accent-primary', accentColor);
        }

        // Map abstract fonts to specific CSS variables
        const fontMap: Record<FontFamily, string> = {
            'inter': "'Inter', sans-serif",
            'outfit': "'Outfit', sans-serif",
            'space-grotesk': "'Space Grotesk', sans-serif",
            'fira-code': "'Fira Code', monospace"
        };
        const resolvedFont = fontMap[fontFamily] || fontMap['inter'];
        document.documentElement.style.setProperty('--font-sans', resolvedFont);

        // Font size scaling logic
        const scaleMap: Record<FontSize, number> = {
            'small': 0.85,
            'medium': 1.0,
            'large': 1.15,
            'extra-large': 1.3
        };
        const scale = scaleMap[fontSize] ?? 1.0;
        document.documentElement.style.setProperty('--font-scale', scale.toString());
        // We override the root font size which rem sizes are based on
        document.documentElement.style.fontSize = `${scale * 100}%`;
        // Apply zoom to body so inline px units scale
        (document.body.style as any).zoom = scale.toString();

    }, [theme, colorMode, fontFamily, fontSize, glassMode, reducedEffects, lowPower, accentColor, highContrast, compactMode, buttonShape]);

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
            buttonShape, setButtonShape
        }}>
            {children}
        </ThemeContext.Provider>
    );
};
