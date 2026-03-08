import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { stats } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'UserStats'>;

interface StatData {
  totalUsers: number;
  totalGuilds: number;
  totalMessages: number;
  onlineNow: number;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

const STAT_CARDS: {
  key: keyof StatData;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'totalUsers', label: 'Total Users', icon: 'people-outline' },
  { key: 'totalGuilds', label: 'Total Servers', icon: 'planet-outline' },
  { key: 'totalMessages', label: 'Total Messages', icon: 'chatbubble-outline' },
  { key: 'onlineNow', label: 'Online Now', icon: 'ellipse' },
];

export default function UserStatsScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();

  const [data, setData] = useState<StatData | null>(null);
  const [loading, setLoading] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const fetchStats = useCallback(async () => {
    try {
      const res = await stats.public();
      setData(res);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: spacing.md,
    },
    card: {
      width: '50%',
      padding: spacing.xs,
    },
    cardInner: {
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.lg || borderRadius.md,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.sm,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border, shadowColor: neo.shadowColor, shadowOffset: neo.shadowOffset, shadowOpacity: neo.shadowOpacity, shadowRadius: neo.shadowRadius } : {}),
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.accentPrimary + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    number: {
      fontSize: fontSize.xxl || 24,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    label: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.grid}>
        {STAT_CARDS.map((card) => {
          const isOnline = card.key === 'onlineNow';
          return (
            <View key={card.key} style={styles.card}>
              <View style={styles.cardInner}>
                <View style={styles.iconCircle}>
                  {isOnline ? (
                    <Animated.View style={{ opacity: pulseAnim }}>
                      <Ionicons name={card.icon} size={22} color={colors.success} />
                    </Animated.View>
                  ) : (
                    <Ionicons name={card.icon} size={22} color={colors.accentPrimary} />
                  )}
                </View>
                <Text style={styles.number}>
                  {data ? formatNumber(data[card.key]) : '--'}
                </Text>
                <Text style={styles.label}>{card.label}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
