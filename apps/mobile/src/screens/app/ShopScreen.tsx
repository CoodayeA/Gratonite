import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shop as shopApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import LoadErrorCard from '../../components/LoadErrorCard';
import EmptyState from '../../components/EmptyState';
import type { ShopItem } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'Shop'>;

const ITEM_TYPES = ['all', 'avatar_frame', 'nameplate', 'badge', 'background', 'effect'] as const;
type ItemType = (typeof ITEM_TYPES)[number];

const TYPE_LABELS: Record<ItemType, string> = {
  all: 'All',
  avatar_frame: 'Frames',
  nameplate: 'Nameplates',
  badge: 'Badges',
  background: 'Backgrounds',
  effect: 'Effects',
};

const RARITY_COLORS: Record<string, string> = {
  common: '#9898b8',
  uncommon: '#43b581',
  rare: '#5865f2',
  epic: '#9b59b6',
  legendary: '#faa61a',
};

function getRarityIcon(rarity: string): keyof typeof Ionicons.glyphMap {
  switch (rarity) {
    case 'legendary':
      return 'star';
    case 'epic':
      return 'diamond';
    case 'rare':
      return 'sparkles';
    default:
      return 'ellipse';
  }
}

export default function ShopScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<ItemType>('all');
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await shopApi.list();
      setItems(data);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load shop';
        if (items.length > 0) { toast.error(message); } else { setLoadError(message); }
      }
    } finally {
      setLoading(false);
    }
  }, [items.length]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filteredItems = activeType === 'all'
    ? items.filter((i) => i.available)
    : items.filter((i) => i.available && i.type === activeType);

  const handlePurchase = (item: ShopItem) => {
    Alert.alert(
      item.name,
      `${item.description}\n\nPrice: ${item.price} coins\nRarity: ${item.rarity}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: async () => {
            setPurchasing(item.id);
            try {
              await shopApi.purchase(item.id);
              toast.success(`You now own ${item.name}!`);
            } catch (err: any) {
              toast.error(err.message || 'Failed to purchase item');
            } finally {
              setPurchasing(null);
            }
          },
        },
      ],
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    tabsContainer: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabsContent: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
    },
    tab: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.bgElevated,
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
    },
    tabActive: {
      backgroundColor: colors.accentPrimary,
    },
    tabText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: neo ? '700' : '600',
      ...(neo ? { textTransform: 'uppercase' as const } : {}),
    },
    tabTextActive: {
      color: colors.white,
    },
    gridContent: {
      padding: spacing.md,
      paddingBottom: spacing.xxxl,
    },
    gridRow: {
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    itemCard: {
      flex: 1,
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border, shadowColor: neo.shadowColor, shadowOffset: neo.shadowOffset, shadowOpacity: neo.shadowOpacity, shadowRadius: neo.shadowRadius } : {}),
    },
    itemImageContainer: {
      height: 120,
      backgroundColor: colors.bgTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    itemImagePlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    rarityBadge: {
      position: 'absolute',
      top: spacing.xs,
      right: spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
    },
    rarityText: {
      color: colors.white,
      fontSize: fontSize.xs,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    itemInfo: {
      padding: spacing.md,
    },
    itemName: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    coinEmoji: {
      fontSize: fontSize.sm,
    },
    priceText: {
      color: colors.warning,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderItem = ({ item }: { item: ShopItem }) => {
    const rarityColor = RARITY_COLORS[item.rarity] || colors.textMuted;

    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() => handlePurchase(item)}
        activeOpacity={0.7}
        disabled={purchasing === item.id}
      >
        <View style={styles.itemImageContainer}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
          ) : (
            <View style={styles.itemImagePlaceholder}>
              <Ionicons name="cube-outline" size={32} color={colors.textMuted} />
            </View>
          )}
          <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
            <Ionicons name={getRarityIcon(item.rarity)} size={10} color={colors.white} />
            <Text style={styles.rarityText}>{item.rarity}</Text>
          </View>
        </View>

        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.coinEmoji}>{'\u{1FA99}'}</Text>
            <Text style={styles.priceText}>{item.price.toLocaleString()}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) return <LoadingScreen />;

  if (loadError && items.length === 0) return <LoadErrorCard title="Failed to load shop" message={loadError} onRetry={() => { setLoading(true); fetchItems(); }} />;

  return (
    <PatternBackground>
      {/* Type filter tabs */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={ITEM_TYPES}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.tabsContent}
          renderItem={({ item: type }) => (
            <TouchableOpacity
              style={[styles.tab, activeType === type && styles.tabActive]}
              onPress={() => setActiveType(type)}
            >
              <Text
                style={[styles.tabText, activeType === type && styles.tabTextActive]}
              >
                {TYPE_LABELS[type]}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Item grid */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        ListEmptyComponent={
          <EmptyState
            icon="storefront-outline"
            title="No items available"
            subtitle="Check back later for new items!"
          />
        }
      />
    </PatternBackground>
  );
}
