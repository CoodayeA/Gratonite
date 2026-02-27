import React, { useLayoutEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PortalsStackParamList } from '../../navigation/types';
import { guildsApi, getFileUrl } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { colors, fontSize, spacing, radius } from '../../theme';

// ── Types ─────────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<PortalsStackParamList, 'GuildSettings'>;
type Route = RouteProp<PortalsStackParamList, 'GuildSettings'>;

interface Guild {
  id: string;
  name: string;
  ownerId: string;
  iconHash: string | null;
  bannerHash: string | null;
  description: string | null;
  memberCount: number;
}

interface GuildEmoji {
  id: string;
  name: string;
  imageHash: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 45%)`;
}

function guildInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ── Main Screen ───────────────────────────────────────────────────────────

export function GuildSettingsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { guildId } = route.params;
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // ── Data Fetching ─────────────────────────────────────────────────────

  const { data: guild, isLoading: guildLoading } = useQuery<Guild>({
    queryKey: ['guild', guildId],
    queryFn: () => guildsApi.get(guildId),
  });

  const { data: emojis } = useQuery<GuildEmoji[]>({
    queryKey: ['guild-emojis', guildId],
    queryFn: () => guildsApi.getEmojis(guildId),
  });

  // ── Mutations ─────────────────────────────────────────────────────────

  const leaveMutation = useMutation({
    mutationFn: () => guildsApi.leave(guildId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guilds'] });
      navigation.popToTop();
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => guildsApi.delete(guildId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guilds'] });
      navigation.popToTop();
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message);
    },
  });

  const deleteEmojiMutation = useMutation({
    mutationFn: (emojiId: string) => guildsApi.deleteEmoji(guildId, emojiId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild-emojis', guildId] });
    },
    onError: (err: Error) => {
      Alert.alert('Failed to delete emoji', err.message);
    },
  });

  // ── Header ────────────────────────────────────────────────────────────

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Portal Settings',
    });
  }, [navigation]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const isOwner = guild?.ownerId === user?.id;

  // Android delete confirmation state (Alert.prompt is iOS-only)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleLeave = useCallback(() => {
    Alert.alert(
      'Leave Portal',
      `Are you sure you want to leave ${guild?.name ?? 'this portal'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => leaveMutation.mutate(),
        },
      ],
    );
  }, [guild?.name, leaveMutation]);

  const handleDelete = useCallback(() => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Delete Portal',
        `This action is irreversible. Type "${guild?.name}" to confirm deletion.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: (value?: string) => {
              if (value === guild?.name) {
                deleteMutation.mutate();
              } else {
                Alert.alert('Name mismatch', 'The portal name you entered does not match.');
              }
            },
          },
        ],
        'plain-text',
      );
    } else {
      // Android: show inline confirmation with TextInput
      setDeleteConfirmText('');
      setShowDeleteConfirm(true);
    }
  }, [guild?.name, deleteMutation]);

  const handleConfirmDeleteAndroid = useCallback(() => {
    if (deleteConfirmText === guild?.name) {
      deleteMutation.mutate();
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    } else {
      Alert.alert('Name mismatch', 'The portal name you entered does not match.');
    }
  }, [deleteConfirmText, guild?.name, deleteMutation]);

  const handleCancelDeleteAndroid = useCallback(() => {
    setShowDeleteConfirm(false);
    setDeleteConfirmText('');
  }, []);

  const handleDeleteEmoji = useCallback(
    (emoji: GuildEmoji) => {
      Alert.alert(
        'Delete Emoji',
        `Are you sure you want to delete :${emoji.name}:?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteEmojiMutation.mutate(emoji.id),
          },
        ],
      );
    },
    [deleteEmojiMutation],
  );

  // ── Settings Rows ─────────────────────────────────────────────────────

  const settingsRows = useMemo<
    Array<{ icon: string; label: string; onPress: () => void }>
  >(
    () => [
      {
        icon: '\uD83D\uDC65',
        label: 'Members',
        onPress: () => navigation.navigate('GuildMembers', { guildId }),
      },
      {
        icon: '\uD83D\uDEE1\uFE0F',
        label: 'Roles',
        onPress: () => navigation.navigate('GuildRoles', { guildId }),
      },
      {
        icon: '\uD83D\uDCCB',
        label: 'Channels',
        onPress: () => navigation.navigate('GuildChannels', { guildId }),
      },
      {
        icon: '\u2709\uFE0F',
        label: 'Invites',
        onPress: () => navigation.navigate('GuildInvites', { guildId }),
      },
    ],
    [navigation, guildId],
  );

  // ── Loading State ─────────────────────────────────────────────────────

  if (!guild) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Portal Header Card ──────────────────────────────────────── */}
      <View style={styles.headerCard}>
        {/* Banner image */}
        {guild.bannerHash ? (
          <Image
            source={{ uri: getFileUrl(guild.bannerHash) }}
            style={styles.bannerImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.bannerPlaceholder, { backgroundColor: stringToColor(guild.id) }]} />
        )}

        <View style={styles.headerCardInner}>
          {/* Icon overlaps banner */}
          <View style={styles.guildIconWrapper}>
            {guild.iconHash ? (
              <Image
                source={{ uri: getFileUrl(guild.iconHash) }}
                style={styles.guildIcon}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
            ) : (
              <View
                style={[
                  styles.guildIcon,
                  { backgroundColor: stringToColor(guild.id) },
                ]}
              >
                <Text style={styles.guildIconText}>
                  {guildInitials(guild.name)}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.guildName}>{guild.name}</Text>

          {guild.description ? (
            <Text style={styles.guildDescription}>{guild.description}</Text>
          ) : null}

          <View style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>
              {guild.memberCount} {guild.memberCount === 1 ? 'member' : 'members'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Settings Section ────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.sectionCard}>
          {settingsRows.map((row, index) => (
            <TouchableOpacity
              key={row.label}
              style={[
                styles.settingsRow,
                index < settingsRows.length - 1 && styles.settingsRowBorder,
              ]}
              onPress={row.onPress}
              activeOpacity={0.7}
            >
              <Text style={styles.settingsRowIcon}>{row.icon}</Text>
              <Text style={styles.settingsRowLabel}>{row.label}</Text>
              <Text style={styles.settingsRowChevron}>{'\u203A'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Emojis Section ──────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Emojis{emojis ? ` (${emojis.length})` : ''}
        </Text>
        <View style={styles.sectionCard}>
          {emojis && emojis.length > 0 ? (
            <View style={styles.emojiGrid}>
              {emojis.map((emoji) => (
                <View key={emoji.id} style={styles.emojiItemWrapper}>
                  {isOwner && (
                    <TouchableOpacity
                      style={styles.emojiDeleteBtn}
                      onPress={() => handleDeleteEmoji(emoji)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={styles.emojiDeleteBtnText}>{'\u00D7'}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.emojiItem}
                    activeOpacity={0.7}
                    onLongPress={isOwner ? () => handleDeleteEmoji(emoji) : undefined}
                  >
                    <Image
                      source={{ uri: getFileUrl(emoji.imageHash) }}
                      style={styles.emojiImage}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                    <Text style={styles.emojiName} numberOfLines={1}>
                      {emoji.name}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyEmojis}>
              <Text style={styles.emptyEmojisText}>No emojis yet</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Danger Zone ─────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.dangerSectionTitle}>Danger Zone</Text>
        <View style={styles.sectionCard}>
          {!isOwner && (
            <TouchableOpacity
              style={[
                styles.settingsRow,
                isOwner && styles.settingsRowBorder,
              ]}
              onPress={handleLeave}
              activeOpacity={0.7}
              disabled={leaveMutation.isPending}
            >
              <Text style={styles.settingsRowIcon}>{'\uD83D\uDEAA'}</Text>
              <Text style={styles.dangerRowLabel}>
                {leaveMutation.isPending ? 'Leaving...' : 'Leave Portal'}
              </Text>
              <Text style={styles.settingsRowChevron}>{'\u203A'}</Text>
            </TouchableOpacity>
          )}

          {isOwner && (
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={handleDelete}
              activeOpacity={0.7}
              disabled={deleteMutation.isPending}
            >
              <Text style={styles.settingsRowIcon}>{'\uD83D\uDDD1\uFE0F'}</Text>
              <Text style={styles.dangerRowLabel}>
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Portal'}
              </Text>
              <Text style={styles.settingsRowChevron}>{'\u203A'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Android inline delete confirmation */}
        {showDeleteConfirm && (
          <View style={styles.deleteConfirmCard}>
            <Text style={styles.deleteConfirmWarning}>
              This action is irreversible. Type{' '}
              <Text style={styles.deleteConfirmGuildName}>
                {guild.name}
              </Text>{' '}
              to confirm deletion.
            </Text>
            <TextInput
              style={styles.deleteConfirmInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder={`Type "${guild.name}" to confirm`}
              placeholderTextColor={colors.text.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.deleteConfirmActions}>
              <TouchableOpacity
                style={styles.deleteConfirmCancelBtn}
                onPress={handleCancelDeleteAndroid}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteConfirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deleteConfirmDeleteBtn,
                  deleteConfirmText !== guild.name && styles.deleteConfirmDeleteBtnDisabled,
                ]}
                onPress={handleConfirmDeleteAndroid}
                activeOpacity={0.7}
                disabled={deleteConfirmText !== guild.name}
              >
                <Text
                  style={[
                    styles.deleteConfirmDeleteText,
                    deleteConfirmText !== guild.name && styles.deleteConfirmDeleteTextDisabled,
                  ]}
                >
                  Confirm Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing['5xl'],
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header Card
  headerCard: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: 110,
  },
  bannerPlaceholder: {
    width: '100%',
    height: 110,
    opacity: 0.6,
  },
  headerCardInner: {
    alignItems: 'center',
    paddingBottom: spacing['2xl'],
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
  },
  guildIconWrapper: {
    marginTop: -36,
    marginBottom: spacing.md,
    borderRadius: radius.xl + 4,
    borderWidth: 4,
    borderColor: colors.bg.elevated,
    overflow: 'hidden',
  },
  guildIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guildIconText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
  },
  guildName: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  guildDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textAlign: 'center',
    lineHeight: 18,
  },
  memberBadge: {
    backgroundColor: colors.brand.primary + '18',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  memberBadgeText: {
    color: colors.brand.primary,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    overflow: 'hidden',
  },

  // Settings Rows
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  settingsRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.primary,
  },
  settingsRowIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  settingsRowLabel: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
  },
  settingsRowChevron: {
    fontSize: 22,
    color: colors.text.muted,
    fontWeight: '300',
  },

  // Emojis
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.md,
  },
  emojiItem: {
    alignItems: 'center',
    width: 56,
  },
  emojiImage: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
  },
  emojiName: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginTop: spacing.xs,
    maxWidth: 56,
    textAlign: 'center',
  },
  emptyEmojis: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyEmojisText: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },

  // Danger Zone
  dangerSectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.accent.error,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  dangerRowLabel: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.accent.error,
  },

  // Delete Confirmation (Android)
  deleteConfirmCard: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent.error + '44',
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  deleteConfirmWarning: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  deleteConfirmGuildName: {
    fontWeight: '700',
    color: colors.text.primary,
  },
  deleteConfirmInput: {
    backgroundColor: colors.bg.primary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.md,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  deleteConfirmActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  deleteConfirmCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    backgroundColor: colors.bg.primary,
  },
  deleteConfirmCancelText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  deleteConfirmDeleteBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.accent.error,
  },
  deleteConfirmDeleteBtnDisabled: {
    opacity: 0.4,
  },
  deleteConfirmDeleteText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#ffffff',
  },
  deleteConfirmDeleteTextDisabled: {
    color: '#ffffff',
  },

  // Emoji Delete Button
  emojiItemWrapper: {
    position: 'relative' as const,
    alignItems: 'center' as const,
    width: 56,
  },
  emojiDeleteBtn: {
    position: 'absolute' as const,
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent.error,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    zIndex: 1,
  },
  emojiDeleteBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
});
