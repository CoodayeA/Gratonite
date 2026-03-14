import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { userSettings as settingsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import LoadErrorCard from '../../components/LoadErrorCard';
import EmptyState from '../../components/EmptyState';
import type { Session } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'SettingsSessions'>;

export default function SettingsSessionsScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const hasDataRef = useRef(false);

  const fetchSessions = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await settingsApi.getSessions();
      setSessions(data);
      hasDataRef.current = true;
    } catch (err: any) {
      const message = err?.message || 'Failed to load sessions';
      if (hasDataRef.current) {
        toast.error(message);
      } else {
        setLoadError(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleLogoutSession = (sessionId: string) => {
    Alert.alert('Log Out Session', 'Are you sure you want to log out this session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await settingsApi.logoutSession(sessionId);
            setSessions((prev) => prev.filter((s) => s.id !== sessionId));
          } catch (err: any) {
            toast.error(err.message || 'Failed to log out session');
          }
        },
      },
    ]);
  };

  const handleLogoutAll = () => {
    Alert.alert(
      'Log Out All Other Sessions',
      'This will log you out from all other devices. You will stay logged in on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out All',
          style: 'destructive',
          onPress: async () => {
            try {
              await settingsApi.logoutAllSessions();
              setSessions((prev) => prev.filter((s) => s.current));
              toast.success('All other sessions have been logged out');
            } catch (err: any) {
              toast.error(err.message || 'Failed to log out sessions');
            }
          },
        },
      ],
    );
  };

  const getDeviceIcon = (device: string): keyof typeof Ionicons.glyphMap => {
    const lower = device.toLowerCase();
    if (lower.includes('mobile') || lower.includes('phone') || lower.includes('android') || lower.includes('ios')) {
      return 'phone-portrait-outline';
    }
    if (lower.includes('tablet') || lower.includes('ipad')) {
      return 'tablet-portrait-outline';
    }
    return 'desktop-outline';
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    list: {
      paddingTop: spacing.sm,
    },
    sessionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      gap: spacing.md,
    },
    sessionItemCurrent: {
      backgroundColor: colors.accentLight,
    },
    sessionInfo: {
      flex: 1,
    },
    sessionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    sessionDevice: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    currentBadge: {
      backgroundColor: colors.accentPrimary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
    },
    currentBadgeText: {
      color: colors.white,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    sessionMeta: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: 2,
    },
    logoutBtn: {
      padding: spacing.sm,
    },
    footer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    logoutAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.bgElevated,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.md,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    logoutAllText: {
      color: colors.error,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderSession = ({ item }: { item: Session }) => (
    <View style={[styles.sessionItem, item.current && styles.sessionItemCurrent]}>
      <Ionicons
        name={getDeviceIcon(item.device)}
        size={24}
        color={item.current ? colors.accentPrimary : colors.textSecondary}
      />
      <View style={styles.sessionInfo}>
        <View style={styles.sessionHeader}>
          <Text style={styles.sessionDevice}>{item.device}</Text>
          {item.current && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>Current</Text>
            </View>
          )}
        </View>
        <Text style={styles.sessionMeta}>
          {item.ip} · {formatRelativeTime(item.lastActive)}
        </Text>
      </View>
      {!item.current && (
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => handleLogoutSession(item.id)}
          accessibilityLabel="Terminate session"
        >
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return <LoadingScreen />;
  }

  if (loadError && sessions.length === 0) {
    return <LoadErrorCard title="Failed to load sessions" message={loadError} onRetry={fetchSessions} />;
  }

  const otherSessionCount = sessions.filter((s) => !s.current).length;

  return (
    <PatternBackground>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchSessions(); }}
            tintColor={colors.accentPrimary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="phone-portrait-outline"
            title="No Sessions"
            subtitle="No active sessions found"
          />
        }
        ListFooterComponent={
          otherSessionCount > 0 ? (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.logoutAllButton} onPress={handleLogoutAll}>
                <Ionicons name="log-out-outline" size={20} color={colors.error} />
                <Text style={styles.logoutAllText}>Log Out All Other Sessions</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </PatternBackground>
  );
}
