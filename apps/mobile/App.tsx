import { registerGlobals } from '@livekit/react-native-webrtc';
registerGlobals();

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { linking } from './src/navigation/linking';
import { useAuthStore } from './src/stores/auth.store';
import { usersApi } from './src/lib/api';
import { SocketProvider } from './src/providers/SocketProvider';
import { NotificationProvider } from './src/providers/NotificationProvider';
import { useNotificationBadge } from './src/hooks/useNotificationBadge';
import { registerBackgroundSync } from './src/tasks/backgroundSync';
import { colors } from './src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

const GratoniteTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand.primary,
    background: colors.bg.primary,
    card: colors.bg.secondary,
    text: colors.text.primary,
    border: colors.stroke.primary,
    notification: colors.accent.error,
  },
};

function AppContent() {
  const [ready, setReady] = useState(false);
  const restoreToken = useAuthStore((s) => s.restoreToken);
  const login = useAuthStore((s) => s.login);
  const setLoading = useAuthStore((s) => s.setLoading);

  // Sync app badge count with unread store (must be before any early return)
  useNotificationBadge();

  useEffect(() => {
    (async () => {
      try {
        const token = await restoreToken();
        if (token) {
          // Validate saved token by fetching user profile
          const user = await usersApi.getMe();
          await login(
            {
              id: user.id,
              username: user.username,
              displayName: user.profile?.displayName ?? user.username,
              email: user.email,
              avatar: user.profile?.avatarHash ?? null,
              tier: user.profile?.tier ?? 'free',
            },
            token,
          );
        }
      } catch {
        // Token invalid or expired — clear stale token so it doesn't pollute
        // future requests (e.g. login) with an invalid Authorization header
        useAuthStore.setState({ token: null });
      } finally {
        setLoading(false);
        setReady(true);
        // Register background sync for badge updates
        registerBackgroundSync().catch(() => {});
      }
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  return (
    <SocketProvider>
      <NotificationProvider>
        <NavigationContainer theme={GratoniteTheme} linking={linking}>
          <RootNavigator />
        </NavigationContainer>
      </NotificationProvider>
    </SocketProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <AppContent />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
