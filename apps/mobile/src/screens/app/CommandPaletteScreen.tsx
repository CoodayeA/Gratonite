import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { guilds as guildsApi, channels as channelsApi } from '../../lib/api';
import { useTheme, useGlass } from '../../lib/theme';
import { selectionFeedback } from '../../lib/haptics';
import type { Guild, Channel } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'CommandPalette'>;

interface SearchResult {
  id: string;
  type: 'server' | 'channel' | 'action';
  title: string;
  subtitle?: string;
  icon: string;
  guildId?: string;
}

const ACTIONS: SearchResult[] = [
  { id: 'action-settings', type: 'action', title: 'Settings', icon: 'settings-outline' },
  { id: 'action-wallet', type: 'action', title: 'Wallet', icon: 'wallet-outline' },
  { id: 'action-shop', type: 'action', title: 'Shop', icon: 'cart-outline' },
  { id: 'action-inventory', type: 'action', title: 'Inventory', icon: 'cube-outline' },
  { id: 'action-bookmarks', type: 'action', title: 'Saved Messages', icon: 'bookmark-outline' },
  { id: 'action-friends', type: 'action', title: 'Friends', icon: 'people-outline' },
  { id: 'action-discover', type: 'action', title: 'Discover Portals', icon: 'compass-outline' },
  { id: 'action-auctions', type: 'action', title: 'Auctions', icon: 'hammer-outline' },
  { id: 'action-help', type: 'action', title: 'Help Center', icon: 'help-circle-outline' },
  { id: 'action-events', type: 'action', title: 'Seasonal Events', icon: 'calendar-outline' },
  { id: 'action-interests', type: 'action', title: 'Interest Tags', icon: 'pricetag-outline' },
  { id: 'action-connections', type: 'action', title: 'Connections', icon: 'link-outline' },
  { id: 'action-achievements', type: 'action', title: 'Achievements', icon: 'trophy-outline' },
  { id: 'action-feedback', type: 'action', title: 'Feedback', icon: 'chatbox-outline' },
];

const ACTION_ROUTES: Record<string, keyof AppStackParamList> = {
  'action-settings': 'Settings',
  'action-wallet': 'Wallet',
  'action-shop': 'Shop',
  'action-inventory': 'Inventory',
  'action-bookmarks': 'Bookmarks',
  'action-discover': 'ServerDiscover',
  'action-auctions': 'Auctions',
  'action-help': 'HelpCenter',
  'action-events': 'SeasonalEvents',
  'action-interests': 'InterestTags',
  'action-connections': 'Connections',
  'action-achievements': 'Achievements',
  'action-feedback': 'Feedback',
};

export default function CommandPaletteScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const glass = useGlass();
  const [query, setQuery] = useState('');
  const [serverResults, setServerResults] = useState<SearchResult[]>([]);
  const [allServers, setAllServers] = useState<SearchResult[]>([]);

  useEffect(() => {
    const loadServers = async () => {
      try {
        const myGuilds = await guildsApi.getMine();
        const results: SearchResult[] = myGuilds.map((g: Guild) => ({
          id: `guild-${g.id}`,
          type: 'server' as const,
          title: g.name,
          subtitle: `${g.memberCount} members`,
          icon: 'planet-outline',
          guildId: g.id,
        }));
        setAllServers(results);
        setServerResults(results);
      } catch {}
    };
    loadServers();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return [...ACTIONS.slice(0, 5), ...allServers.slice(0, 5)];
    }
    const q = query.toLowerCase();
    const matchedActions = ACTIONS.filter(a => a.title.toLowerCase().includes(q));
    const matchedServers = allServers.filter(s => s.title.toLowerCase().includes(q));
    return [...matchedActions, ...matchedServers];
  }, [query, allServers]);

  const handleSelect = (item: SearchResult) => {
    selectionFeedback();
    if (item.type === 'action') {
      if (item.id === 'action-friends') {
        (navigation as any).navigate('MainTabs', { screen: 'Friends' });
        return;
      }
      const route = ACTION_ROUTES[item.id];
      if (route) {
        // Navigate to parameterless routes
        (navigation as any).navigate(route);
      }
    } else if (item.type === 'server' && item.guildId) {
      navigation.navigate('GuildDrawer', { guildId: item.guildId, guildName: item.title });
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', margin: spacing.lg, padding: spacing.md, gap: spacing.sm,
      ...(glass ? {
        backgroundColor: glass.glassBackground, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: glass.glassBorder,
      } : neo ? {
        backgroundColor: colors.bgElevated, borderRadius: 0, borderWidth: 2, borderColor: colors.border,
      } : {
        backgroundColor: colors.bgElevated, borderRadius: borderRadius.lg,
      }),
    },
    searchInput: { flex: 1, color: colors.textPrimary, fontSize: fontSize.lg },
    resultRow: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.md,
      marginHorizontal: spacing.md, marginBottom: spacing.xs,
      ...(glass ? {
        backgroundColor: glass.glassBackground, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: glass.glassBorder,
      } : neo ? {
        borderWidth: 2, borderColor: colors.border, borderRadius: 0,
      } : {
        borderRadius: borderRadius.md,
      }),
    },
    iconCircle: {
      width: 40, height: 40, borderRadius: neo ? 0 : glass ? borderRadius.lg : 20,
      backgroundColor: glass ? glass.glassBackground : colors.bgElevated,
      justifyContent: 'center', alignItems: 'center',
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
      ...(glass ? { borderWidth: 1, borderColor: glass.glassBorder } : {}),
    },
    resultInfo: { flex: 1 },
    resultTitle: { fontSize: fontSize.md, fontWeight: neo ? '700' : '600', color: colors.textPrimary },
    resultSubtitle: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
    resultType: {
      fontSize: 9, fontWeight: '700', color: colors.accentPrimary, textTransform: 'uppercase',
      backgroundColor: colors.accentPrimary + '15', paddingHorizontal: spacing.sm, paddingVertical: 2,
      borderRadius: neo ? 0 : borderRadius.sm,
    },
    hint: { padding: spacing.xl, alignItems: 'center' },
    hintText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
  }), [colors, spacing, fontSize, borderRadius, neo, glass]);

  return (
    <PatternBackground>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={22} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Jump to..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.resultRow} onPress={() => handleSelect(item)}>
            <View style={styles.iconCircle}>
              <Ionicons name={item.icon as any} size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.resultInfo}>
              <Text style={styles.resultTitle}>{item.title}</Text>
              {item.subtitle && <Text style={styles.resultSubtitle}>{item.subtitle}</Text>}
            </View>
            <Text style={styles.resultType}>{item.type}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.hint}>
            <Text style={styles.hintText}>No results found</Text>
          </View>
        }
      />

      {!query && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>Type to search portals, channels, and actions</Text>
        </View>
      )}
    </PatternBackground>
  );
}
