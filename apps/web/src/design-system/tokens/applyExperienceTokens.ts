import { PREMIUM_GAMER_OS_TOKENS } from './premiumGamerOs';

export type UiExperience = 'classic' | 'premium-gamer-os';

const ROOT_CLASS = 'gt-new-ui';

export function applyExperienceTokens(experience: UiExperience): void {
  const root = document.documentElement;
  root.dataset.uiExperience = experience;
  root.classList.toggle(ROOT_CLASS, experience === 'premium-gamer-os');

  if (experience === 'premium-gamer-os') {
    for (const [key, value] of Object.entries(PREMIUM_GAMER_OS_TOKENS)) {
      root.style.setProperty(key, value);
    }
    return;
  }

  for (const key of Object.keys(PREMIUM_GAMER_OS_TOKENS)) {
    root.style.removeProperty(key);
  }
}
