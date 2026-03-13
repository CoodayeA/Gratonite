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
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { invites as invitesApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import EmptyState from '../../components/EmptyState';
import type { GuildInvite } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'InviteList'>;

export default function InviteListScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId } = route.params;
  const [inviteList, setInviteList] = useState<GuildInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await invitesApi.listForGuild(guildId);
      setInviteList(data);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err.message || 'Failed to load invites';
        setLoadError(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId, toast]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleCreate = async () => {
    setCreatingInvite(true);
    try {
      const invite = await invitesApi.create(guildId);
      setInviteList((prev) => [invite, ...prev]);
      const inviteUrl = `https://gratonite.chat/invite/${invite.code}`;
      await Share.share({ message: inviteUrl });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create invite');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleRevoke = (code: string) => {
    Alert.alert(
      'Revoke Invite',
      `Are you sure you want to revoke invite ${code}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await invitesApi.revoke(code);
              setInviteList((prev) => prev.filter((i) => i.code !== code));
            } catch (err: any) {
              toast.error(err.message || 'Failed to revoke invite');
            }
          },
        },
      ],
    );
  };

  const handleShare = async (code: string) => {
    const inviteUrl = `https://gratonite.chat/invite/${code}`;
    await Share.share({ message: inviteUrl });
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never';
    const date = new Date(expiresAt);
    const now = new Date();
    if (date < now) return 'Expired';
    const diffMs = date.getTime() - now.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 1) return `${Math.floor(diffMs / (1000 * 60))}m left`;
    if (diffHrs < 24) return `${diffHrs}h left`;
    return `${Math.floor(diffHrs / 24)}d left`;
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: fontSize.xl,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.accentPrimary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      gap: spacing.xs,
      minWidth: 120,
      justifyContent: 'center',
    },
    createBtnText: {
      color: colors.white,
      fontWeight: '600',
      fontSize: fontSize.sm,
    },
    list: {
      paddingBottom: spacing.xxxl,
    },
    inviteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    inviteInfo: {
      flex: 1,
    },
    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    inviteCode: {
      color: colors.accentPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
      fontFamily: 'monospace',
    },
    metaRow: {
      flexDirection: 'row',
      marginTop: spacing.xs,
      gap: spacing.md,
    },
    metaText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    inviteActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    actionBtn: {
      padding: spacing.sm,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  if (loadError && inviteList.length === 0) {
    return (
      <PatternBackground>
        <View style={[styles.loadingContainer, { paddingHorizontal: spacing.xl, gap: spacing.md }]}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.accentPrimary} />
          <Text style={[styles.headerTitle, { textAlign: 'center' }]}>Failed to load invites</Text>
          <Text style={[styles.metaText, { textAlign: 'center', fontSize: fontSize.sm }]}>{loadError}</Text>
          <TouchableOpacity
            style={[styles.createBtn, { marginTop: spacing.sm }]}
            onPress={() => {
              setLoading(true);
              fetchInvites();
            }}
          >
            <Ionicons name="refresh" size={18} color={colors.white} />
            <Text style={styles.createBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </PatternBackground>
    );
  }

  return (
    <PatternBackground>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Invites</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={handleCreate}
          disabled={creatingInvite}
        >
          {creatingInvite ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="add" size={22} color={colors.white} />
              <Text style={styles.createBtnText}>Create Invite</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={inviteList}
        keyExtractor={(item) => item.code}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchInvites();
            }}
            tintColor={colors.accentPrimary}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.inviteRow}>
            <View style={styles.inviteInfo}>
              <View style={styles.codeRow}>
                <Ionicons name="link-outline" size={16} color={colors.accentPrimary} />
                <Text style={styles.inviteCode}>{item.code}</Text>
              </View>
              <View style={styles.metaRow}>
                {item.creatorUsername && (
                  <Text style={styles.metaText}>by {item.creatorUsername}</Text>
                )}
                <Text style={styles.metaText}>
                  {item.uses}{item.maxUses ? `/${item.maxUses}` : ''} uses
                </Text>
                <Text style={styles.metaText}>{formatExpiry(item.expiresAt)}</Text>
              </View>
            </View>
            <View style={styles.inviteActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleShare(item.code)}
                accessibilityLabel="Copy invite link"
              >
                <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleRevoke(item.code)}
                accessibilityLabel="Delete invite"
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="link-outline"
            title="No invites"
            subtitle="Create an invite to share with others"
            actionLabel="Create Invite"
            onAction={handleCreate}
          />
        }
      />
    </PatternBackground>
  );
}
