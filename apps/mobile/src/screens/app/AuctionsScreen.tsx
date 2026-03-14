import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auctions as auctionsApi } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import LoadingScreen from '../../components/LoadingScreen';
import LoadErrorCard from '../../components/LoadErrorCard';
import EmptyState from '../../components/EmptyState';
import type { Auction } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'Auctions'>;

const RARITY_COLORS: Record<string, string> = {
  legendary: '#f59e0b',
  epic: '#8b5cf6',
  rare: '#3b82f6',
  uncommon: '#22c55e',
  common: '#9ca3af',
};

const SORT_OPTIONS = [
  { label: 'Ending Soon', value: 'ending' },
  { label: 'Highest Bid', value: 'price' },
  { label: 'Newest', value: 'newest' },
];

export default function AuctionsScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [items, setItems] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sort, setSort] = useState('ending');

  const fetchAuctions = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await auctionsApi.list({ status: 'active', sort });
      setItems(data);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load auctions';
        if (refreshing || items.length > 0) { toast.error(message); } else { setLoadError(message); }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sort]);

  useEffect(() => { setLoading(true); fetchAuctions(); }, [fetchAuctions]);

  const getTimeRemaining = (endsAt: string) => {
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return 'Ended';
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    sortRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm, borderBottomWidth: neo ? 2 : 1, borderBottomColor: colors.border },
    sortBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: neo ? 0 : borderRadius.full, backgroundColor: colors.bgElevated, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    sortBtnActive: { backgroundColor: colors.accentPrimary },
    sortText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary },
    sortTextActive: { color: colors.white },
    card: { marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: neo ? 0 : borderRadius.lg, backgroundColor: colors.bgElevated, overflow: 'hidden', ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    cardBody: { padding: spacing.lg },
    itemName: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
    rarityBadge: { fontSize: fontSize.xs, fontWeight: '600', marginTop: spacing.xs },
    bidRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
    bidLabel: { fontSize: fontSize.xs, color: colors.textMuted },
    bidAmount: { fontSize: fontSize.lg, fontWeight: '700', color: colors.accentPrimary },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
    timeText: { fontSize: fontSize.xs, color: colors.textMuted },
    sellerText: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.xs },
    bidsCount: { fontSize: fontSize.xs, color: colors.textSecondary },
    fab: { position: 'absolute', bottom: spacing.xxxl, right: spacing.xl, width: 56, height: 56, borderRadius: neo ? 0 : 28, backgroundColor: colors.accentPrimary, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;
  if (loadError && items.length === 0) return <LoadErrorCard title="Failed to load auctions" message={loadError} onRetry={() => { setLoading(true); fetchAuctions(); }} />;

  return (
    <PatternBackground>
      <View style={styles.sortRow}>
        {SORT_OPTIONS.map(opt => (
          <TouchableOpacity key={opt.value} style={[styles.sortBtn, sort === opt.value && styles.sortBtnActive]} onPress={() => setSort(opt.value)}>
            <Text style={[styles.sortText, sort === opt.value && styles.sortTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('AuctionDetail', { auctionId: item.id })}>
            <View style={styles.cardBody}>
              <Text style={styles.itemName}>{item.cosmetic?.name ?? 'Unknown Item'}</Text>
              <Text style={[styles.rarityBadge, { color: RARITY_COLORS[item.cosmetic?.rarity ?? ''] ?? colors.textSecondary }]}>{item.cosmetic?.rarity?.toUpperCase()}</Text>
              <View style={styles.bidRow}>
                <View>
                  <Text style={styles.bidLabel}>Current Bid</Text>
                  <Text style={styles.bidAmount}>{item.currentBid.toLocaleString()} coins</Text>
                </View>
                <Text style={styles.bidsCount}>{item.bidCount} bids</Text>
              </View>
              <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={styles.timeText}>{getTimeRemaining(item.endsAt)}</Text>
              </View>
              {item.sellerName && <Text style={styles.sellerText}>by {item.sellerName}</Text>}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<EmptyState icon="hammer-outline" title="No auctions" subtitle="Create one to get started" />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAuctions(); }} tintColor={colors.accentPrimary} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateAuction')} accessibilityLabel="Create auction">
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </PatternBackground>
  );
}