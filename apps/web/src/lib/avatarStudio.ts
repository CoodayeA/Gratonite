export type SpriteHairStyle = 'short' | 'long' | 'spike';
export type SpriteFaceStyle = 'smile' | 'neutral' | 'wink';
export type SpriteHatStyle = 'none' | 'beanie' | 'crown';
export type SpriteAccessoryStyle = 'none' | 'glasses' | 'star';
export type SpriteWearableSlot = 'hat' | 'top' | 'bottom' | 'shoes' | 'accessory';

export interface AvatarSpriteConfig {
  skinTone: string;
  hairColor: string;
  hairStyle: SpriteHairStyle;
  faceStyle: SpriteFaceStyle;
  topColor: string;
  bottomColor: string;
  shoesColor: string;
  hatStyle: SpriteHatStyle;
  accessoryStyle: SpriteAccessoryStyle;
}

export interface AvatarStudioPrefs {
  enabled: boolean;
  sprite: AvatarSpriteConfig;
  equipped: Record<SpriteWearableSlot, string | null>;
}

export interface StarterWearableItem {
  id: string;
  slot: SpriteWearableSlot;
  label: string;
  patch: Partial<AvatarSpriteConfig>;
}

const STORAGE_KEY_PREFIX = 'gratonite_avatar_studio_v1';
const CHANGE_EVENT = 'gratonite:avatar-studio:changed';

export const SKIN_TONES = ['#f6d3b9', '#e9b790', '#c68642', '#8d5524'] as const;
export const HAIR_COLORS = ['#1f1f1f', '#6a4b3b', '#d5a253', '#a53ad6', '#25a5d6'] as const;
export const CLOTHES_COLORS = ['#4c6fff', '#ff8a5b', '#3ccf91', '#8b6bff', '#ffcd4d'] as const;

export const DEFAULT_AVATAR_STUDIO_PREFS: AvatarStudioPrefs = {
  enabled: false,
  sprite: {
    skinTone: SKIN_TONES[0],
    hairColor: HAIR_COLORS[0],
    hairStyle: 'short',
    faceStyle: 'smile',
    topColor: CLOTHES_COLORS[0],
    bottomColor: '#263659',
    shoesColor: '#10161f',
    hatStyle: 'none',
    accessoryStyle: 'none',
  },
  equipped: {
    hat: null,
    top: null,
    bottom: null,
    shoes: null,
    accessory: null,
  },
};

export const STARTER_WEARABLES: StarterWearableItem[] = [
  { id: 'hat-none', slot: 'hat', label: 'No Hat', patch: { hatStyle: 'none' } },
  { id: 'hat-beanie-core', slot: 'hat', label: 'Core Beanie', patch: { hatStyle: 'beanie' } },
  { id: 'hat-crown-spark', slot: 'hat', label: 'Spark Crown', patch: { hatStyle: 'crown' } },
  { id: 'top-ocean-core', slot: 'top', label: 'Ocean Hoodie', patch: { topColor: '#4c6fff' } },
  { id: 'top-sunset-core', slot: 'top', label: 'Sunset Hoodie', patch: { topColor: '#ff8a5b' } },
  { id: 'bottom-night-core', slot: 'bottom', label: 'Night Pants', patch: { bottomColor: '#263659' } },
  { id: 'bottom-jade-core', slot: 'bottom', label: 'Jade Pants', patch: { bottomColor: '#1f4d3c' } },
  { id: 'shoes-shadow-core', slot: 'shoes', label: 'Shadow Sneakers', patch: { shoesColor: '#10161f' } },
  { id: 'shoes-light-core', slot: 'shoes', label: 'Light Sneakers', patch: { shoesColor: '#e9ecf1' } },
  { id: 'acc-none', slot: 'accessory', label: 'No Accessory', patch: { accessoryStyle: 'none' } },
  { id: 'acc-glasses-core', slot: 'accessory', label: 'Core Glasses', patch: { accessoryStyle: 'glasses' } },
  { id: 'acc-star-core', slot: 'accessory', label: 'Star Charm', patch: { accessoryStyle: 'star' } },
];

export function readAvatarStudioPrefs(userId: string): AvatarStudioPrefs {
  if (typeof window === 'undefined') return DEFAULT_AVATAR_STUDIO_PREFS;
  const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}:${userId}`);
  if (!raw) return DEFAULT_AVATAR_STUDIO_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<AvatarStudioPrefs>;
    return {
      // Feature is disabled in production surfaces; always fall back to standard avatars.
      enabled: false,
      sprite: {
        ...DEFAULT_AVATAR_STUDIO_PREFS.sprite,
        ...(parsed.sprite ?? {}),
      },
      equipped: {
        ...DEFAULT_AVATAR_STUDIO_PREFS.equipped,
        ...(parsed.equipped ?? {}),
      },
    };
  } catch {
    return DEFAULT_AVATAR_STUDIO_PREFS;
  }
}

export function saveAvatarStudioPrefs(userId: string, prefs: AvatarStudioPrefs) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    `${STORAGE_KEY_PREFIX}:${userId}`,
    JSON.stringify({
      ...prefs,
      enabled: false,
    } satisfies AvatarStudioPrefs),
  );
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { userId } }));
}

export function subscribeAvatarStudioChanges(listener: (userId: string) => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => {
    const userId = (event as CustomEvent<{ userId?: string }>).detail?.userId;
    if (typeof userId === 'string') listener(userId);
  };
  window.addEventListener(CHANGE_EVENT, handler as EventListener);
  return () => window.removeEventListener(CHANGE_EVENT, handler as EventListener);
}

export function equipStarterWearable(
  prefs: AvatarStudioPrefs,
  wearable: StarterWearableItem,
): AvatarStudioPrefs {
  return {
    ...prefs,
    sprite: {
      ...prefs.sprite,
      ...wearable.patch,
    },
    equipped: {
      ...prefs.equipped,
      [wearable.slot]: wearable.id,
    },
  };
}
