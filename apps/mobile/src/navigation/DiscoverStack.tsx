import React from 'react';
<<<<<<< HEAD
import { View, Text, StyleSheet } from 'react-native';
=======
>>>>>>> 2c301bd (feat: US-056 + US-057 + US-058 - Mobile Events, Thread, Emoji/Status screens)
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { DiscoverStackParamList } from './types';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<DiscoverStackParamList>();

<<<<<<< HEAD
function DiscoverScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Discover</Text>
=======
/** Placeholder until real DiscoverScreen is implemented */
function DiscoverScreenPlaceholder() {
  const { View, Text } = require('react-native');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '600' }}>Discover</Text>
>>>>>>> 2c301bd (feat: US-056 + US-057 + US-058 - Mobile Events, Thread, Emoji/Status screens)
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
<<<<<<< HEAD
      <Stack.Screen name="Discover" component={DiscoverScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg.primary },
  text: { color: colors.text.primary, fontSize: 18 },
});
=======
      <Stack.Screen name="DiscoverScreen" component={DiscoverScreenPlaceholder} />
    </Stack.Navigator>
  );
}
>>>>>>> 2c301bd (feat: US-056 + US-057 + US-058 - Mobile Events, Thread, Emoji/Status screens)
