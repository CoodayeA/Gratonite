import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DiscoverStackParamList } from '../../navigation/types';
import { discoverApi, getFileUrl } from '../../lib/api';
import { colors, fontSize, spacing, radius } from '../../theme';

// ── Types ─────────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<DiscoverStackParamList, 'Discover'>;

type DiscoverTab = 'portals' | 'bots' | 'themes';
type SortOption = 'trending' | 'new' | 'name';

interface DiscoverGuild {
  id: string;
  name: string;
  description?: string;
  iconHash?: string;
  memberCount?: number;
  tags?: string[];
  boostTier?: number;
  features?: string[];
}

interface CardItem {
  id: string;
  name: string;
  desc: string;
  tags: string[];
}

// ── Static Data (matches web app) ─────────────────────────────────────────

const BOT_CARDS: CardItem[] = [
  { id: 'mod', name: 'Portal Guard', desc: 'Moderation workflows, logs, and safety automations.', tags: ['safety', 'moderation'] },
  { id: 'music', name: 'Pulse', desc: 'Voice-room music and sound queue controls.', tags: ['audio', 'voice'] },
  { id: 'ops', name: 'Patchnote', desc: 'Release announcements, status posts, and deploy reminders.', tags: ['ops', 'productivity'] },
];

const THEME_CARDS: CardItem[] = [
  { id: 'ice', name: 'Ice Glass', desc: 'Cool cyan accents and clean glass surfaces.', tags: ['light', 'glass'] },
  { id: 'ember', name: 'Ember', desc: 'Warm amber accents with premium contrast.', tags: ['warm', 'glass'] },
  { id: 'soul', name: 'Soul Aurora', desc: 'Faceted neon highlights inspired by the Soul prototype.', tags: ['aurora', 'premium'] },
];

const BOT_TAGS = ['moderation', 'voice', 'music', 'productivity', 'fun'];
const THEME_TAGS = ['glass', 'light', 'aurora', 'cyber', 'minimal'];
const FALLBACK_PORTAL_TAGS = ['gaming', 'productivity', 'creative', 'study', 'social'];

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'trending', label: 'Trending' },
  { key: 'new', label: 'Newest' },
  { key: 'name', label: 'Name' },
];

// ── Constants ─────────────────────────────────────────────────────────────

const COLUMN_COUNT = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = spacing.md;

