import type { UiExperience } from '../tokens/applyExperienceTokens';

export const UI_EXPERIENCE_STORAGE_KEY = 'gratonite:ui-experience';

function isUiExperience(value: string | null): value is UiExperience {
  return value === 'classic' || value === 'premium-gamer-os';
}

export function readStoredUiExperience(): UiExperience {
  try {
    if (typeof window === 'undefined') return 'classic';
    const stored = window.localStorage.getItem(UI_EXPERIENCE_STORAGE_KEY);
    return isUiExperience(stored) ? stored : 'classic';
  } catch {
    return 'classic';
  }
}

export function writeStoredUiExperience(experience: UiExperience): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(UI_EXPERIENCE_STORAGE_KEY, experience);
  } catch {
    // Ignore storage failures so UI experience changes remain behavior-safe.
  }
}
