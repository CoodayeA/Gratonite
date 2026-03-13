import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { moderation as moderationApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { BanAppeal } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'BanAppeals'>;

export default function BanAppealsScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();

  const STATUS_CONFIG: Record<BanAppeal['status'], { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
    pending: { color: colors.warning, icon: 'time-outline', label: 'Pending' },
    accepted: { color: colors.success, icon: 'checkmark-circle-outline', label: 'Accepted' },
    rejected: { color: colors.error, icon: 'close-circle-outline', label: 'Rejected' },
  };

  const { guildId } = route.params;
  const [appeals, setAppeals] = useState<BanAppeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchAppeals = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await moderationApi.getBanAppeals(guildId);
      setAppeals(data);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err.message || 'Failed to load ban appeals';
        setLoadError(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, [guildId, toast]);

  useEffect(() => {
    fetchAppeals();
  }, [fetchAppeals]);

  const handleReview = (appeal: BanAppeal, status: 'accepted' | 'rejected') => {
    const action = status === 'accepted' ? 'accept' : 'reject';
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Appeal`,
      `Are you sure you want to ${action} this ban appeal from ${appeal.username || 'this user'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          style: status === 'rejected' ? 'destructive' : 'default',
          onPress: async () => {
            setProcessing(appeal.id);
            try {
              const updated = await moderationApi.reviewBanAppeal(guildId, appeal.id, status);
              setAppeals((prev) =>
                prev.map((a) => (a.id === appeal.id ? updated : a)),
              );
            } catch (err: any) {
              toast.error(err.message || 'Failed to review appeal');
            } finally {
              setProcessing(null);
            }
          },
        },
      ],
    );
  };

  const renderAppeal = ({ item }: { item: BanAppeal }) => {
    const statusConfig = STATUS_CONFIG[item.status];
    const isPending = item.status === 'pending';
    const isProcessing = processing === item.id;

    return (
      <View style={styles.appealCard}>
        <View style={styles.appealHeader}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>
              {(item.username || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.appealInfo}>
            <Text style={styles.username}>{item.username || 'Unknown User'}</Text>
            <Text style={styles.dateText}>{formatRelativeTime(item.createdAt)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusConfig.color}22` }]}>
            <Ionicons name={statusConfig.icon} size={14} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View style={styles.reasonSection}>
          <Text style={styles.reasonLabel}>Appeal Reason</Text>
          <Text style={styles.reasonText}>{item.reason}</Text>
        </View>

        {isPending && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleReview(item, 'rejected')}
              disabled={isProcessing}
            >
              <Ionicons name="close" size={18} color={colors.error} />
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={() => handleReview(item, 'accepted')}
              disabled={isProcessing}
            >
              <Ionicons name="checkmark" size={18} color={colors.white} />
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    listContent: {
      padding: spacing.md,
      paddingBottom: spacing.xxxl,
      gap: spacing.md,
    },
    appealCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    appealHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    userAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.bgActive,
      justifyContent: 'center',
      alignItems: 'center',
    },
    userAvatarText: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    appealInfo: {
      flex: 1,
    },
    username: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    dateText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 1,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
    },
    statusText: {
      fontSize: fontSize.xs,
      fontWeight: '700',
    },
    reasonSection: {
      marginTop: spacing.lg,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    reasonLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    reasonText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 20,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
    },
    rejectButton: {
      backgroundColor: 'rgba(240, 71, 71, 0.12)',
      borderWidth: 1,
      borderColor: 'rgba(240, 71, 71, 0.3)',
    },
    rejectButtonText: {
      color: colors.error,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    acceptButton: {
      backgroundColor: colors.success,
    },
    acceptButtonText: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  if (loadError && appeals.length === 0) {
    return (
      <PatternBackground>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl, gap: spacing.md }]}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.accentPrimary} />
          <Text style={[styles.username, { fontSize: fontSize.xl, textAlign: 'center' }]}>Failed to load ban appeals</Text>
          <Text style={[styles.reasonText, { textAlign: 'center' }]}>{loadError}</Text>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton, { flex: 0, minWidth: 140 }]}
            onPress={() => {
              setLoading(true);
              fetchAppeals();
            }}
          >
            <Text style={styles.acceptButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </PatternBackground>
    );
  }

  return (
    <PatternBackground>
      <FlatList
        data={appeals}
        keyExtractor={(item) => item.id}
        renderItem={renderAppeal}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="hand-left-outline"
            title="No ban appeals"
            subtitle="Ban appeals from members will appear here"
          />
        }
      />
    </PatternBackground>
  );
}
