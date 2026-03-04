import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/lib/theme';

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  return user ? <AppNavigator /> : <AuthNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: colors.accentPrimary,
            background: colors.bgPrimary,
            card: colors.bgSecondary,
            text: colors.textPrimary,
            border: colors.border,
            notification: colors.error,
          },
          fonts: {
            regular: { fontFamily: 'System', fontWeight: '400' },
            medium: { fontFamily: 'System', fontWeight: '500' },
            bold: { fontFamily: 'System', fontWeight: '700' },
            heavy: { fontFamily: 'System', fontWeight: '900' },
          },
        }}
      >
        <AuthProvider>
          <RootNavigator />
          <StatusBar style="light" />
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
