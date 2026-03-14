import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { relationships as relApi, users as usersApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import Avatar from '../../components/Avatar';
import LoadErrorCard from '../../components/LoadErrorCard';
import EmptyState from '../../components/EmptyState';
import type { Relationship, User } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'MessageRequests'>;

interface RequestEntry {
  relationship: Relationship;
  user: User | null;
}

export default function MessageRequestsScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [requests, setRequests] = useState<RequestEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      setLoadError(null);
      const rels = await relApi.getAll();
      const pending = rels.filter((r) => r.type === 'pending_incoming');
      const targetIds = pending.map((r) => r.targetId).filter(Boolean);

      let userMap: Record<string, User> = {};
      if (targetIds.length > 0) {
        try {
          const users = await usersApi.getBatch(targetIds);
          users.forEach((u) => {
            userMap[u.id] = u as User;
          });
        } catch {
          // Continue without user details
        }
      }

      setRequests(
        pending.map((r) => ({
          relationship: r,
          user: userMap[r.targetId] || null,
        })),
      );
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load requests';
        if (refreshing || requests.length > 0) { toast.error(message); } else { setLoadError(message); }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing, requests.length]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAccept = async (targetId: string) => {
    try {
      await relApi.acceptFriend(targetId);
      setRequests((prev) =>
        prev.filter((r) => r.relationship.targetId !== targetId),
      );
      toast.success('Friend request accepted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept request');
    }
  };

  const handleDecline = async (targetId: string) => {
    Alert.alert(
      'Decline Request',
      'Are you sure you want to decline this friend request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              await relApi.removeFriend(targetId);
              setRequests((prev) =>
                prev.filter((r) => r.relationship.targetId !== targetId),
              );
            } catch (err: any) {
              toast.error(err.message || 'Failed to decline request');
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
    loadingContainer: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      ...(neo ? { borderBottomWidth: neo.borderWidth, borderBottomColor: colors.border } : {}),
    },
    headerTitle: {
      fontSize: fontSize.xl,
      fontWeight: neo ? '800' : '700',
      color: colors.textPrimary,
      ...(neo ? { textTransform: 'uppercase' as const } : {}),
    },
    headerCount: {
      fontSize: fontSize.sm,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    list: {
      paddingBottom: spacing.xxxl,
    },
    requestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    requestInfo: {
      flex: 1,
    },
    requestName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    requestUsername: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: 2,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    acceptBtn: {
      padding: spacing.xs,
    },
    declineBtn: {
      padding: spacing.xs,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  if (loadError && requests.length === 0) return <LoadErrorCard title="Failed to load requests" message={loadError} onRetry={() => { setLoading(true); fetchRequests(); }} />;

  return (
    <PatternBackground>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Message Requests</Text>
        <Text style={styles.headerCount}>{requests.length} pending</Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.relationship.id || item.relationship.targetId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchRequests();
            }}
            tintColor={colors.accentPrimary}
          />
        }
        renderItem={({ item }) => {
          const name =
            item.user?.displayName ||
            item.user?.username ||
            item.relationship.targetId.slice(0, 8);
          const username = item.user?.username;

          return (
            <View style={styles.requestRow}>
              <Avatar
                userId={item.relationship.targetId}
                avatarHash={item.user?.avatarHash}
                name={name}
                size={48}
                showStatus
              />
              <View style={styles.requestInfo}>
                <Text style={styles.requestName}>{name}</Text>
                {username && (
                  <Text style={styles.requestUsername}>@{username}</Text>
                )}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => handleAccept(item.relationship.targetId)}
                  accessibilityLabel="Accept request"
                >
                  <Ionicons name="checkmark-circle" size={28} color={colors.success} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={() => handleDecline(item.relationship.targetId)}
                  accessibilityLabel="Decline request"
                >
                  <Ionicons name="close-circle" size={28} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="mail-open-outline"
            title="No message requests"
            subtitle="When someone who isn't your friend sends you a message, it will appear here"
          />
        }
      />
    </PatternBackground>
  );
}
