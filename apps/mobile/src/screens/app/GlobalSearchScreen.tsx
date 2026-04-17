import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { search as searchApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import SearchBar from '../../components/SearchBar';
import EmptyState from '../../components/EmptyState';
import Avatar from '../../components/Avatar';
import type { SearchResult } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'GlobalSearch'>;
type SearchHasFilter = 'file' | 'image' | 'embed' | 'link';

const QUICK_FILTERS: Array<{ value: SearchHasFilter; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { value: 'image', label: 'Images', icon: 'image-outline' },
  { value: 'file', label: 'Files', icon: 'attach-outline' },
  { value: 'link', label: 'Links', icon: 'link-outline' },
  { value: 'embed', label: 'Embeds', icon: 'albums-outline' },
];

export default function GlobalSearchScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [selectedHas, setSelectedHas] = useState<SearchHasFilter | null>(null);
  const [mentionsMeOnly, setMentionsMeOnly] = useState(false);
  const PAGE_SIZE = 25;

  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      setHasMore(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const data = await searchApi.messages({
        q: q.trim(),
        has: selectedHas ?? undefined,
        mentionsMe: mentionsMeOnly,
        limit: PAGE_SIZE,
      });
      if (!mountedRef.current) return;
      setResults(data);
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Search failed');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [mentionsMeOnly, selectedHas, toast]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      performSearch(query);
    }, 350);
    return () => clearTimeout(timeout);
  }, [performSearch, query]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !query.trim()) return;
    setLoadingMore(true);
    try {
      const data = await searchApi.messages({
        q: query.trim(),
        has: selectedHas ?? undefined,
        mentionsMe: mentionsMeOnly,
        limit: PAGE_SIZE,
        offset: results.length,
      });
      if (!mountedRef.current) return;
      setResults((prev) => {
        const existingIds = new Set(prev.map((r) => r.id));
        const newResults = data.filter((r) => !existingIds.has(r.id));
        return [...prev, ...newResults];
      });
      setHasMore(data.length >= PAGE_SIZE);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load more results');
      }
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [hasMore, loadingMore, mentionsMeOnly, query, results.length, selectedHas, toast]);

  const handleQueryChange = (text: string) => {
    setQuery(text);
  };

  const handleResultPress = (item: SearchResult) => {
    if (item.guildId && item.channelId) {
      navigation.navigate('ChannelChat', {
        guildId: item.guildId,
        channelId: item.channelId,
        channelName: item.channelName || 'Channel',
      });
      return;
    }

    const details = [
      item.guildName ? `Portal: ${item.guildName}` : null,
      item.channelName ? `Channel: #${item.channelName}` : null,
      item.author ? `Author: ${item.author.displayName || item.author.username}` : null,
    ]
      .filter(Boolean)
      .join(' | ');
    toast.info(details || item.content);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    loader: {
      paddingVertical: spacing.xxxl,
    },
    list: {
      paddingVertical: spacing.sm,
    },
    resultItem: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    resultContent: {
      flex: 1,
    },
    resultHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    breadcrumb: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flex: 1,
      marginRight: spacing.sm,
    },
    guildLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '600',
      maxWidth: 100,
    },
    channelLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      maxWidth: 100,
    },
    resultTime: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    resultAuthor: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    resultText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 20,
    },
    hint: {
      alignItems: 'center',
      paddingTop: 80,
      gap: spacing.sm,
    },
    hintTitle: {
      color: colors.textSecondary,
      fontSize: fontSize.lg,
      fontWeight: '600',
    },
    hintSubtitle: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      paddingHorizontal: spacing.xxxl,
    },
    filterRow: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      gap: spacing.sm,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgSecondary,
    },
    filterChipActive: {
      borderColor: colors.accentPrimary,
      backgroundColor: colors.accentPrimary + '16',
    },
    filterChipText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    filterChipTextActive: {
      color: colors.accentPrimary,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderResult = ({ item }: { item: SearchResult }) => {
    const authorName =
      item.author?.displayName || item.author?.username || 'Unknown';

    return (
      <TouchableOpacity style={styles.resultItem} onPress={() => handleResultPress(item)}>
        <Avatar
          userId={item.author?.id}
          avatarHash={item.author?.avatarHash}
          name={authorName}
          size={36}
        />
        <View style={styles.resultContent}>
          <View style={styles.resultHeader}>
            <View style={styles.breadcrumb}>
              {item.guildName && (
                <>
                  <Text style={styles.guildLabel} numberOfLines={1}>
                    {item.guildName}
                  </Text>
                  <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
                </>
              )}
              {item.channelName && (
                <Text style={styles.channelLabel} numberOfLines={1}>
                  #{item.channelName}
                </Text>
              )}
            </View>
            <Text style={styles.resultTime}>{formatRelativeTime(item.createdAt)}</Text>
          </View>
          <Text style={styles.resultAuthor}>{authorName}</Text>
          <Text style={styles.resultText} numberOfLines={3}>
            {item.content}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <PatternBackground>
      <SearchBar
        value={query}
        onChangeText={handleQueryChange}
        placeholder="Search messages..."
        autoFocus
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {QUICK_FILTERS.map((filter) => {
          const active = selectedHas === filter.value;
          return (
            <TouchableOpacity
              key={filter.value}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setSelectedHas((current) => current === filter.value ? null : filter.value)}
            >
              <Ionicons
                name={filter.icon}
                size={16}
                color={active ? colors.accentPrimary : colors.textSecondary}
              />
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.filterChip, mentionsMeOnly && styles.filterChipActive]}
          onPress={() => setMentionsMeOnly((current) => !current)}
        >
          <Ionicons
            name="at-outline"
            size={16}
            color={mentionsMeOnly ? colors.accentPrimary : colors.textSecondary}
          />
          <Text style={[styles.filterChipText, mentionsMeOnly && styles.filterChipTextActive]}>
            Mentions Me
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.accentPrimary}
          style={styles.loader}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderResult}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={colors.accentPrimary} style={{ paddingVertical: 16 }} /> : null}
          ListEmptyComponent={
            hasSearched ? (
              <EmptyState
                icon="search-outline"
                title="No results found"
                subtitle={`No messages matching "${query}"`}
              />
            ) : (
              <View style={styles.hint}>
                <Ionicons name="search-outline" size={48} color={colors.textMuted} />
                <Text style={styles.hintTitle}>Search messages</Text>
                <Text style={styles.hintSubtitle}>
                  Find messages across all your portals and DMs. Add quick filters for files, links, or mentions when you need to narrow things down.
                </Text>
              </View>
            )
          }
        />
      )}
    </PatternBackground>
  );
}
