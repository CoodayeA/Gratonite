import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { InboxStackParamList } from './types';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<InboxStackParamList>();

function InboxScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Inbox</Text>
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
      <Stack.Screen name="Inbox" component={InboxScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg.primary },
  text: { color: colors.text.primary, fontSize: 18 },
});
