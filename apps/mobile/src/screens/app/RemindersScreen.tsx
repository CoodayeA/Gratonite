import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reminders as remindersApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import LoadErrorCard from '../../components/LoadErrorCard';
import EmptyState from '../../components/EmptyState';
import type { Reminder } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'Reminders'>;

function formatTimeRemaining(remindAt: string): string {
  const diff = new Date(remindAt).getTime() - Date.now();
  if (diff <= 0) return 'due now';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}

export default function RemindersScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [reminderList, setReminderList] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReminders = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await remindersApi.list();
      setReminderList(data.filter((r) => !r.fired));
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load reminders';
        if (refreshing || reminderList.length > 0) { toast.error(message); } else { setLoadError(message); }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, reminderList.length]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReminders();
  };

  const handleDelete = (reminder: Reminder) => {
    Alert.alert('Delete Reminder', 'Are you sure you want to delete this reminder?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remindersApi.delete(reminder.id);
            setReminderList((prev) => prev.filter((r) => r.id !== reminder.id));
          } catch {
            toast.error('Failed to delete reminder');
          }
        },
      },
    ]);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    list: {
      paddingVertical: spacing.sm,
    },
    reminderItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...(neo ? { borderBottomWidth: 2, borderBottomColor: colors.border } : {}),
    },
    reminderContent: {
      flex: 1,
    },
    reminderHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    timeLabel: {
      color: colors.accentPrimary,
      fontSize: fontSize.xs,
      fontWeight: neo ? '700' : '600',
    },
    createdDate: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginLeft: 'auto',
    },
    messagePreview: {
      backgroundColor: colors.bgElevated,
      borderRadius: neo ? 0 : borderRadius.md,
      padding: spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: colors.accentPrimary,
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
    },
    messageText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 20,
    },
    deleteButton: {
      padding: spacing.sm,
      marginLeft: spacing.sm,
      marginTop: spacing.xs,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderReminder = ({ item }: { item: Reminder }) => (
    <View style={styles.reminderItem}>
      <View style={styles.reminderContent}>
        <View style={styles.reminderHeader}>
          <Ionicons name="alarm" size={14} color={colors.accentPrimary} />
          <Text style={styles.timeLabel}>{formatTimeRemaining(item.remindAt)}</Text>
          <Text style={styles.createdDate}>{formatRelativeTime(item.createdAt)}</Text>
        </View>
        <View style={styles.messagePreview}>
          <Text style={styles.messageText} numberOfLines={3}>
            {item.content || '(no content)'}
          </Text>
        </View>
      </View>
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)} accessibilityLabel="Delete reminder">
        <Ionicons name="trash-outline" size={18} color={colors.error} />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return <LoadingScreen />;
  }

  if (loadError && reminderList.length === 0) return <LoadErrorCard title="Failed to load reminders" message={loadError} onRetry={() => { setLoading(true); fetchReminders(); }} />;

  return (
    <PatternBackground>
      <FlatList
        data={reminderList}
        keyExtractor={(item) => item.id}
        renderItem={renderReminder}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="alarm-outline"
            title="No reminders"
            subtitle="Set reminders from the message context menu"
          />
        }
      />
    </PatternBackground>
  );
}
