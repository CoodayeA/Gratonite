import React, { useLayoutEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type { PortalsStackParamList } from '../../navigation/types';
import { usersApi, getFileUrl } from '../../lib/api';
import { Avatar } from '../../components/ui/Avatar';
import { colors, fontSize, spacing, radius } from '../../theme';

type Nav = NativeStackNavigationProp<PortalsStackParamList, 'MemberProfile'>;
type Route = RouteProp<PortalsStackParamList, 'MemberProfile'>;

function intToHex(color: string | number | null): string | null {
  if (color === null || color === undefined) return null;
  if (typeof color === 'string') return color;
  return '#' + color.toString(16).padStart(6, '0');
}

export function MemberProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { userId } = route.params;

  const { data: profile } = useQuery<{
    id: string;
    username: string;
    displayName: string;
    bio?: string | null;
    pronouns?: string | null;
    avatarHash?: string | null;
    bannerHash?: string | null;
    accentColor?: string | number | null;
    primaryColor?: string | number | null;
    messageCount?: number;
    createdAt?: string;
  }>({
    queryKey: ['user-profile', userId],
    queryFn: () => usersApi.getProfile(userId),
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: profile?.displayName ?? profile?.username ?? 'Profile',
    });
  }, [navigation, profile]);

  const bannerColor = useMemo(() => {
    const accent = intToHex(profile?.accentColor ?? null);
    const primary = intToHex(profile?.primaryColor ?? null);
    return accent ?? primary ?? colors.brand.primary;
  }, [profile]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        bounces
      >
        {/* Banner */}
        {profile?.bannerHash ? (
          <Image
            source={{ uri: getFileUrl(profile.bannerHash) }}
            style={styles.banner}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.banner, { backgroundColor: bannerColor }]} />
        )}

        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatarRing}>
              <Avatar
                size={80}
                userId={userId}
                avatarHash={profile?.avatarHash ?? undefined}
                displayName={profile?.displayName}
                username={profile?.username}
              />
            </View>
          </View>

          {/* Name */}
          <Text style={styles.displayName}>
            {profile?.displayName ?? profile?.username ?? 'Loading...'}
          </Text>
          {profile?.username && (
            <Text style={styles.username}>@{profile.username}</Text>
          )}

          {/* Pronouns */}
          {profile?.pronouns ? (
            <Text style={styles.pronouns}>{profile.pronouns}</Text>
          ) : null}

          {/* Bio */}
          {profile?.bio ? (
            <View style={styles.bioContainer}>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          ) : null}

          {/* Info */}
          {profile?.createdAt && (
            <>
              <View style={styles.separator} />
              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Member Since</Text>
                  <Text style={styles.infoValue}>
                    {new Date(profile.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
                {(profile.messageCount ?? 0) > 0 && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Messages</Text>
                    <Text style={styles.infoValue}>
                      {(profile.messageCount ?? 0).toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['5xl'],
  },

  // Banner
  banner: {
    height: 120,
  },

  // Profile Card
  profileCard: {
    backgroundColor: colors.bg.surface,
    marginTop: -16,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.lg,
    minHeight: 300,
  },

  // Avatar
  avatarContainer: {
    alignItems: 'flex-start',
    marginTop: -40,
    paddingHorizontal: spacing.lg,
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },

  // Name
  displayName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text.primary,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  username: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    paddingHorizontal: spacing.lg,
    marginTop: 2,
  },
  pronouns: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    fontStyle: 'italic',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },

  // Bio
  bioContainer: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  bioText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },

  // Separator
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.stroke.primary,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.lg,
  },

  // Info
  infoSection: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
});
