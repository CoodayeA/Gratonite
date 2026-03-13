import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { autoRoles as autoRolesApi } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { AutoRole } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'AutoRoleConfig'>;

export default function AutoRoleConfigScreen({ route }: Props) {
  const { guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const [roles, setRoles] = useState<AutoRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    try {
      const data = await autoRolesApi.list(guildId);
      setRoles(data);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load auto roles');
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleToggle = async (autoRole: AutoRole) => {
    const newEnabled = !autoRole.enabled;
    setRoles((prev) =>
      prev.map((r) => (r.id === autoRole.id ? { ...r, enabled: newEnabled } : r))
    );
    try {
      await autoRolesApi.update(guildId, autoRole.id, { enabled: newEnabled });
    } catch (err: any) {
      // Revert on failure
      setRoles((prev) =>
        prev.map((r) => (r.id === autoRole.id ? { ...r, enabled: autoRole.enabled } : r))
      );
      toast.error(err.message || 'Failed to update auto role');
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    list: {
      paddingBottom: spacing.xxxl,
    },
    roleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    roleIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
    roleInfo: {
      flex: 1,
    },
    roleName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    roleTrigger: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  if (loadError && roles.length === 0) {
    return (
      <PatternBackground>
        <EmptyState
          icon="alert-circle-outline"
          title="Failed to load auto roles"
          subtitle={loadError}
          actionLabel="Retry"
          onAction={fetchRoles}
        />
      </PatternBackground>
    );
  }

  return (
    <PatternBackground>
      <FlatList
        data={roles}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.roleRow}>
            <View style={styles.roleIcon}>
              <Ionicons name="shield-outline" size={18} color={colors.textSecondary} />
            </View>
            <View style={styles.roleInfo}>
              <Text style={styles.roleName}>{item.roleName || item.roleId.slice(0, 8)}</Text>
              <Text style={styles.roleTrigger}>Trigger: {item.trigger}</Text>
            </View>
            <Switch
              value={item.enabled}
              onValueChange={() => handleToggle(item)}
              trackColor={{ false: colors.bgSecondary, true: colors.accentPrimary }}
              thumbColor={colors.white}
            />
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="shield-outline"
            title="No auto roles"
            subtitle="Auto roles will appear here when configured"
          />
        }
      />
    </PatternBackground>
  );
}
