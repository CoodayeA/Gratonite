/**
 * Shared types for settings tab sub-components.
 */

export type NameplateStyle = 'none' | 'rainbow' | 'fire' | 'ice' | 'gold' | 'glitch';
export type AvatarFrameStyle = 'none' | 'neon' | 'gold' | 'glass' | 'rainbow' | 'pulse';

export interface UserProfileLike {
  id?: string;
  name?: string;
  displayName?: string;
  handle?: string;
  username?: string;
  email?: string;
  bio?: string;
  avatarStyle?: string;
  bannerStyle?: string;
  avatarFrame?: string;
  nameplateStyle?: string;
  [key: string]: unknown;
}

export interface UserThemeLike {
  accentColor?: string;
  glassMode?: string;
  reducedEffects?: boolean;
  lowPower?: boolean;
  [key: string]: unknown;
}

export interface SettingsTabProps {
  addToast: (t: { title: string; description?: string; variant: 'success' | 'error' }) => void;
}
