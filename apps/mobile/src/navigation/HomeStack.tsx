import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { HomeStackParamList } from './types';
import { ThreadScreen } from '../screens/portals/ThreadScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<HomeStackParamList>();

/** Placeholder until real HomeScreen is implemented */
function HomeScreenPlaceholder() {
  const { View, Text, StyleSheet } = require('react-native');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '600' }}>Home</Text>
    </View>
  );
}

export function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.primary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="HomeScreen" component={HomeScreenPlaceholder} />
      <Stack.Screen name="Thread" component={ThreadScreen} />
    </Stack.Navigator>
  );
}

