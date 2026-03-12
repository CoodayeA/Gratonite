import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { achievements } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import type { Achievement } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'Achievements'>;

export default function AchievementsScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();

  const [items, setItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAchievements = useCallback(async () => {
    try {
      const data = await achievements.list();
      setItems(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load achievements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    list: {
      padding: spacing.md,
    },
    card: {
      flex: 1,
      margin: spacing.xs,
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      alignItems: 'center',
      gap: spacing.sm,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    cardLocked: {
      opacity: 0.5,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconText: {
      fontSize: 24,
    },
    lockOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 24,
      backgroundColor: colors.bgPrimary + '80',
      justifyContent: 'center',
      alignItems: 'center',
    },
    name: {
      fontSize: fontSize.sm,
      fontWeight: '700',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    description: {
      fontSize: fontSize.xs,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 16,
    },
    earnedDate: {
      fontSize: fontSize.xs,
      color: colors.success,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: fontSize.md,
      textAlign: 'center',
      paddingVertical: spacing.xxxl,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderItem = ({ item }: { item: Achievement }) => (
    <View style={[styles.card, !item.earned && styles.cardLocked]}>
      <View style={styles.iconContainer}>
        <Text style={styles.iconText}>{item.icon}</Text>
        {!item.earned && (
          <View style={styles.lockOverlay}>
            <Ionicons name="lock-closed" size={18} color={colors.textMuted} />
          </View>
        )}
      </View>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
      {item.earned && item.earnedAt && (
        <Text style={styles.earnedDate}>
          {new Date(item.earnedAt).toLocaleDateString()}
        </Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  return (
    <PatternBackground>
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      numColumns={2}
      ListEmptyComponent={
        <Text style={styles.emptyText}>No achievements yet</Text>
      }
    />
    </PatternBackground>
  );
}
