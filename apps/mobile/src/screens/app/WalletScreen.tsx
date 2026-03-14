import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { economy as economyApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme, useGlass } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import LoadErrorCard from '../../components/LoadErrorCard';
import type { WalletInfo, LedgerEntry } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'Wallet'>;

export default function WalletScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const glass = useGlass();
  const toast = useToast();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const hasDataRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      setLoadError(null);
      const [walletData, ledgerData] = await Promise.all([
        economyApi.getWallet(),
        economyApi.getLedger(50),
      ]);
      setWallet(walletData);
      setLedger(ledgerData);
      hasDataRef.current = true;
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load wallet data';
        if (hasDataRef.current) {
          toast.error(message);
        } else {
          setLoadError(message);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleClaimDaily = async () => {
    setClaiming(true);
    try {
      const result = await economyApi.claimDaily();
      toast.success(`You earned ${result.amount} coins! New balance: ${result.balance.toLocaleString()} coins`);
      setWallet((prev) =>
        prev ? { ...prev, balance: result.balance, lastClaimAt: new Date().toISOString() } : prev,
      );
      const ledgerData = await economyApi.getLedger(50);
      setLedger(ledgerData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to claim daily reward');
    } finally {
      setClaiming(false);
    }
  };

  const canClaimDaily = (): boolean => {
    if (!wallet?.lastClaimAt) return true;
    const lastClaim = new Date(wallet.lastClaimAt).getTime();
    const now = Date.now();
    return now - lastClaim >= 24 * 60 * 60 * 1000;
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    listContent: {
      paddingBottom: spacing.xxxl,
    },
    balanceCard: {
      margin: spacing.lg,
      padding: spacing.xxl,
      alignItems: 'center',
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: glass.glassBorder,
        shadowColor: colors.accentPrimary,
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 16,
      } : neo ? {
        backgroundColor: neo.palette.butter,
        borderRadius: 0,
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
        shadowColor: neo.shadowColor,
        shadowOffset: neo.shadowOffset,
        shadowOpacity: neo.shadowOpacity,
        shadowRadius: neo.shadowRadius,
      } : {
        backgroundColor: colors.bgElevated,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.borderLight,
      }),
    },
    balanceLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    coinIcon: {
      fontSize: 36,
    },
    balanceAmount: {
      color: colors.textPrimary,
      fontSize: 42,
      fontWeight: '800',
    },
    lifetimeText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: spacing.md,
    },
    claimButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.xl,
      paddingVertical: spacing.lg,
      backgroundColor: colors.accentPrimary,
      ...(glass ? {
        borderRadius: borderRadius.xl,
        shadowColor: colors.accentPrimary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      } : neo ? {
        borderRadius: 0,
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
        shadowColor: neo.shadowColor,
        shadowOffset: neo.shadowOffset,
        shadowOpacity: neo.shadowOpacity,
        shadowRadius: neo.shadowRadius,
      } : {
        borderRadius: borderRadius.md,
      }),
    },
    claimButtonDisabled: {
      backgroundColor: colors.bgElevated,
    },
    claimButtonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    claimButtonTextDisabled: {
      color: colors.textMuted,
    },
    sectionTitle: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
      fontSize: fontSize.xs,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
    },
    ledgerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: glass.glassBorder,
        marginHorizontal: spacing.md,
        marginBottom: spacing.xs,
      } : neo ? {
        borderBottomWidth: 2,
        borderBottomColor: colors.border,
      } : {
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }),
    },
    amountIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    amountIconPositive: {
      backgroundColor: 'rgba(67, 181, 129, 0.15)',
    },
    amountIconNegative: {
      backgroundColor: 'rgba(240, 71, 71, 0.15)',
    },
    ledgerInfo: {
      flex: 1,
    },
    ledgerDescription: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '500',
    },
    ledgerDate: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
    ledgerAmount: {
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    positiveAmount: {
      color: colors.success,
    },
    negativeAmount: {
      color: colors.error,
    },
    emptyLedger: {
      alignItems: 'center',
      paddingTop: spacing.xxxl,
      gap: spacing.sm,
    },
    emptyLedgerText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
  }), [colors, spacing, fontSize, borderRadius, neo, glass]);

  const renderLedgerEntry = ({ item }: { item: LedgerEntry }) => {
    const isPositive = item.amount > 0;

    return (
      <View style={styles.ledgerRow}>
        <View style={[styles.amountIcon, isPositive ? styles.amountIconPositive : styles.amountIconNegative]}>
          <Ionicons
            name={isPositive ? 'arrow-down' : 'arrow-up'}
            size={14}
            color={isPositive ? colors.success : colors.error}
          />
        </View>
        <View style={styles.ledgerInfo}>
          <Text style={styles.ledgerDescription}>{item.description}</Text>
          <Text style={styles.ledgerDate}>{formatRelativeTime(item.createdAt)}</Text>
        </View>
        <Text style={[styles.ledgerAmount, isPositive ? styles.positiveAmount : styles.negativeAmount]}>
          {isPositive ? '+' : ''}{item.amount.toLocaleString()}
        </Text>
      </View>
    );
  };

  if (loading) return <LoadingScreen />;

  if (loadError && !wallet) {
    return <LoadErrorCard title="Failed to load wallet" message={loadError} onRetry={fetchData} />;
  }

  return (
    <PatternBackground>
      <FlatList
        data={ledger}
        keyExtractor={(item) => item.id}
        renderItem={renderLedgerEntry}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accentPrimary}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Balance card */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Your Balance</Text>
              <View style={styles.balanceRow}>
                <Text style={styles.coinIcon}>{'\u{1FA99}'}</Text>
                <Text style={styles.balanceAmount}>
                  {wallet?.balance.toLocaleString() ?? '0'}
                </Text>
              </View>
              <Text style={styles.lifetimeText}>
                Lifetime earned: {wallet?.lifetimeEarned.toLocaleString() ?? '0'} coins
              </Text>
            </View>

            {/* Claim daily button */}
            <TouchableOpacity
              style={[styles.claimButton, !canClaimDaily() && styles.claimButtonDisabled]}
              onPress={handleClaimDaily}
              disabled={claiming || !canClaimDaily()}
            >
              <Ionicons
                name="gift-outline"
                size={22}
                color={canClaimDaily() ? colors.white : colors.textMuted}
              />
              <Text style={[styles.claimButtonText, !canClaimDaily() && styles.claimButtonTextDisabled]}>
                {claiming
                  ? 'Claiming...'
                  : canClaimDaily()
                    ? 'Claim Daily Reward'
                    : 'Already Claimed Today'}
              </Text>
            </TouchableOpacity>

            {/* Transaction history header */}
            {ledger.length > 0 && (
              <Text style={styles.sectionTitle}>TRANSACTION HISTORY</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyLedger}>
            <Ionicons name="receipt-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyLedgerText}>No transactions yet</Text>
          </View>
        }
      />
    </PatternBackground>
  );
}
