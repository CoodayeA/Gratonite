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
import { bookmarks as bookmarksApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme, useGlass } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { Bookmark } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'Bookmarks'>;

export default function BookmarksScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const glass = useGlass();
  const toast = useToast();
  const [bookmarkList, setBookmarkList] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookmarks = useCallback(async () => {
    try {
      const data = await bookmarksApi.list();
      setBookmarkList(data);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load bookmarks');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookmarks();
  };

  const handleDelete = (bookmark: Bookmark) => {
    Alert.alert('Remove Bookmark', 'Are you sure you want to remove this bookmark?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await bookmarksApi.delete(bookmark.messageId);
            setBookmarkList((prev) => prev.filter((b) => b.id !== bookmark.id));
          } catch {
            toast.error('Failed to remove bookmark');
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
    bookmarkItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: glass.glassBorder,
        marginHorizontal: spacing.md,
        marginBottom: spacing.sm,
      } : neo ? {
        borderBottomWidth: 2,
        borderBottomColor: colors.border,
      } : {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }),
    },
    bookmarkContent: {
      flex: 1,
    },
    bookmarkHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    channelLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: neo ? '700' : '600',
    },
    savedDate: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginLeft: 'auto',
    },
    messagePreview: {
      padding: spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: colors.accentPrimary,
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: glass.glassBorder,
      } : neo ? {
        backgroundColor: colors.bgElevated,
        borderRadius: 0,
        borderWidth: 2,
        borderColor: colors.border,
      } : {
        backgroundColor: colors.bgElevated,
        borderRadius: borderRadius.md,
      }),
    },
    authorName: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: neo ? '700' : '600',
      marginBottom: spacing.xs,
    },
    messageText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 20,
    },
    noteContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    noteText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontStyle: 'italic',
      flex: 1,
    },
    deleteButton: {
      padding: spacing.sm,
      marginLeft: spacing.sm,
      marginTop: spacing.xs,
    },
  }), [colors, spacing, fontSize, borderRadius, neo, glass]);

  const renderBookmark = ({ item }: { item: Bookmark }) => {
    const authorName = item.authorDisplayName || item.authorUsername || 'Unknown';
    const content = item.messageContent || '(no content)';
    const channelLabel = item.channelName ? `#${item.channelName}` : `#${item.channelId.slice(0, 8)}`;

    return (
      <View style={styles.bookmarkItem}>
        <View style={styles.bookmarkContent}>
          <View style={styles.bookmarkHeader}>
            <Ionicons name="bookmark" size={14} color={colors.accentPrimary} />
            <Text style={styles.channelLabel}>{channelLabel}</Text>
            <Text style={styles.savedDate}>{formatRelativeTime(item.createdAt)}</Text>
          </View>
          <View style={styles.messagePreview}>
            <Text style={styles.authorName}>{authorName}</Text>
            <Text style={styles.messageText} numberOfLines={3}>
              {content}
            </Text>
          </View>
          {item.note && (
            <View style={styles.noteContainer}>
              <Ionicons name="document-text-outline" size={12} color={colors.textMuted} />
              <Text style={styles.noteText} numberOfLines={1}>
                {item.note}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <PatternBackground>
      <FlatList
        data={bookmarkList}
        keyExtractor={(item) => item.id}
        renderItem={renderBookmark}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="bookmark-outline"
            title="No bookmarks"
            subtitle="Save messages to find them later"
          />
        }
      />
    </PatternBackground>
  );
}
