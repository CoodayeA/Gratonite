import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { InboxStackParamList } from './types';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<InboxStackParamList>();

/** Placeholder until real InboxScreen is implemented */
function InboxScreenPlaceholder() {
  const { View, Text } = require('react-native');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '600' }}>Inbox</Text>
    </View>
  );
}

export function InboxStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.primary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="InboxScreen" component={InboxScreenPlaceholder} />
    </Stack.Navigator>
  );
}

