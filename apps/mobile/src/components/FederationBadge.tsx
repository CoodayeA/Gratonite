/**
 * FederationBadge — Small badge showing instance domain on federated content.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../lib/theme';

interface Props {
  domain: string;
  trustLevel?: 'verified' | 'manually_trusted' | 'auto_discovered';
  size?: 'sm' | 'md';
}

export default function FederationBadge({ domain, trustLevel = 'auto_discovered', size = 'sm' }: Props) {
  const { colors, borderRadius } = useTheme();

  const badgeColor = trustLevel === 'verified'
    ? '#22c55e'
    : trustLevel === 'manually_trusted'
      ? '#3b82f6'
      : colors.textSecondary;

  return (
    <View style={[
      styles.badge,
      {
        backgroundColor: badgeColor + '15',
        borderRadius: borderRadius.sm,
        paddingHorizontal: size === 'sm' ? 4 : 6,
        paddingVertical: size === 'sm' ? 1 : 2,
      },
    ]}>
      <Text style={[styles.text, { color: badgeColor, fontSize: size === 'sm' ? 9 : 11 }]}>
        {domain}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center' },
  text: { fontWeight: '600' },
});
