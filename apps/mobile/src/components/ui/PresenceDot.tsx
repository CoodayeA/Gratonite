import React from 'react';
import { View, StyleSheet } from 'react-native';

// ── Types ────────────────────────────────────────────

export type PresenceStatusType = 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';

interface PresenceDotProps {
  status: PresenceStatusType;
  size?: number;
}

// ── Presence colors ──────────────────────────────────

const PRESENCE_COLORS: Record<PresenceStatusType, string> = {
  online: '#22c55e',
  idle: '#f59e0b',
  dnd: '#ef4444',
  invisible: '#64748b',
  offline: '#64748b',
};

// ── Component ────────────────────────────────────────

export function PresenceDot({ status, size = 10 }: PresenceDotProps) {
  const color = PRESENCE_COLORS[status] ?? PRESENCE_COLORS.offline;

  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: size > 8 ? 2 : 1.5,
        },
      ]}
    />
  );
}

// ── Styles ───────────────────────────────────────────

const styles = StyleSheet.create({
  dot: {
    borderColor: '#0b0f15', // matches bg.primary for cut-out effect
  },
});
