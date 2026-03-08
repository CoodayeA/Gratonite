import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { API_BASE } from '../lib/api';
import { useColors } from '../lib/theme';
import { useUserPresence } from '../lib/presenceStore';
import type { PresenceStatus } from '../types';

interface AvatarProps {
  userId?: string;
  avatarHash?: string | null;
  name: string;
  size?: number;
  showStatus?: boolean;
  statusOverride?: PresenceStatus;
}

export default function Avatar({ userId, avatarHash, name, size = 40, showStatus = false, statusOverride }: AvatarProps) {
  const colors = useColors();
  const liveStatus = useUserPresence(userId ?? '');
  const status = statusOverride ?? liveStatus;
  const statusSize = Math.max(10, size * 0.3);

  const STATUS_COLORS: Record<PresenceStatus, string> = {
    online: colors.online,
    idle: colors.idle,
    dnd: colors.dnd,
    invisible: colors.offline,
    offline: colors.offline,
  };

  const styles = useMemo(() => StyleSheet.create({
    fallback: {
      backgroundColor: colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
    fallbackText: {
      color: colors.white,
      fontWeight: '600',
    },
    statusDot: {
      position: 'absolute',
      borderColor: colors.bgPrimary,
    },
  }), [colors]);

  const imageUrl = avatarHash
    ? `${API_BASE}/files/${avatarHash}`
    : null;

  return (
    <View style={{ width: size, height: size }}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.fallbackText, { fontSize: size * 0.4 }]}>
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      {showStatus && userId && (
        <View
          style={[
            styles.statusDot,
            {
              width: statusSize,
              height: statusSize,
              borderRadius: statusSize / 2,
              backgroundColor: STATUS_COLORS[status],
              borderWidth: statusSize * 0.2,
              right: -1,
              bottom: -1,
            },
          ]}
        />
      )}
    </View>
  );
}
