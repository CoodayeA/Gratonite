import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { PresenceDot } from './PresenceDot';
import type { PresenceStatusType } from './PresenceDot';
import { getFileUrl } from '../../lib/api';

// ── Types ────────────────────────────────────────────

interface AvatarProps {
  size: number;
  userId?: string;
  avatarHash?: string;
  displayName?: string;
  username?: string;
  showPresence?: boolean;
  presenceStatus?: PresenceStatusType;
}

// ── Color palette for fallback avatars ───────────────

const AVATAR_COLORS = [
  '#818cf8', // Indigo
  '#a78bfa', // Purple
  '#f472b6', // Pink
  '#fb923c', // Orange
  '#34d399', // Emerald
  '#22d3ee', // Cyan
  '#60a5fa', // Blue
  '#facc15', // Yellow
  '#f87171', // Red
  '#a3e635', // Lime
];

/**
 * Simple hash from a string to produce a consistent color index.
 */
function hashToColorIndex(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0; // 32-bit int
  }
  return Math.abs(hash) % AVATAR_COLORS.length;
}

// ── Component ────────────────────────────────────────

export function Avatar({
  size,
  userId,
  avatarHash,
  displayName,
  username,
  showPresence = false,
  presenceStatus = 'offline',
}: AvatarProps) {
  const initials = useMemo(() => {
    const name = displayName ?? username ?? '?';
    return name.charAt(0).toUpperCase();
  }, [displayName, username]);

  const bgColor = useMemo(() => {
    const seed = userId ?? username ?? 'default';
    return AVATAR_COLORS[hashToColorIndex(seed)];
  }, [userId, username]);

  const imageUri = avatarHash ? getFileUrl(avatarHash) : null;

  const presenceDotSize = Math.max(8, Math.round(size * 0.3));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: bgColor,
            },
          ]}
        >
          <Text
            style={[
              styles.initialsText,
              { fontSize: Math.round(size * 0.45) },
            ]}
          >
            {initials}
          </Text>
        </View>
      )}

      {showPresence && (
        <View
          style={[
            styles.presenceContainer,
            {
              bottom: -1,
              right: -1,
            },
          ]}
        >
          <PresenceDot status={presenceStatus} size={presenceDotSize} />
        </View>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    backgroundColor: '#1e293b',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  presenceContainer: {
    position: 'absolute',
  },
});
