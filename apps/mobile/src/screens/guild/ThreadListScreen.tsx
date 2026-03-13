import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { threads as threadsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import Avatar from '../../components/Avatar';
import type { Thread } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'ThreadList'>;

type SortMode = 'latest' | 'top';

export default function ThreadListScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { channelId, channelName } = route.params;
  const [threadList, setThreadList] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('latest');

  // Create thread modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newThreadName, setNewThreadName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchThreads = useCallback(async () => {
    try {
      const data = await threadsApi.listForChannel(channelId, sortMode);
      setThreadList(data);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load threads');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [channelId, sortMode]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchThreads();
  };

  const toggleSort = () => {
    setSortMode((prev) => (prev === 'latest' ? 'top' : 'latest'));
  };

  const handleCreateThread = async () => {
    const name = newThreadName.trim();
    if (!name) return;

    setCreating(true);
    try {
      const thread = await threadsApi.create(channelId, { name });
      setShowCreate(false);
      setNewThreadName('');
      navigation.navigate('ThreadView', { threadId: thread.id, threadName: thread.name });
    } catch {
      toast.error('Failed to create thread');
    } finally {
      setCreating(false);
    }
  };

  const renderThread = ({ item }: { item: Thread }) => (
    <TouchableOpacity
      style={styles.threadItem}
      onPress={() => navigation.navigate('ThreadView', { threadId: item.id, threadName: item.name })}
    >
      <View style={styles.threadIcon}>
        <Ionicons name="chatbubbles-outline" size={22} color={colors.accentPrimary} />
      </View>
      <View style={styles.threadInfo}>
        <Text style={styles.threadName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.threadMeta}>
          {item.creatorName && (
            <Text style={styles.threadCreator} numberOfLines={1}>
              {item.creatorName}
            </Text>
          )}
          <Text style={styles.threadDot}>&middot;</Text>
          <Text style={styles.threadCount}>
            {item.messageCount ?? 0} {(item.messageCount ?? 0) === 1 ? 'message' : 'messages'}
          </Text>
          {item.lastActivity && (
            <>
              <Text style={styles.threadDot}>&middot;</Text>
              <Text style={styles.threadTime}>{formatRelativeTime(item.lastActivity)}</Text>
            </>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    toolbar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    toolbarTitle: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      flex: 1,
    },
    sortButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      backgroundColor: colors.accentLight,
      borderRadius: borderRadius.full,
    },
    sortLabel: {
      color: colors.accentPrimary,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    list: {
      paddingVertical: spacing.sm,
    },
    threadItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    threadIcon: {
      width: 40,
      height: 40,
      borderRadius: borderRadius.md,
      backgroundColor: colors.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    threadInfo: {
      flex: 1,
    },
    threadName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
      marginBottom: 2,
    },
    threadMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    threadCreator: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
    },
    threadDot: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    threadCount: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    threadTime: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    fab: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 6,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: colors.bgSecondary,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 30,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: colors.textMuted,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sheetTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '600',
    },
    sheetBody: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    fieldInput: {
      backgroundColor: colors.inputBg,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: colors.textPrimary,
      marginBottom: spacing.lg,
    },
    createButton: {
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    createButtonDisabled: {
      opacity: 0.5,
    },
    createButtonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <PatternBackground>
      {/* Sort toggle */}
      <View style={styles.toolbar}>
        <Text style={styles.toolbarTitle}>Threads in #{channelName}</Text>
        <TouchableOpacity style={styles.sortButton} onPress={toggleSort}>
          <Ionicons name="swap-vertical" size={18} color={colors.accentPrimary} />
          <Text style={styles.sortLabel}>{sortMode === 'latest' ? 'Latest' : 'Top'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={threadList}
        keyExtractor={(item) => item.id}
        renderItem={renderThread}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="No threads yet"
            subtitle="Start a conversation thread in this channel"
            actionLabel="Create Thread"
            onAction={() => setShowCreate(true)}
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)} accessibilityLabel="Create thread">
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Create Thread Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowCreate(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Create Thread</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.sheetBody}>
              <Text style={styles.fieldLabel}>Thread Name</Text>
              <TextInput
                style={styles.fieldInput}
                value={newThreadName}
                onChangeText={setNewThreadName}
                placeholder="Give your thread a name..."
                placeholderTextColor={colors.textMuted}
                autoFocus
                maxLength={100}
              />

              <TouchableOpacity
                style={[styles.createButton, (!newThreadName.trim() || creating) && styles.createButtonDisabled]}
                onPress={handleCreateThread}
                disabled={!newThreadName.trim() || creating}
              >
                <Text style={styles.createButtonText}>{creating ? 'Creating...' : 'Create Thread'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </PatternBackground>
  );
}
