import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PortalsStackParamList } from './types';
import { CreateEventScreen } from '../screens/portals/CreateEventScreen';
import { ThreadScreen } from '../screens/portals/ThreadScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<PortalsStackParamList>();

/** Placeholder until real PortalsList is implemented */
function PortalsListPlaceholder() {
  const { View, Text } = require('react-native');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '600' }}>Portals</Text>
    </View>
  );
}

export function PortalsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.primary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="PortalsList" component={PortalsListPlaceholder} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
      <Stack.Screen name="Thread" component={ThreadScreen} />
    </Stack.Navigator>
  );
}

