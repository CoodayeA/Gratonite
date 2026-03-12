import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auctions as auctionsApi } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import { mediumImpact } from '../../lib/haptics';
import LoadingScreen from '../../components/LoadingScreen';
import type { Auction, AuctionBid } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'AuctionDetail'>;

const RARITY_COLORS: Record<string, string> = {
  legendary: '#f59e0b',
  epic: '#8b5cf6',
  rare: '#3b82f6',
  uncommon: '#22c55e',
  common: '#9ca3af',
};

export default function AuctionDetailScreen({ route }: Props) {
  const { auctionId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [auction, setAuction] = useState<(Auction & { bids: AuctionBid[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [bidding, setBidding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('');

  const fetchAuction = useCallback(async () => {
    try {
      const data = await auctionsApi.get(auctionId);
      setAuction(data);
      setBidAmount(String(data.currentBid + 10));
    } catch {
      toast.error('Failed to load auction');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [auctionId]);

  useEffect(() => { fetchAuction(); }, [fetchAuction]);

  useEffect(() => {
    if (!auction) return;
    const tick = () => {
      const diff = new Date(auction.endsAt).getTime() - Date.now();
      if (diff <= 0) { setTimeRemaining('Ended'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${h}h ${m}m ${s}s`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [auction?.endsAt]);

  const handleBid = async () => {
    const amount = parseInt(bidAmount);
    if (!amount || amount <= (auction?.currentBid ?? 0)) {
      toast.error('Bid must be higher than current bid');
      return;
    }
    setBidding(true);
    mediumImpact();
    try {
      await auctionsApi.bid(auctionId, amount);
      toast.success('Bid placed!');
      fetchAuction();
    } catch {
      toast.error('Failed to place bid');
    } finally {
      setBidding(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    header: { padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
    itemName: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary },
    rarity: { fontSize: fontSize.sm, fontWeight: '700', textTransform: 'uppercase' },
    timerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bgElevated, padding: spacing.md, borderRadius: neo ? 0 : borderRadius.md, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    timerLabel: { fontSize: fontSize.xs, color: colors.textMuted },
    timerText: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
    bidSection: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
    currentBidLabel: { fontSize: fontSize.xs, color: colors.textMuted, textTransform: 'uppercase' },
    currentBidAmount: { fontSize: fontSize.xxxl, fontWeight: '700', color: colors.accentPrimary },
    bidInputRow: { flexDirection: 'row', gap: spacing.sm },
    bidInput: { flex: 1, backgroundColor: colors.bgElevated, borderRadius: neo ? 0 : borderRadius.md, padding: spacing.md, color: colors.textPrimary, fontSize: fontSize.md, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    bidBtn: { backgroundColor: colors.accentPrimary, borderRadius: neo ? 0 : borderRadius.md, paddingHorizontal: spacing.xl, justifyContent: 'center', ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    bidBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSize.md },
    historyHeader: { padding: spacing.lg, paddingBottom: spacing.sm },
    historyTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
    bidRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    bidderName: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
    bidTime: { fontSize: fontSize.xs, color: colors.textMuted },
    bidValue: { fontSize: fontSize.sm, fontWeight: '700', color: colors.accentPrimary },
    sellerInfo: { fontSize: fontSize.sm, color: colors.textSecondary },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading || !auction) return <LoadingScreen />;

  const isEnded = auction.status !== 'active' || new Date(auction.endsAt).getTime() <= Date.now();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.itemName}>{auction.cosmetic?.name ?? 'Unknown Item'}</Text>
        <Text style={[styles.rarity, { color: RARITY_COLORS[auction.cosmetic?.rarity ?? ''] ?? colors.textSecondary }]}>{auction.cosmetic?.rarity}</Text>
        {auction.sellerName && <Text style={styles.sellerInfo}>Listed by {auction.sellerName}</Text>}
        <View style={styles.timerRow}>
          <Ionicons name="time-outline" size={18} color={colors.textMuted} />
          <View>
            <Text style={styles.timerLabel}>Time Remaining</Text>
            <Text style={styles.timerText}>{timeRemaining}</Text>
          </View>
        </View>
      </View>

      <View style={styles.bidSection}>
        <Text style={styles.currentBidLabel}>Current Bid</Text>
        <Text style={styles.currentBidAmount}>{auction.currentBid.toLocaleString()} coins</Text>
        {!isEnded && (
          <View style={styles.bidInputRow}>
            <TextInput
              style={styles.bidInput}
              placeholder="Your bid..."
              placeholderTextColor={colors.textMuted}
              value={bidAmount}
              onChangeText={setBidAmount}
              keyboardType="number-pad"
            />
            <TouchableOpacity style={styles.bidBtn} onPress={handleBid} disabled={bidding}>
              <Text style={styles.bidBtnText}>{bidding ? '...' : 'Bid'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Bid History ({auction.bids.length})</Text>
      </View>

      <FlatList
        data={auction.bids}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.bidRow}>
            <View>
              <Text style={styles.bidderName}>{item.bidderName || 'Anonymous'}</Text>
              <Text style={styles.bidTime}>{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
            <Text style={styles.bidValue}>{item.amount.toLocaleString()}</Text>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAuction(); }} tintColor={colors.accentPrimary} />}
      />
    </View>
  );
}