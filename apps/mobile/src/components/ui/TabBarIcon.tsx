import React from 'react';
import { Ionicons } from '@expo/vector-icons';

type IconName = 'home' | 'portal' | 'discover' | 'inbox' | 'profile';

const iconMap: Record<IconName, { focused: keyof typeof Ionicons.glyphMap; outline: keyof typeof Ionicons.glyphMap }> = {
  home: { focused: 'chatbubbles', outline: 'chatbubbles-outline' },
  portal: { focused: 'planet', outline: 'planet-outline' },
  discover: { focused: 'compass', outline: 'compass-outline' },
  inbox: { focused: 'notifications', outline: 'notifications-outline' },
  profile: { focused: 'person-circle', outline: 'person-circle-outline' },
};

interface TabBarIconProps {
  name: IconName;
  color: string;
  size: number;
  focused?: boolean;
}

export function TabBarIcon({ name, color, size, focused = false }: TabBarIconProps) {
  const entry = iconMap[name];
  return (
    <Ionicons
      name={focused ? entry.focused : entry.outline}
      size={size}
      color={color}
    />
  );
}
