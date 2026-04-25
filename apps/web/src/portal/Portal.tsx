/**
 * Portal — top-level theme-aware homescreen.
 *
 * Reads the resolved theme from PortalThemeProvider, applies CSS variables +
 * a vibe class to its root, and lazy-renders the matching vibe component.
 *
 * Each vibe receives the same PortalData shape so they're interchangeable.
 */
import { Suspense, lazy, useMemo } from 'react';
import { usePortalTheme, themeToCssVars } from './themes/PortalThemeProvider';
import { ThemePickerButton } from './ThemePickerButton';

const HolographicVibe = lazy(() => import('./vibes/HolographicVibe'));
const SolarSystemVibe = lazy(() => import('./vibes/SolarSystemVibe'));
const LiquidLavaVibe = lazy(() => import('./vibes/LiquidLavaVibe'));
const IsoCityVibe = lazy(() => import('./vibes/IsoCityVibe'));

export interface PortalTask {
  id: string;
  label: string;
  description: string;
  completed: boolean;
}

export interface PortalData {
  guildId: string;
  guildName: string;
  guildDescription: string | null;
  iconHash: string | null;
  memberCount: number;
  tasks: PortalTask[];
  completionPercent: number;
  onTaskAction: (taskId: string) => void;
  onOpenSettings: () => void;
}

interface PortalProps {
  data: PortalData;
}

export function Portal({ data }: PortalProps) {
  const { theme } = usePortalTheme();
  const vibeProps: PortalData = data;

  const cssVars = useMemo(() => themeToCssVars(theme), [theme]);

  const VibeComponent =
    theme.vibe === 'solar-system'
      ? SolarSystemVibe
      : theme.vibe === 'liquid-lava'
        ? LiquidLavaVibe
        : theme.vibe === 'iso-city'
          ? IsoCityVibe
          : HolographicVibe;

  const bgClass = `pt-bg-${theme.backgroundStyle}`;
  const animClass = `pt-anim-${theme.animations}`;

  return (
    <div
      className={`portal-root vibe-${theme.vibe} ${bgClass} ${animClass}`}
      style={{
        ...cssVars,
        // custom background image
        ...(theme.backgroundStyle === 'custom-image' && theme.customBackgroundUrl
          ? ({ ['--pt-bg-image' as any]: `url(${JSON.stringify(theme.customBackgroundUrl)})` })
          : {}),
        fontFamily: 'var(--pt-font)',
      }}
    >
      <Suspense fallback={<div className="portal-loading">Loading…</div>}>
        <VibeComponent {...vibeProps} />
      </Suspense>
      <ThemePickerButton />
    </div>
  );
}

export default Portal;
