import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { themeStore } from './themeStore';
import type { ThemeName } from './themes';
import * as SecureStore from 'expo-secure-store';

/**
 * When auto-mode is on, switch between the light/dark variant
 * of the user's chosen theme family (neo ↔ neo-dark, glass ↔ glass-dark, light ↔ dark).
 */
function getDarkVariant(current: ThemeName): ThemeName {
  if (current.startsWith('neobrutalism')) return 'neobrutalism-dark';
  if (current.startsWith('glassmorphism')) return 'glassmorphism-dark';
  return 'dark';
}

function getLightVariant(current: ThemeName): ThemeName {
  if (current.startsWith('neobrutalism')) return 'neobrutalism';
  if (current.startsWith('glassmorphism')) return 'glassmorphism';
  return 'light';
}

function applySystemTheme(colorScheme: string | null | undefined) {
  const current = themeStore.getThemeName();
  const next = colorScheme === 'dark' ? getDarkVariant(current) : getLightVariant(current);
  themeStore.setTheme(next);
}

export function useSystemThemeListener() {
  useEffect(() => {
    const check = async () => {
      const auto = await SecureStore.getItemAsync('gratonite_auto_theme');
      if (auto !== 'true') return;
      applySystemTheme(Appearance.getColorScheme());
    };

    check();

    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      SecureStore.getItemAsync('gratonite_auto_theme').then((auto) => {
        if (auto === 'true') {
          applySystemTheme(colorScheme);
        }
      });
    });

    return () => sub.remove();
  }, []);
}
