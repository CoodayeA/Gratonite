/**
 * SecureStore-backed security preferences.
 */

import * as SecureStore from 'expo-secure-store';

const SCREENSHOT_PROTECTION_KEY = 'gratonite_screenshot_protection';
const INCOGNITO_KEYBOARD_KEY = 'gratonite_incognito_keyboard';

export const securityStore = {
  async getScreenshotProtection(): Promise<boolean> {
    const val = await SecureStore.getItemAsync(SCREENSHOT_PROTECTION_KEY);
    return val === 'true';
  },

  async setScreenshotProtection(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(SCREENSHOT_PROTECTION_KEY, enabled ? 'true' : 'false');
  },

  async getIncognitoKeyboard(): Promise<boolean> {
    const val = await SecureStore.getItemAsync(INCOGNITO_KEYBOARD_KEY);
    return val === 'true';
  },

  async setIncognitoKeyboard(enabled: boolean): Promise<void> {
    await SecureStore.setItemAsync(INCOGNITO_KEYBOARD_KEY, enabled ? 'true' : 'false');
  },
};
