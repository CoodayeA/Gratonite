import type { AvatarDecoration, ProfileEffect, Nameplate } from '@gratonite/types';

const AVATAR_DECORATIONS_KEY = 'gratonite_avatar_decorations_catalog_v1';
const PROFILE_EFFECTS_KEY = 'gratonite_profile_effects_catalog_v1';
const NAMEPLATES_KEY = 'gratonite_nameplates_catalog_v1';
const COSMETICS_EVENT = 'gratonite-profile-cosmetics-update';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(COSMETICS_EVENT));
}

export function readAvatarDecorationsCatalog(): AvatarDecoration[] {
  return readJson<AvatarDecoration[]>(AVATAR_DECORATIONS_KEY, []);
}

export function saveAvatarDecorationsCatalog(items: AvatarDecoration[]) {
  writeJson(AVATAR_DECORATIONS_KEY, items);
}

export function readProfileEffectsCatalog(): ProfileEffect[] {
  return readJson<ProfileEffect[]>(PROFILE_EFFECTS_KEY, []);
}

export function saveProfileEffectsCatalog(items: ProfileEffect[]) {
  writeJson(PROFILE_EFFECTS_KEY, items);
}

export function readNameplatesCatalog(): Nameplate[] {
  return readJson<Nameplate[]>(NAMEPLATES_KEY, []);
}

export function saveNameplatesCatalog(items: Nameplate[]) {
  writeJson(NAMEPLATES_KEY, items);
}

export function getAvatarDecorationById(id?: string | null): AvatarDecoration | null {
  if (!id) return null;
  return readAvatarDecorationsCatalog().find((item) => item.id === id) ?? null;
}

export function getProfileEffectById(id?: string | null): ProfileEffect | null {
  if (!id) return null;
  return readProfileEffectsCatalog().find((item) => item.id === id) ?? null;
}

export function getNameplateById(id?: string | null): Nameplate | null {
  if (!id) return null;
  return readNameplatesCatalog().find((item) => item.id === id) ?? null;
}

export function subscribeProfileCosmeticsChanges(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const onChange = () => callback();
  window.addEventListener(COSMETICS_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(COSMETICS_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}
