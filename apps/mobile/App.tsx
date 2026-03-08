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
import { colors } from './src/lib/theme';
import { useTheme, themeStore } from './src/lib/themeStore';
import { registerForPushNotifications, setupNotificationHandlers } from './src/lib/notifications';
import { ToastProvider } from './src/contexts/ToastContext';
import { appLockStore } from './src/lib/appLockStore';
import { securityStore } from './src/lib/securityStore';
import * as ScreenCapture from 'expo-screen-capture';
import AppLockScreen from './src/screens/app/AppLockScreen';
import OnboardingScreen from './src/screens/onboarding/OnboardingScreen';
import { initSounds } from './src/lib/soundEngine';
import { useSystemThemeListener } from './src/lib/useSystemTheme';
import type { ThemeName } from './src/lib/themes';

const navigationRef = createNavigationContainerRef();

function RootNavigator() {
  const { user, loading } = useAuth();
  const [onboardingDone, setOnboardingDone] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    SecureStore.getItemAsync('gratonite_onboarding_complete').then(val => {
      setOnboardingDone(val === 'true');
    });
  }, []);

  if (loading || onboardingDone === null) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  if (!onboardingDone && !user) {
    return <OnboardingScreen onComplete={() => setOnboardingDone(true)} />;
  }

  if (!user) return <AuthNavigator />;

  return (
    <AppStateProvider>
      <AppNavigator />
    </AppStateProvider>
  );
}

function ThemeInitializer() {
  React.useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync('gratonite_theme');
        if (saved && (saved === 'dark' || saved === 'light' || saved === 'neobrutalism' || saved === 'neobrutalism-dark')) {
          themeStore.setTheme(saved as ThemeName);
        }
      } catch {
        // use default dark
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

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
        connectSocket();
        // Re-lock if enabled and away for 30+ seconds
        if (backgroundTimestamp.current) {
          const elapsed = Date.now() - backgroundTimestamp.current;
          backgroundTimestamp.current = null;
          if (elapsed >= 30000) {
            const enabled = await appLockStore.isEnabled();
            if (enabled) setIsLocked(true);
          }
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
        {isLocked && lockCheckDone && <AppLockScreen onUnlock={() => setIsLocked(false)} />}
      </AuthProvider>
    </NavigationContainer>
  );
}

export default function App() {
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
