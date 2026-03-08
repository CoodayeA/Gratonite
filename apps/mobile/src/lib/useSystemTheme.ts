import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { themeStore } from './themeStore';
import * as SecureStore from 'expo-secure-store';

export function useSystemThemeListener() {
  useEffect(() => {
    const check = async () => {
      const auto = await SecureStore.getItemAsync('gratonite_auto_theme');
      if (auto !== 'true') return;
      const colorScheme = Appearance.getColorScheme();
      themeStore.setTheme(colorScheme === 'dark' ? 'dark' : 'light');
    };

    check();

    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      SecureStore.getItemAsync('gratonite_auto_theme').then((auto) => {
        if (auto === 'true') {
          themeStore.setTheme(colorScheme === 'dark' ? 'dark' : 'light');
        }
      });
    });

    return () => sub.remove();
  }, []);
}
