import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import type { MainTabsParamList } from './types';
import { HomeStack } from './HomeStack';
import { PortalsStack } from './PortalsStack';
import { DiscoverStack } from './DiscoverStack';
import { InboxStack } from './InboxStack';
import { ProfileStack } from './ProfileStack';
import { TabBarIcon } from '../components/ui/TabBarIcon';
import { colors } from '../theme';

const Tabs = createBottomTabNavigator<MainTabsParamList>();

function TabBarBackground() {
  return (
    <BlurView
      tint="systemChromeMaterialDark"
      intensity={80}
      style={StyleSheet.absoluteFill}
    />
  );
}

export function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: Platform.select({
          ios: {
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            position: 'absolute',
            elevation: 0,
          },
          default: {
            backgroundColor: colors.bg.primary,
            borderTopColor: colors.stroke.primary,
            borderTopWidth: 0.5,
            paddingTop: 6,
          },
        }),
        tabBarBackground: Platform.OS === 'ios' ? TabBarBackground : undefined,
      }}
    >
      <Tabs.Screen
        name="HomeTab"
        component={HomeStack}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="home" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="PortalsTab"
        component={PortalsStack}
        options={{
          tabBarLabel: 'Portals',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="portal" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="DiscoverTab"
        component={DiscoverStack}
        options={{
          tabBarLabel: 'Discover',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="discover" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="InboxTab"
        component={InboxStack}
        options={{
          tabBarLabel: 'Inbox',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="inbox" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          tabBarLabel: 'You',
          tabBarIcon: ({ color, size, focused }) => (
            <TabBarIcon name="profile" color={color} size={size} focused={focused} />
          ),
        }}
      />
    </Tabs.Navigator>
  );
}
