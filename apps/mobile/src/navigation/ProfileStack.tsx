import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from './types';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

/** Placeholder until real ProfileScreen is implemented */
function ProfileScreenPlaceholder() {
  const { View, Text } = require('react-native');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '600' }}>Profile</Text>
    </View>
  );
}

export function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.primary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="ProfileScreen" component={ProfileScreenPlaceholder} />
    </Stack.Navigator>
  );
}

