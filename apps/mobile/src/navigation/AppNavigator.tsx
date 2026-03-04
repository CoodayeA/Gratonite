import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import GuildListScreen from '../screens/app/GuildListScreen';
import DMListScreen from '../screens/app/DMListScreen';
import FriendsScreen from '../screens/app/FriendsScreen';
import GuildChannelsScreen from '../screens/guild/GuildChannelsScreen';
import ChannelChatScreen from '../screens/guild/ChannelChatScreen';
import VoiceChannelScreen from '../screens/guild/VoiceChannelScreen';
import DirectMessageScreen from '../screens/app/DirectMessageScreen';
import CreateGuildScreen from '../screens/app/CreateGuildScreen';
import GuildSettingsScreen from '../screens/guild/GuildSettingsScreen';
import GuildMemberListScreen from '../screens/guild/GuildMemberListScreen';
import InviteAcceptScreen from '../screens/app/InviteAcceptScreen';
import { colors, fontSize } from '../lib/theme';
import type { AppStackParamList, AppTabParamList } from './types';

const Tab = createBottomTabNavigator<AppTabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgSecondary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 25,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accentPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Guilds"
        component={GuildListScreen}
        options={{
          tabBarLabel: 'Servers',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="planet-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DMs"
        component={DMListScreen}
        options={{
          tabBarLabel: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Friends"
        component={FriendsScreen}
        options={{
          tabBarLabel: 'Friends',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.bgSecondary,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: {
          backgroundColor: colors.bgPrimary,
        },
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GuildChannels"
        component={GuildChannelsScreen}
        options={({ route }) => ({
          title: route.params.guildName,
        })}
      />
      <Stack.Screen
        name="ChannelChat"
        component={ChannelChatScreen}
        options={({ route }) => ({
          title: `#${route.params.channelName}`,
        })}
      />
      <Stack.Screen
        name="VoiceChannel"
        component={VoiceChannelScreen}
        options={({ route }) => ({
          title: route.params.channelName,
          headerBackTitle: 'Back',
        })}
      />
      <Stack.Screen
        name="DirectMessage"
        component={DirectMessageScreen}
        options={({ route }) => ({
          title: route.params.recipientName,
        })}
      />
      <Stack.Screen
        name="CreateGuild"
        component={CreateGuildScreen}
        options={{ title: 'Create Server' }}
      />
      <Stack.Screen
        name="GuildSettings"
        component={GuildSettingsScreen}
        options={({ route }) => ({
          title: `${route.params.guildName} Settings`,
        })}
      />
      <Stack.Screen
        name="GuildMemberList"
        component={GuildMemberListScreen}
        options={({ route }) => ({
          title: 'Members',
        })}
      />
      <Stack.Screen
        name="InviteAccept"
        component={InviteAcceptScreen}
        options={{ title: 'Server Invite' }}
      />
    </Stack.Navigator>
  );
}
