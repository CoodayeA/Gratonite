import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const KEY = 'gratonite_app_lock';

export const appLockStore = {
  async isEnabled(): Promise<boolean> {
    const val = await SecureStore.getItemAsync(KEY);
    return val === 'true';
  },

  async setEnabled(enabled: boolean): Promise<boolean> {
    if (enabled) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.getEnrolledLevelAsync();
      if (!hasHardware || enrolled === LocalAuthentication.SecurityLevel.NONE) {
        return false;
      }
    }
    await SecureStore.setItemAsync(KEY, enabled ? 'true' : 'false');
    return true;
  },

  async authenticate(): Promise<boolean> {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Gratonite',
      cancelLabel: 'Cancel',
      fallbackLabel: 'Use Passcode',
    });
    return result.success;
  },

  async getBiometricType(): Promise<string> {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Fingerprint';
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'Iris';
    return 'Biometric';
  },
};
