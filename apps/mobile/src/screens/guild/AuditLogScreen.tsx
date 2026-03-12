import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { moderation as moderationApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { AuditLogEntry } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'AuditLog'>;

const ACTION_DESCRIPTIONS: Record<string, string> = {
  guild_update: 'Updated portal settings',
  channel_create: 'Created a channel',
  channel_update: 'Updated a channel',
  channel_delete: 'Deleted a channel',
  role_create: 'Created a role',
  role_update: 'Updated a role',
  role_delete: 'Deleted a role',
  member_kick: 'Kicked a member',
  member_ban: 'Banned a member',
  member_unban: 'Unbanned a member',
  member_timeout: 'Timed out a member',
  member_warn: 'Warned a member',
  member_role_update: 'Updated member roles',
  invite_create: 'Created an invite',
  invite_delete: 'Deleted an invite',
  webhook_create: 'Created a webhook',
  webhook_update: 'Updated a webhook',
  webhook_delete: 'Deleted a webhook',
  message_delete: 'Deleted a message',
  message_pin: 'Pinned a message',
  message_unpin: 'Unpinned a message',
  emoji_create: 'Created an emoji',
  emoji_delete: 'Deleted an emoji',
  sticker_create: 'Created a sticker',
  sticker_delete: 'Deleted a sticker',
};

const ACTION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  guild_update: 'settings-outline',
  channel_create: 'add-circle-outline',
  channel_update: 'create-outline',
  channel_delete: 'trash-outline',
  role_create: 'shield-outline',
  role_update: 'shield-outline',
  role_delete: 'shield-outline',
  member_kick: 'person-remove-outline',
  member_ban: 'ban-outline',
  member_unban: 'checkmark-circle-outline',
  member_timeout: 'timer-outline',
  member_warn: 'warning-outline',
  member_role_update: 'people-outline',
  invite_create: 'link-outline',
  invite_delete: 'link-outline',
  webhook_create: 'globe-outline',
  webhook_update: 'globe-outline',
  webhook_delete: 'globe-outline',
  message_delete: 'chatbubble-outline',
  message_pin: 'pin-outline',
  message_unpin: 'pin-outline',
  emoji_create: 'happy-outline',
  emoji_delete: 'happy-outline',
  sticker_create: 'image-outline',
  sticker_delete: 'image-outline',
};

const FILTER_CATEGORIES = [
  { label: 'All', value: 'all' },
  { label: 'Members', value: 'member' },
  { label: 'Channels', value: 'channel' },
  { label: 'Roles', value: 'role' },
  { label: 'Portal', value: 'guild' },
  { label: 'Messages', value: 'message' },
];

export default function AuditLogScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();

  const ACTION_COLORS: Record<string, string> = {
    member_kick: colors.warning,
    member_ban: colors.error,
    member_unban: colors.success,
    member_timeout: colors.warning,
    member_warn: colors.warning,
    channel_delete: colors.error,
    role_delete: colors.error,
    webhook_delete: colors.error,
    message_delete: colors.error,
  };

  const { guildId } = route.params;
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const fetchAuditLog = useCallback(async () => {
    try {
      const data = await moderationApi.getAuditLog(guildId, 100);
      setEntries(data);
    } catch (err: any) {
      // silently ignore — empty state handles no data
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  const filteredEntries = activeFilter === 'all'
    ? entries
    : entries.filter((e) => e.action.startsWith(activeFilter));

  const renderEntry = ({ item }: { item: AuditLogEntry }) => {
    const description = ACTION_DESCRIPTIONS[item.action] || item.action.replace(/_/g, ' ');
    const icon = ACTION_ICONS[item.action] || 'ellipse-outline';
    const iconColor = ACTION_COLORS[item.action] || colors.textSecondary;

    return (
      <View style={styles.entryRow}>
        <View style={[styles.entryIcon, { backgroundColor: `${iconColor}22` }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <View style={styles.entryInfo}>
          <Text style={styles.entryActor}>
            {item.actorName || 'Unknown'}
          </Text>
          <Text style={styles.entryDescription}>{description}</Text>
          {item.reason && (
            <Text style={styles.entryReason}>Reason: {item.reason}</Text>
          )}
          <Text style={styles.entryTime}>{formatRelativeTime(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    filterContainer: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterContent: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    filterTab: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: colors.bgElevated,
    },
    filterTabActive: {
      backgroundColor: colors.accentPrimary,
    },
    filterTabText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    filterTabTextActive: {
      color: colors.white,
    },
    listContent: {
      paddingBottom: spacing.xxxl,
    },
    entryRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    entryIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    entryInfo: {
      flex: 1,
    },
    entryActor: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    entryDescription: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      marginTop: 2,
    },
    entryReason: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontStyle: 'italic',
      marginTop: spacing.xs,
    },
    entryTime: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: spacing.xs,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  return (
    <PatternBackground>
      {/* Filter tabs */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTER_CATEGORIES}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.filterContent}
          renderItem={({ item: category }) => (
            <TouchableOpacity
              style={[styles.filterTab, activeFilter === category.value && styles.filterTabActive]}
              onPress={() => setActiveFilter(category.value)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeFilter === category.value && styles.filterTabTextActive,
                ]}
              >
                {category.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item.id}
        renderItem={renderEntry}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="document-text-outline"
            title="No audit log entries"
            subtitle={activeFilter !== 'all' ? 'Try a different filter' : 'Actions will appear here'}
          />
        }
      />
    </PatternBackground>
  );
}
