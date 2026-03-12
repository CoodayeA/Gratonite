import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { roles as rolesApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import EmptyState from '../../components/EmptyState';
import type { Role } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'RoleList'>;

export default function RoleListScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId } = route.params;
  const [roleList, setRoleList] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRoles = useCallback(async () => {
    try {
      const data = await rolesApi.list(guildId);
      // Sort by position descending (highest position = most important)
      data.sort((a, b) => b.position - a.position);
      setRoleList(data);
    } catch (err: any) {
      // silently ignore — empty state handles no data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchRoles();
    });
    return unsubscribe;
  }, [navigation, fetchRoles]);

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
    },
    createBtnText: {
      color: colors.white,
      fontWeight: '600',
      fontSize: fontSize.sm,
    },
    list: {
      paddingBottom: spacing.xxxl,
    },
    roleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    colorDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    roleInfo: {
      flex: 1,
    },
    roleName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    roleMeta: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  return (
    <PatternBackground>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Roles</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => navigation.navigate('RoleEdit', { guildId })}
        >
          <Ionicons name="add" size={22} color={colors.white} />
          <Text style={styles.createBtnText}>Create Role</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={roleList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchRoles();
            }}
            tintColor={colors.accentPrimary}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.roleRow}
            onPress={() => navigation.navigate('RoleEdit', { guildId, roleId: item.id })}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.colorDot,
                { backgroundColor: item.color || colors.textMuted },
              ]}
            />
            <View style={styles.roleInfo}>
              <Text style={[styles.roleName, item.color ? { color: item.color } : null]}>
                {item.name}
              </Text>
              <Text style={styles.roleMeta}>
                Position: {item.position}
                {item.hoist ? ' | Hoisted' : ''}
                {item.mentionable ? ' | Mentionable' : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="shield-outline"
            title="No roles"
            subtitle="Create a role to manage permissions"
            actionLabel="Create Role"
            onAction={() => navigation.navigate('RoleEdit', { guildId })}
          />
        }
      />
    </PatternBackground>
  );
}
