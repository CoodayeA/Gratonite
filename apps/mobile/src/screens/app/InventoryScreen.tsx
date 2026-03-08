import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shop as shopApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { InventoryItem } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Inventory'>;

export default function InventoryScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchInventory = useCallback(async () => {
    try {
      const data = await shopApi.getInventory();
      setInventory(data);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load inventory');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleToggleEquip = async (item: InventoryItem) => {
    setToggling(item.id);
    try {
      if (item.equipped) {
        await shopApi.unequip(item.id);
      } else {
        await shopApi.equip(item.id);
      }
      setInventory((prev) =>
        prev.map((inv) =>
          inv.id === item.id ? { ...inv, equipped: !inv.equipped } : inv,
        ),
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to update item');
    } finally {
      setToggling(null);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    listContent: {
      paddingBottom: spacing.xxxl,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    itemImageContainer: {
      width: 48,
      height: 48,
      borderRadius: borderRadius.md,
      backgroundColor: colors.bgTertiary,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemImage: {
      width: 48,
      height: 48,
      resizeMode: 'cover',
    },
    itemImagePlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemInfo: {
      flex: 1,
    },
    itemName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    itemType: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      textTransform: 'capitalize',
      marginTop: 2,
    },
    acquiredText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
    equippedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(67, 181, 129, 0.15)',
    },
    equippedText: {
      color: colors.success,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    equipButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    equipButtonText: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderItem = ({ item }: { item: InventoryItem }) => (
    <TouchableOpacity
      style={styles.itemRow}
      onPress={() => handleToggleEquip(item)}
      activeOpacity={0.7}
      disabled={toggling === item.id}
    >
      <View style={styles.itemImageContainer}>
        {item.item.imageUrl ? (
          <Image source={{ uri: item.item.imageUrl }} style={styles.itemImage} />
        ) : (
          <View style={styles.itemImagePlaceholder}>
            <Ionicons name="cube-outline" size={24} color={colors.textMuted} />
          </View>
        )}
      </View>

      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.item.name}</Text>
        <Text style={styles.itemType}>{item.item.type.replace('_', ' ')}</Text>
        <Text style={styles.acquiredText}>
          Acquired {formatRelativeTime(item.acquiredAt)}
        </Text>
      </View>

      {item.equipped ? (
        <View style={styles.equippedBadge}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.equippedText}>Equipped</Text>
        </View>
      ) : (
        <View style={styles.equipButton}>
          <Text style={styles.equipButtonText}>Equip</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <FlatList
        data={inventory}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title="No items yet"
            subtitle="Visit the shop to purchase cosmetic items!"
            actionLabel="Go to Shop"
            onAction={() => navigation.navigate('Shop')}
          />
        }
      />
    </View>
  );
}
