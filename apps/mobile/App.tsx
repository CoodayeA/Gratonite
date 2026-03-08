import React from 'react';
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
import type { ThemeName } from './src/lib/themes';

const navigationRef = createNavigationContainerRef();

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
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

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') connectSocket();
      if (nextState === 'background') disconnectSocket();
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
