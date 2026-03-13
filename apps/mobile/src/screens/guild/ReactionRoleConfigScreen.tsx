import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reactionRoles as reactionRolesApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { ReactionRole } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'ReactionRoleConfig'>;

export default function ReactionRoleConfigScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId } = route.params;
  const [roles, setRoles] = useState<ReactionRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRoles = useCallback(async () => {
    try {
      const data = await reactionRolesApi.list(guildId);
      setRoles(data);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load reaction roles');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleDelete = (item: ReactionRole) => {
    Alert.alert(
      'Delete Reaction Role',
      `Remove the ${item.emoji} reaction role mapping?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await reactionRolesApi.delete(guildId, item.id);
              setRoles((prev) => prev.filter((r) => r.id !== item.id));
            } catch (err: any) {
              toast.error(err.message || 'Failed to delete');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: ReactionRole }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemLeft}>
        <Text style={styles.emoji}>{item.emoji}</Text>
        <View style={styles.itemInfo}>
          <Text style={styles.roleName}>{item.roleName || item.roleId}</Text>
          <Text style={styles.messageRef} numberOfLines={1}>
            Message: {item.messageId.slice(0, 12)}...
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Delete reaction role">
        <Ionicons name="trash-outline" size={20} color={colors.error} />
      </TouchableOpacity>
    </View>
  );

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
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    itemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      flex: 1,
    },
    emoji: {
      fontSize: 24,
    },
    itemInfo: {
      flex: 1,
    },
    roleName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    messageRef: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  return (
    <PatternBackground>
      <FlatList
        data={roles}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchRoles(); }}
            tintColor={colors.accentPrimary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="happy-outline"
            title="No reaction roles"
            subtitle="Configure reaction roles from the web app to let members self-assign roles."
          />
        }
      />
    </PatternBackground>
  );
}
