import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shopApi } from '../../lib/api';
import { colors, fontSize, spacing, radius } from '../../theme';

// ── Types ─────────────────────────────────────────────────────────────────

interface ShopItem {
  id: string;
  name: string;
  description?: string;
  type: string;
  price: number;
  previewUrl?: string;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

// ── Constants ─────────────────────────────────────────────────────────────

const COLUMN_COUNT = 2;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = spacing.md;

const RARITY_COLORS: Record<string, string> = {
  common: colors.text.muted,
  uncommon: colors.accent.success,
  rare: colors.accent.info,
  epic: '#a855f7',
  legendary: colors.accent.warning,
};

// ── Helpers ───────────────────────────────────────────────────────────────

function getTypeIcon(type: string): string {
  switch (type) {
    case 'avatar_decoration':
      return '\uD83C\uDF1F';
    case 'nameplate':
      return '\uD83C\uDFF7';
    case 'badge':
      return '\uD83C\uDFC5';
    case 'effect':
      return '\u2728';
    case 'banner':
      return '\uD83C\uDFA8';
    default:
      return '\uD83D\uDED2';
  }
}

function formatPrice(price: number): string {
  if (price >= 1000) return `${(price / 1000).toFixed(1)}k`;
  return String(price);
}

// ── Main Screen ───────────────────────────────────────────────────────────

export function ShopScreen() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: items = [],
    isLoading,
    refetch,
  } = useQuery<ShopItem[]>({
    queryKey: ['shop-items'],
    queryFn: () => shopApi.getItems(),
  });

  const purchaseMutation = useMutation({
    mutationFn: (itemId: string) => shopApi.purchase(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-items'] });
      queryClient.invalidateQueries({ queryKey: ['economy-wallet'] });
      Alert.alert('Purchased!', 'The item has been added to your inventory.');
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message || 'Could not complete purchase.');
    },
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handlePurchase = useCallback(
    (item: ShopItem) => {
      Alert.alert(
        'Confirm Purchase',
        `Buy "${item.name}" for ${item.price} coins?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Buy',
            onPress: () => purchaseMutation.mutate(item.id),
          },
        ],
      );
    },
    [purchaseMutation],
  );

  const renderItem = useCallback(
    ({ item }: { item: ShopItem }) => {
      const rarityColor = RARITY_COLORS[item.rarity ?? 'common'] ?? colors.text.muted;

      return (
        <View style={styles.itemCard}>
          {/* Preview area */}
          <View style={[styles.itemPreview, { borderBottomColor: rarityColor }]}>
            <Text style={styles.itemPreviewIcon}>{getTypeIcon(item.type)}</Text>
            {item.rarity && (
              <View
                style={[
                  styles.rarityBadge,
                  { backgroundColor: rarityColor + '20' },
                ]}
              >
                <Text style={[styles.rarityText, { color: rarityColor }]}>
                  {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
                </Text>
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.description && (
              <Text style={styles.itemDesc} numberOfLines={2}>
                {item.description}
              </Text>
            )}
          </View>

          {/* Price + Buy */}
          <View style={styles.itemFooter}>
            <View style={styles.priceTag}>
              <Text style={styles.coinIcon}>{'\uD83E\uDE99'}</Text>
              <Text style={styles.priceText}>{formatPrice(item.price)}</Text>
            </View>
            <TouchableOpacity
              style={styles.buyButton}
              onPress={() => handlePurchase(item)}
              disabled={purchaseMutation.isPending}
              activeOpacity={0.7}
            >
              <Text style={styles.buyButtonText}>Buy</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [handlePurchase, purchaseMutation.isPending],
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.listContainer}>
        {items.length === 0 && !isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'\uD83D\uDED2'}</Text>
            <Text style={styles.emptyTitle}>Shop is empty</Text>
            <Text style={styles.emptySubtitle}>
              Check back later for new items
            </Text>
          </View>
        ) : (
          <FlashList
            data={items}
            renderItem={renderItem}
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
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing['5xl'],
  },
  loadingContainer: {
    paddingVertical: spacing['5xl'],
    alignItems: 'center',
  },

  // Item card
  itemCard: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.xl,
    marginHorizontal: CARD_GAP / 2,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    overflow: 'hidden',
  },
  itemPreview: {
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surface,
    borderBottomWidth: 2,
    position: 'relative',
  },
  itemPreviewIcon: {
    fontSize: 36,
  },
  rarityBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  rarityText: {
    fontSize: fontSize.xs - 1,
    fontWeight: '700',
  },
  itemInfo: {
    padding: spacing.md,
  },
  itemName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  itemDesc: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    lineHeight: 16,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coinIcon: {
    fontSize: 14,
  },
  priceText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.accent.warning,
  },
  buyButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.brand.primary,
  },
  buyButtonText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#ffffff',
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['4xl'],
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
  },
});