// ── Helpers ───────────────────────────────────────────────────────────────

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 45%)`;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatMemberCount(count?: number): string {
  if (!count) return '0';
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

// ── GuildIcon Component ───────────────────────────────────────────────────

function GuildIcon({ guild, size }: { guild: DiscoverGuild; size: number }) {
  const bgColor = stringToColor(guild.id);
  const imageUri = guild.iconHash ? getFileUrl(guild.iconHash) : null;
  const borderRadius = size * 0.22;

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={{
          width: size,
          height: size,
          borderRadius,
          backgroundColor: bgColor,
        }}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
      />
    );
  }

  return (
    <View
      style={[
        styles.guildIcon,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: bgColor,
        },
      ]}
    >
      <Text style={[styles.guildIconText, { fontSize: size * 0.35 }]}>
        {getInitials(guild.name)}
      </Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────

export function DiscoverScreen() {
  const navigation = useNavigation<Nav>();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<DiscoverTab>('portals');
  const [sortBy, setSortBy] = useState<SortOption>('trending');
  const [activeTag, setActiveTag] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset tag when switching tabs
  useEffect(() => {
    setActiveTag('all');
  }, [activeTab]);

  // Debounced search
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery]);

  // ── Data Fetching ───────────────────────────────────────────────────────

  const {
    data: guilds = [],
    isLoading,
    refetch,
  } = useQuery<DiscoverGuild[]>({
    queryKey: ['discover', debouncedQuery],
    queryFn: () => discoverApi.browse({ query: debouncedQuery || undefined, limit: 50 }),
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // ── Tags per tab ───────────────────────────────────────────────────────

  const activeTags = useMemo(() => {
    if (activeTab === 'bots') return BOT_TAGS;
    if (activeTab === 'themes') return THEME_TAGS;
    // Extract tags from portal data, fallback to defaults
    const tagCounts = new Map<string, number>();
    guilds.forEach((g) =>
      g.tags?.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)),
    );
    if (tagCounts.size === 0) return FALLBACK_PORTAL_TAGS;
    return [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([t]) => t);
  }, [activeTab, guilds]);

  // ── Filtered & sorted cards for bots/themes ────────────────────────────

  const filteredCards = useMemo(() => {
    const source = activeTab === 'bots' ? BOT_CARDS : THEME_CARDS;
    const q = debouncedQuery.trim().toLowerCase();
    const filtered = source.filter((card) => {
      const matchesQ =
        !q ||
        card.name.toLowerCase().includes(q) ||
        card.desc.toLowerCase().includes(q);
      const matchesTag = activeTag === 'all' || card.tags.includes(activeTag);
      return matchesQ && matchesTag;
    });
    if (sortBy === 'name') return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'new') return [...filtered].sort((a, b) => b.id.localeCompare(a.id));
    return filtered;
  }, [activeTab, debouncedQuery, activeTag, sortBy]);

  // ── Filtered & sorted portals ──────────────────────────────────────────

  const filteredGuilds = useMemo(() => {
    let result = guilds;
    if (activeTag !== 'all') {
      result = result.filter((g) => g.tags?.includes(activeTag));
    }
    if (sortBy === 'name') return [...result].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'new') return [...result].sort((a, b) => b.id.localeCompare(a.id));
    return result;
  }, [guilds, activeTag, sortBy]);

  // ── Tab pills ───────────────────────────────────────────────────────────

  const tabs: { key: DiscoverTab; label: string }[] = [
    { key: 'portals', label: 'Portals' },
    { key: 'bots', label: 'Bots' },
    { key: 'themes', label: 'Themes' },
  ];

  const hasActiveFilters = debouncedQuery.length > 0 || activeTag !== 'all';

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
    setActiveTag('all');
    setSortBy('trending');
  }, []);

  // ── Navigation ──────────────────────────────────────────────────────────

  const handleGuildPress = useCallback(
    (guildId: string) => {
      navigation.navigate('GuildPreview', { guildId });
    },
    [navigation],
  );

  // ── Render Guild Card ──────────────────────────────────────────────────

  const renderGuildCard = useCallback(
    ({ item }: { item: DiscoverGuild }) => (
      <TouchableOpacity
        style={styles.guildCard}
        activeOpacity={0.7}
        onPress={() => handleGuildPress(item.id)}
      >
        <GuildIcon guild={item} size={52} />
        <Text style={styles.guildName} numberOfLines={1}>
          {item.name}
        </Text>
        {item.description ? (
          <Text style={styles.guildDesc} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.guildMeta}>
          <View style={styles.memberBadge}>
            <View style={styles.memberDot} />
            <Text style={styles.memberCount}>
              {formatMemberCount(item.memberCount)}
            </Text>
          </View>
        </View>
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {item.tags.slice(0, 2).map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}
        <TouchableOpacity
          style={styles.joinButton}
          onPress={() => handleGuildPress(item.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.joinButtonText}>Preview</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    ),
    [handleGuildPress],
  );

  // ── Render Bot/Theme Card ──────────────────────────────────────────────

  const renderCardItem = useCallback(
    ({ item }: { item: CardItem }) => (
      <View style={styles.cardItem}>
        <View
          style={[
            styles.cardIcon,
            {
              backgroundColor:
                activeTab === 'bots'
                  ? 'rgba(129, 140, 248, 0.15)'
                  : 'rgba(168, 85, 247, 0.15)',
            },
          ]}
        >
          <Text style={styles.cardIconText}>
            {activeTab === 'bots' ? '\u{1F916}' : '\u{1F3A8}'}
          </Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.cardDesc} numberOfLines={2}>
            {item.desc}
          </Text>
          <View style={styles.cardTagsRow}>
            {item.tags.map((t) => (
              <View key={t} style={styles.cardTag}>
                <Text style={styles.cardTagText}>#{t}</Text>
              </View>
            ))}
          </View>
        </View>
        <TouchableOpacity style={styles.cardCta} activeOpacity={0.7} disabled>
          <Text style={styles.cardCtaText}>
            {activeTab === 'bots' ? 'Install (Soon)' : 'Preview (Soon)'}
          </Text>
        </TouchableOpacity>
      </View>
    ),
    [activeTab],
  );

  // ── Summary text ───────────────────────────────────────────────────────

  const tabSummary = useMemo(() => {
    if (activeTab === 'portals') {
      return `${filteredGuilds.length} portal${filteredGuilds.length !== 1 ? 's' : ''}`;
    }
    if (activeTab === 'bots') {
      return `${filteredCards.length} bot${filteredCards.length !== 1 ? 's' : ''}`;
    }
    return `${filteredCards.length} theme${filteredCards.length !== 1 ? 's' : ''}`;
  }, [activeTab, filteredGuilds.length, filteredCards.length]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>Discover</Text>
          <Text style={styles.headerTitle}>Find Portals, Bots & Themes</Text>
        </View>
      </View>

      {/* Tab Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
        style={styles.tabBarOuter}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabPill,
              activeTab === tab.key && styles.tabPillActive,
            ]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabPillText,
                activeTab === tab.key && styles.tabPillTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search + Sort Row */}
      <View style={styles.controlsRow}>
        <View style={styles.searchInputWrapper}>
          <Text style={styles.searchIcon}>{'\uD83D\uDD0D'}</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={
              activeTab === 'portals'
                ? 'Search portals...'
                : activeTab === 'bots'
                  ? 'Search bots...'
                  : 'Search themes...'
            }
            placeholderTextColor={colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearButton}
              activeOpacity={0.7}
            >
              <Text style={styles.clearButtonText}>{'\u2715'}</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setShowSortMenu(!showSortMenu)}
          activeOpacity={0.7}
        >
          <Text style={styles.sortButtonText}>
            {SORT_OPTIONS.find((s) => s.key === sortBy)?.label ?? 'Sort'}
          </Text>
          <Text style={styles.sortChevron}>{'\u25BE'}</Text>
        </TouchableOpacity>
      </View>

      {/* Sort dropdown */}
      {showSortMenu && (
        <View style={styles.sortDropdown}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.sortOption,
                sortBy === opt.key && styles.sortOptionActive,
              ]}
              onPress={() => {
                setSortBy(opt.key);
                setShowSortMenu(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sortOptionText,
                  sortBy === opt.key && styles.sortOptionTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Tag filter row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tagFilterRow}
        style={styles.tagFilterOuter}
      >
        <TouchableOpacity
          style={[
            styles.tagFilterChip,
            activeTag === 'all' && styles.tagFilterChipActive,
          ]}
          onPress={() => setActiveTag('all')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tagFilterText,
              activeTag === 'all' && styles.tagFilterTextActive,
            ]}
          >
            #all
          </Text>
        </TouchableOpacity>
        {activeTags.map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.tagFilterChip,
              activeTag === t && styles.tagFilterChipActive,
            ]}
            onPress={() => setActiveTag(activeTag === t ? 'all' : t)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tagFilterText,
                activeTag === t && styles.tagFilterTextActive,
              ]}
            >
              #{t}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Meta row */}
      <View style={styles.metaRow}>
        <View style={styles.metaPill}>
          <Text style={styles.metaPillText}>{tabSummary}</Text>
        </View>
        {hasActiveFilters && (
          <TouchableOpacity onPress={clearFilters} activeOpacity={0.7}>
            <Text style={styles.clearFiltersText}>Clear filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View style={styles.listContainer}>
        {activeTab === 'portals' ? (
          /* Portals grid */
          filteredGuilds.length === 0 && !isLoading ? (
            <View style={styles.emptyState}>
              {isLoading ? (
                <ActivityIndicator size="large" color={colors.brand.primary} />
              ) : (
                <>
                  <Text style={styles.emptyIcon}>{'\uD83D\uDD0D'}</Text>
                  <Text style={styles.emptyTitle}>
                    {debouncedQuery ? 'No results found' : 'Discover new portals'}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {debouncedQuery
                      ? `No portals matching "${debouncedQuery}"`
                      : 'Search for communities to explore and join'}
                  </Text>
                </>
              )}
            </View>
          ) : (
            <FlashList
              data={filteredGuilds}
              renderItem={renderGuildCard}
              keyExtractor={(item) => item.id}
              numColumns={COLUMN_COUNT}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={colors.brand.primary}
                />
              }
              ItemSeparatorComponent={() => <View style={{ height: CARD_GAP }} />}
              ListEmptyComponent={
                isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.brand.primary} />
                  </View>
                ) : null
              }
            />
          )
        ) : (
          /* Bots / Themes list */
          <ScrollView
            contentContainerStyle={styles.cardsContainer}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={() => {}}
                tintColor={colors.brand.primary}
              />
            }
          >
            {filteredCards.length === 0 ? (
              <View style={styles.emptyInline}>
                <Text style={styles.emptyInlineTitle}>No results yet.</Text>
                <Text style={styles.emptyInlineSubtitle}>
                  Try a different search, clear the tag filter, or switch tabs.
                </Text>
                <TouchableOpacity onPress={clearFilters} activeOpacity={0.7}>
                  <Text style={styles.clearFiltersText}>Reset filters</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredCards.map((card) => (
                <View key={card.id}>
                  {renderCardItem({ item: card })}
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerEyebrow: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.brand.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text.primary,
  },

  // Tab pills
  tabBarOuter: {
    flexGrow: 0,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  tabBar: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  tabPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bg.elevated,
  },
  tabPillActive: {
    backgroundColor: colors.brand.primary,
  },
  tabPillText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tabPillTextActive: {
    color: '#ffffff',
  },

  // Controls row (search + sort)
  controlsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text.primary,
  },
  clearButton: {
    padding: spacing.xs,
  },
  clearButtonText: {
    fontSize: 14,
    color: colors.text.muted,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  sortButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  sortChevron: {
    fontSize: 10,
    color: colors.text.muted,
  },

  // Sort dropdown
  sortDropdown: {
    position: 'absolute',
    top: 155,
    right: spacing.lg,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    zIndex: 100,
    overflow: 'hidden',
  },
  sortOption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  sortOptionActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
  },
  sortOptionText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: colors.brand.primary,
    fontWeight: '600',
  },

  // Tag filter row
  tagFilterOuter: {
    flexGrow: 0,
    marginBottom: spacing.sm,
  },
  tagFilterRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  tagFilterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.full,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  tagFilterChipActive: {
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    borderColor: colors.brand.primary,
  },
  tagFilterText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.text.muted,
  },
  tagFilterTextActive: {
    color: colors.brand.primary,
    fontWeight: '600',
  },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  metaPill: {
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  metaPillText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.brand.primary,
  },
  clearFiltersText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    color: colors.text.link,
  },

  // Grid / list
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  loadingContainer: {
    paddingVertical: spacing['5xl'],
    alignItems: 'center',
  },

  // Guild card (portals tab)
  guildCard: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginHorizontal: CARD_GAP / 2,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    minHeight: 200,
  },
  guildIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  guildIconText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  guildName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  guildDesc: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  guildMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.online,
  },
  memberCount: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    justifyContent: 'center',
  },
  tagChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
  },
  tagText: {
    fontSize: fontSize.xs - 1,
    color: colors.brand.primary,
    fontWeight: '500',
  },
  joinButton: {
    marginTop: 'auto',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
  },
  joinButtonText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.brand.primary,
  },

  // Bot / Theme card (list item style)
  cardsContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['5xl'],
    gap: spacing.sm,
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke.primary,
    gap: spacing.md,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconText: {
    fontSize: 22,
  },
  cardBody: {
    flex: 1,
  },
  cardName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    lineHeight: 16,
    marginBottom: spacing.xs,
  },
  cardTagsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  cardTag: {
    paddingHorizontal: spacing.sm - 2,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
  },
  cardTagText: {
    fontSize: fontSize.xs - 2,
    color: colors.brand.primary,
    fontWeight: '500',
  },
  cardCta: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(129, 140, 248, 0.12)',
    opacity: 0.6,
  },
  cardCtaText: {
    fontSize: fontSize.xs - 1,
    fontWeight: '600',
    color: colors.brand.primary,
  },

  // Empty states
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['4xl'],
    paddingVertical: spacing['5xl'],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyInline: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyInlineTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text.primary,
  },
  emptyInlineSubtitle: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
