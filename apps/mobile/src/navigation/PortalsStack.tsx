import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { PortalsStackParamList } from './types';
import { GuildRolesScreen } from '../screens/portals/GuildRolesScreen';
import { GuildMembersScreen } from '../screens/portals/GuildMembersScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator<PortalsStackParamList>();

function PortalsListScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Portals</Text>
    </View>
  );
}

export function PortalsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.bg.primary },
        headerTintColor: colors.text.primary,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.bg.primary },
        animation: 'slide_from_right',
      }}
    >
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
