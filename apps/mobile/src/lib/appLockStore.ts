import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const KEY = 'gratonite_app_lock';

export interface AuthenticateResult {
  success: boolean;
  error?: string;
  userCanceled?: boolean;
}

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

  async authenticate(): Promise<AuthenticateResult> {
    // Pre-flight: verify hardware and enrollment
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return { success: false, error: 'No biometric hardware available' };
    }
    const enrolled = await LocalAuthentication.getEnrolledLevelAsync();
    if (enrolled === LocalAuthentication.SecurityLevel.NONE) {
      return { success: false, error: 'No biometrics enrolled' };
    }

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Gratonite',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        return { success: true };
      }

      // Distinguish user cancel from other failures
      const userCanceled = result.error === 'user_cancel' || result.error === 'system_cancel';
      return {
        success: false,
        error: result.error || 'Authentication failed',
        userCanceled,
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Biometric error' };
    }
  },

  async getBiometricType(): Promise<string> {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Fingerprint';
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'Iris';
    return 'Biometric';
  },
};
