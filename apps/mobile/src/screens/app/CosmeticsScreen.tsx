import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { cosmetics } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import type { Cosmetic } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Cosmetics'>;

const TABS = [
  { key: 'avatar_frame' as const, label: 'Frames' },
  { key: 'nameplate' as const, label: 'Nameplates' },
  { key: 'badge' as const, label: 'Badges' },
];

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#8b5cf6',
  legendary: '#f59e0b',
};

export default function CosmeticsScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();

  const [tab, setTab] = useState<Cosmetic['type']>('avatar_frame');
  const [catalog, setCatalog] = useState<Cosmetic[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [catalogData, ownedData] = await Promise.all([
        cosmetics.catalog(),
        cosmetics.owned(),
      ]);
      const ownedIds = new Set(ownedData.map((c) => c.id));
      const equippedIds = new Set(ownedData.filter((c) => c.equipped).map((c) => c.id));
      const merged = catalogData.map((c) => ({
        ...c,
        owned: ownedIds.has(c.id),
        equipped: equippedIds.has(c.id),
      }));
      setCatalog(merged);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load cosmetics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleEquip = async (item: Cosmetic) => {
    setBusyId(item.id);
    try {
      if (item.equipped) {
        await cosmetics.unequip(item.id);
      } else {
        await cosmetics.equip(item.id);
      }
      setCatalog((prev) =>
        prev.map((c) =>
          c.id === item.id ? { ...c, equipped: !c.equipped } : c
        )
      );
      toast.success(item.equipped ? 'Unequipped' : 'Equipped');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => catalog.filter((c) => c.type === tab), [catalog, tab]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    tabRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.accentPrimary,
    },
    tabText: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.textMuted,
    },
    tabTextActive: {
      color: colors.accentPrimary,
    },
    list: {
      padding: spacing.sm,
    },
    card: {
      flex: 1,
      margin: spacing.xs,
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      alignItems: 'center',
      gap: spacing.xs,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    preview: {
      width: 56,
      height: 56,
      borderRadius: borderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    previewLetter: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.white,
    },
    name: {
      fontSize: fontSize.xs,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    rarityBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
    },
    rarityText: {
      fontSize: 10,
      fontWeight: '700',
      color: colors.white,
      textTransform: 'uppercase',
    },
    equipButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.accentPrimary,
      marginTop: spacing.xs,
    },
    unequipButton: {
      backgroundColor: colors.bgElevated,
    },
    equipText: {
      fontSize: fontSize.xs,
      fontWeight: '600',
      color: colors.white,
    },
    unequipText: {
      color: colors.textSecondary,
    },
    notOwned: {
      opacity: 0.4,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      paddingVertical: spacing.xxxl,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderItem = ({ item }: { item: Cosmetic }) => {
    const rarityColor = RARITY_COLORS[item.rarity] || colors.textMuted;
    return (
      <View style={[styles.card, !item.owned && styles.notOwned]}>
        <View style={[styles.preview, { backgroundColor: rarityColor + '40' }]}>
          <Text style={styles.previewLetter}>{item.name.charAt(0)}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
          <Text style={styles.rarityText}>{item.rarity}</Text>
        </View>
        {item.owned && (
          <TouchableOpacity
            style={[styles.equipButton, item.equipped && styles.unequipButton]}
            onPress={() => handleToggleEquip(item)}
            disabled={busyId === item.id}
          >
            {busyId === item.id ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={[styles.equipText, item.equipped && styles.unequipText]}>
                {item.equipped ? 'Unequip' : 'Equip'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        contentContainerStyle={styles.list}
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={3}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No items in this category</Text>
        }
      />
    </View>
  );
}
