import React from 'react';
<<<<<<< HEAD
import { View, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { HomeStackParamList } from './types';
=======
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { HomeStackParamList } from './types';
import { ThreadScreen } from '../screens/portals/ThreadScreen';
>>>>>>> 2c301bd (feat: US-056 + US-057 + US-058 - Mobile Events, Thread, Emoji/Status screens)
import { colors } from '../theme';

const Stack = createNativeStackNavigator<HomeStackParamList>();

<<<<<<< HEAD
function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Home</Text>
=======
/** Placeholder until real HomeScreen is implemented */
function HomeScreenPlaceholder() {
  const { View, Text, StyleSheet } = require('react-native');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '600' }}>Home</Text>
>>>>>>> 2c301bd (feat: US-056 + US-057 + US-058 - Mobile Events, Thread, Emoji/Status screens)
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
<<<<<<< HEAD
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg.primary },
  text: { color: colors.text.primary, fontSize: 18 },
});
=======
      <Stack.Screen name="HomeScreen" component={HomeScreenPlaceholder} />
      <Stack.Screen name="Thread" component={ThreadScreen} />
    </Stack.Navigator>
  );
}
>>>>>>> 2c301bd (feat: US-056 + US-057 + US-058 - Mobile Events, Thread, Emoji/Status screens)
