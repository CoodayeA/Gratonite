/**
 * PortalThemeProvider — fetches owner default + member override for a guild,
 * resolves the effective theme, and exposes it (and CSS variables) via
 * context. Wraps a single guild's Portal screen.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  PortalTheme,
  SYSTEM_DEFAULT_THEME,
  hueFromHex,
  parseAccent,
  PLANET_HUE,
  resolveTheme,
} from './types';
import { portalThemeApi, ResolvedThemeResponse } from './api';

interface PortalThemeContextValue {
  theme: PortalTheme;
  guildDefault: PortalTheme | null;
  memberOverride: PortalTheme | null;
  isOwner: boolean;
  loading: boolean;
  error: string | null;
  setPreview: (theme: PortalTheme | null) => void;
  saveGuildDefault: (theme: PortalTheme) => Promise<void>;
  saveMemberOverride: (theme: PortalTheme) => Promise<void>;
  clearMemberOverride: () => Promise<void>;
  refresh: () => Promise<void>;
  guildId: string;
}

const Ctx = createContext<PortalThemeContextValue | null>(null);

interface ProviderProps {
  guildId: string;
  children: ReactNode;
}

export function PortalThemeProvider({ guildId, children }: ProviderProps) {
  const [resolved, setResolved] = useState<ResolvedThemeResponse | null>(null);
  const [preview, setPreviewState] = useState<PortalTheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const guildIdRef = useRef(guildId);
  guildIdRef.current = guildId;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await portalThemeApi.fetchResolved(guildIdRef.current);
      setResolved(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load theme');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setPreviewState(null);
    refresh();
  }, [guildId, refresh]);

  const theme = useMemo<PortalTheme>(() => {
    if (preview) return preview;
    return resolveTheme(resolved?.guildDefault ?? null, resolved?.memberOverride ?? null);
  }, [preview, resolved]);

  const saveGuildDefault = useCallback(
    async (next: PortalTheme) => {
      await portalThemeApi.saveGuildDefault(guildIdRef.current, next);
      setPreviewState(null);
      await refresh();
    },
    [refresh],
  );

  const saveMemberOverride = useCallback(
    async (next: PortalTheme) => {
      await portalThemeApi.saveMemberOverride(guildIdRef.current, next);
      setPreviewState(null);
      await refresh();
    },
    [refresh],
  );

  const clearMemberOverride = useCallback(async () => {
    await portalThemeApi.clearMemberOverride(guildIdRef.current);
    setPreviewState(null);
    await refresh();
  }, [refresh]);

  const value: PortalThemeContextValue = {
    theme,
    guildDefault: resolved?.guildDefault ?? null,
    memberOverride: resolved?.memberOverride ?? null,
    isOwner: resolved?.isOwner ?? false,
    loading,
    error,
    setPreview: setPreviewState,
    saveGuildDefault,
    saveMemberOverride,
    clearMemberOverride,
    refresh,
    guildId,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortalTheme(): PortalThemeContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePortalTheme must be used within PortalThemeProvider');
  return v;
}

/**
 * Compute inline CSS variables to feed to the Portal root element. Vibe
 * components read these vars from CSS for accent/glow/planet/density/font.
 */
export function themeToCssVars(theme: PortalTheme = SYSTEM_DEFAULT_THEME): React.CSSProperties {
  const accent = parseAccent(theme.accentColor);
  const accentHue = hueFromHex(accent.from);
  const planetHue =
    theme.planetStyle === 'custom'
      ? accentHue
      : PLANET_HUE[theme.planetStyle as keyof typeof PLANET_HUE];

  const densityScale: Record<PortalTheme['density'], string> = {
    cozy: '0.92',
    comfortable: '1',
    compact: '1.08',
  };

  const fontFamily: Record<PortalTheme['fontPersonality'], string> = {
    modern: "'Inter', system-ui, -apple-system, sans-serif",
    editorial: "'Lora', 'Georgia', serif",
    builder: "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",
    playful: "'Comfortaa', 'Quicksand', sans-serif",
  };

  return {
    ['--pt-accent' as any]: accent.from,
    ['--pt-accent-2' as any]: accent.to,
    ['--pt-accent-hue' as any]: String(accentHue),
    ['--pt-accent-gradient' as any]: accent.isGradient
      ? `linear-gradient(135deg, ${accent.from}, ${accent.to})`
      : accent.from,
    ['--pt-planet-hue' as any]: String(planetHue),
    ['--pt-density-scale' as any]: densityScale[theme.density],
    ['--pt-font' as any]: fontFamily[theme.fontPersonality],
    ['--pt-anim-mult' as any]:
      theme.animations === 'off' ? '0' : theme.animations === 'subtle' ? '0.5' : '1',
  };
}
