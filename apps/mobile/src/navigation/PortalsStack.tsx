import React from 'react';
<<<<<<< HEAD
import { View, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PortalsStackParamList } from './types';
import { GuildRolesScreen } from '../screens/portals/GuildRolesScreen';
import { GuildMembersScreen } from '../screens/portals/GuildMembersScreen';
=======
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PortalsStackParamList } from './types';
import { CreateEventScreen } from '../screens/portals/CreateEventScreen';
import { ThreadScreen } from '../screens/portals/ThreadScreen';
>>>>>>> 2c301bd (feat: US-056 + US-057 + US-058 - Mobile Events, Thread, Emoji/Status screens)
import { colors } from '../theme';

const Stack = createNativeStackNavigator<PortalsStackParamList>();

<<<<<<< HEAD
function PortalsListScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Portals</Text>
=======
/** Placeholder until real PortalsList is implemented */
function PortalsListPlaceholder() {
  const { View, Text } = require('react-native');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.text.primary, fontSize: 18, fontWeight: '600' }}>Portals</Text>
>>>>>>> 2c301bd (feat: US-056 + US-057 + US-058 - Mobile Events, Thread, Emoji/Status screens)
    </View>
  );
}

export function PortalsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
<<<<<<< HEAD
        headerShown: true,
        headerStyle: { backgroundColor: colors.bg.primary },
        headerTintColor: colors.text.primary,
        headerTitleStyle: { fontWeight: '600' },
=======
        headerShown: false,
>>>>>>> 2c301bd (feat: US-056 + US-057 + US-058 - Mobile Events, Thread, Emoji/Status screens)
        contentStyle: { backgroundColor: colors.bg.primary },
        animation: 'slide_from_right',
      }}
    >
<<<<<<< HEAD
      <Stack.Screen
        name="PortalsList"
        component={PortalsListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GuildRoles"
        component={GuildRolesScreen}
        options={({ route }) => ({
          title: route.params?.guildName ? `${route.params.guildName} - Roles` : 'Roles',
        })}
      />
      <Stack.Screen
        name="GuildMembers"
        component={GuildMembersScreen}
        options={({ route }) => ({
          title: route.params?.guildName ? `${route.params.guildName} - Members` : 'Members',
        })}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg.primary },
  text: { color: colors.text.primary, fontSize: 18 },
});
=======
      <Stack.Screen name="PortalsList" component={PortalsListPlaceholder} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} />
      <Stack.Screen name="Thread" component={ThreadScreen} />
    </Stack.Navigator>
  );
}
>>>>>>> 2c301bd (feat: US-056 + US-057 + US-058 - Mobile Events, Thread, Emoji/Status screens)
