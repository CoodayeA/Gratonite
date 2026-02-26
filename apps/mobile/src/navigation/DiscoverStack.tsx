import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { DiscoverStackParamList } from './types';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<DiscoverStackParamList>();

function DiscoverScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Discover</Text>
    </View>
  );
}

export function DiscoverStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.primary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Discover" component={DiscoverScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg.primary },
  text: { color: colors.text.primary, fontSize: 18 },
});
