import React from 'react';
import { TouchableOpacity, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors, spacing, borderRadius } from '../lib/theme';
import { lightImpact } from '../lib/haptics';

interface ScrollToBottomFABProps {
  visible: boolean;
  onPress: () => void;
  unreadCount?: number;
}

export default function ScrollToBottomFAB({ visible, onPress, unreadCount }: ScrollToBottomFABProps) {
  const colors = useColors();

  if (!visible) return null;

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.container}>
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
        onPress={() => { lightImpact(); onPress(); }}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Scroll to bottom"
      >
        <Ionicons name="chevron-down" size={22} color={colors.textPrimary} />
        {unreadCount != null && unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.accentPrimary }]}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    bottom: 8,
  },
  fab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
