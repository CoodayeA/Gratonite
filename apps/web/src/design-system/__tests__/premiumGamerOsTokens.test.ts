import { describe, expect, it } from 'vitest';
import { PREMIUM_GAMER_OS_TOKENS } from '../tokens/premiumGamerOs';

const requiredTokenKeys = [
  '--gt-experience-bg-depth',
  '--gt-experience-bg-surface',
  '--gt-experience-bg-surface-raised',
  '--gt-experience-bg-surface-inset',
  '--gt-experience-border-subtle',
  '--gt-experience-border-luminous',
  '--gt-experience-glow-primary',
  '--gt-experience-glow-warm',
  '--gt-experience-radius-panel',
  '--gt-experience-radius-control',
  '--gt-experience-shadow-panel',
  '--gt-experience-shadow-float',
  '--gt-experience-motion-fast',
  '--gt-experience-motion-standard',
  '--gt-experience-motion-emphasized',
];

describe('Premium Gamer OS tokens', () => {
  it('defines every required New UI token', () => {
    for (const key of requiredTokenKeys) {
      expect(PREMIUM_GAMER_OS_TOKENS[key], `${key} should be defined`).toBeTruthy();
    }
  });

  it('uses CSS custom property names for every token key', () => {
    for (const key of Object.keys(PREMIUM_GAMER_OS_TOKENS)) {
      expect(key.startsWith('--gt-experience-')).toBe(true);
    }
  });
});
