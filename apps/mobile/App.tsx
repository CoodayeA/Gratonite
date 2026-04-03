import React, { useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, AppState, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { AppStateProvider } from './src/contexts/AppStateContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import AppNavigator from './src/navigation/AppNavigator';
import OfflineBanner from './src/components/OfflineBanner';
import ErrorBoundary from './src/components/ErrorBoundary';
import { connectSocket, disconnectSocket } from './src/lib/socket';
import { refreshAccessToken, getAccessToken } from './src/lib/api';
import { colors } from './src/lib/theme';
import { useTheme, themeStore } from './src/lib/themeStore';
import { registerForPushNotifications, setupNotificationHandlers } from './src/lib/notifications';
import { ToastProvider } from './src/contexts/ToastContext';
import { VoiceProvider } from './src/contexts/VoiceContext';
import { appLockStore } from './src/lib/appLockStore';
import { securityStore } from './src/lib/securityStore';
import * as ScreenCapture from 'expo-screen-capture';
import AppLockScreen from './src/screens/app/AppLockScreen';
import OnboardingScreen from './src/screens/onboarding/OnboardingScreen';
import ThemePickerScreen from './src/screens/onboarding/ThemePickerScreen';
import { initSounds } from './src/lib/soundEngine';
import * as Updates from 'expo-updates';
import * as Sentry from '@sentry/react-native';
import { useSystemThemeListener } from './src/lib/useSystemTheme';
import type { ThemeName } from './src/lib/themes';

export const OTA_BUILD_STAMP = '2026-04-03-v1';

Sentry.init({
  dsn: 'https://ad17bb4f67fef179cb02bbf241babb25@o4511074273329152.ingest.us.sentry.io/4511074285649920',
  tracesSampleRate: 0.2,
  enabled: !__DEV__,
  beforeSend(event) {
    const message = event.message || event.exception?.values?.[0]?.value || '';
    if (message.includes('Failed to construct \'Response\'') && message.includes('status provided (0)')) {
      return null;
    }
    return event;
  },
});

const navigationRef = createNavigationContainerRef();

function RootNavigator() {
  const { user, loading } = useAuth();
  const [themePickDone, setThemePickDone] = React.useState<boolean | null>(null);
  const [onboardingDone, setOnboardingDone] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    Promise.all([
      SecureStore.getItemAsync('gratonite_theme_picked'),
      SecureStore.getItemAsync('gratonite_onboarding_complete'),
    ]).then(([themePicked, onboarded]) => {
      setThemePickDone(themePicked === 'true');
      setOnboardingDone(onboarded === 'true');
    });
  }, []);

  if (loading || themePickDone === null || onboardingDone === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  // First launch: pick your style
  if (!themePickDone) {
    return (
      <ThemePickerScreen
        onComplete={async () => {
          await SecureStore.setItemAsync('gratonite_theme_picked', 'true').catch(() => {});
          setThemePickDone(true);
        }}
      />
    );
  }

  // Then: onboarding slides
  if (!onboardingDone) {
    return <OnboardingScreen onComplete={() => setOnboardingDone(true)} />;
  }

  if (!user) return <AuthNavigator />;

  return (
    <AppStateProvider>
      <VoiceProvider>
        <AppNavigator />
      </VoiceProvider>
    </AppStateProvider>
  );
}

function ThemeInitializer() {
  React.useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync('gratonite_theme');
        if (saved && themeStore.isValidTheme(saved)) {
          themeStore.setTheme(saved);
        }
      } catch {
        // use default
      }
    })();
  }, []);
  return null;
}

function ThemedApp() {
  const { colors: c, isDark } = useTheme();
  const [isLocked, setIsLocked] = useState(false);
  const [lockCheckDone, setLockCheckDone] = useState(false);
  const backgroundTimestamp = useRef<number | null>(null);

  useSystemThemeListener();

  React.useEffect(() => {
    initSounds();
    console.log(`[Gratonite] OTA_BUILD_STAMP: ${OTA_BUILD_STAMP}`);
    if (!__DEV__) {
      Updates.checkForUpdateAsync()
        .then((update) => console.log(`[Gratonite] Update available: ${update.isAvailable}`))
        .catch(() => {});
    }
  }, []);

  // Screenshot protection
  React.useEffect(() => {
    (async () => {
      const enabled = await securityStore.getScreenshotProtection();
      if (enabled) {
        ScreenCapture.preventScreenCaptureAsync();
      } else {
        ScreenCapture.allowScreenCaptureAsync();
      }
    })();
  }, []);

  React.useEffect(() => {
    appLockStore.isEnabled().then(enabled => {
      setIsLocked(enabled);
      setLockCheckDone(true);
    });
  }, []);

  const isLockedRef = useRef(isLocked);
  React.useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);

  const onUnlockRef = useRef<(() => void) | null>(null);

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        // Re-lock if enabled and away for 30+ seconds
        let needsLock = false;
        if (backgroundTimestamp.current) {
          const elapsed = Date.now() - backgroundTimestamp.current;
          backgroundTimestamp.current = null;
          if (elapsed >= 30000) {
            const enabled = await appLockStore.isEnabled();
            if (enabled) {
              needsLock = true;
              setIsLocked(true);
            }
          }
        }

        if (needsLock) {
          // Defer token refresh + socket reconnect until after unlock
          onUnlockRef.current = () => {
            refreshAccessToken().then(() => connectSocket()).catch(() => {});
          };
        } else if (getAccessToken()) {
          // No lock needed — refresh token then reconnect (only if logged in)
          await refreshAccessToken();
          connectSocket();
        }
      }
      if (nextState === 'background') {
        disconnectSocket();
        backgroundTimestamp.current = Date.now();
      }
    });
    return () => sub.remove();
  }, []);

  React.useEffect(() => {
    registerForPushNotifications();
    const cleanup = setupNotificationHandlers(navigationRef);
    return cleanup;
  }, []);

  const linking = {
    prefixes: ['gratonite://'],
    config: {
      screens: {
        InviteAccept: 'invite/:code',
        DirectMessage: 'dm/:channelId',
        GuildDrawer: 'guild/:guildId',
        UserProfile: 'user/:userId',
        ResetPassword: 'reset-password/:token',
      },
    },
  };

  const navTheme = React.useMemo(() => ({
    dark: isDark,
    colors: {
      primary: c.accentPrimary,
      background: c.bgPrimary,
      card: c.bgSecondary,
      text: c.textPrimary,
      border: c.border,
      notification: c.error,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' as const },
      medium: { fontFamily: 'System', fontWeight: '500' as const },
      bold: { fontFamily: 'System', fontWeight: '700' as const },
      heavy: { fontFamily: 'System', fontWeight: '900' as const },
    },
  }), [c, isDark]);

  return (
    <NavigationContainer ref={navigationRef} linking={linking} theme={navTheme}>
      <AuthProvider>
        <ErrorBoundary>
          <OfflineBanner />
          <RootNavigator />
        </ErrorBoundary>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        {isLocked && lockCheckDone && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}>
            <AppLockScreen onUnlock={() => {
              setIsLocked(false);
              if (onUnlockRef.current) {
                onUnlockRef.current();
                onUnlockRef.current = null;
              }
            }} />
          </View>
        )}
      </AuthProvider>
    </NavigationContainer>
  );
}

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <ToastProvider>
            <ThemeInitializer />
            <ThemedApp />
          </ToastProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(App);
