import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PortalsStackParamList } from '../../navigation/types';
import { guildsApi } from '../../lib/api';
import { colors, spacing, radius, fontSize } from '../../theme';

type Props = NativeStackScreenProps<PortalsStackParamList, 'GuildRoles'>;

interface Role {
  id: string;
  name: string;
  mentionable?: boolean;
  color?: string;
}

export function GuildRolesScreen({ route }: Props) {
  const { guildId } = route.params;

  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState('');

  const loadRoles = useCallback(async () => {
    try {
      const data = await guildsApi.getRoles(guildId);
      setRoles(data);
      setError('');
    } catch {
      setError('Failed to load roles.');
    }
  }, [guildId]);

  useEffect(() => {
    setLoading(true);
    loadRoles().finally(() => setLoading(false));
  }, [loadRoles]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(''), 2200);
    return () => clearTimeout(timer);
  }, [feedback]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRoles();
    setRefreshing(false);
  }, [loadRoles]);

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) => r.name.toLowerCase().includes(q));
  }, [roles, search]);

  const roleStats = useMemo(() => ({
    total: roles.length,
    custom: roles.filter((r) => r.name !== '@everyone').length,
    mentionable: roles.filter((r) => r.mentionable && r.name !== '@everyone').length,
  }), [roles]);

  async function handleCreateRole() {
    const name = newRoleName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await guildsApi.createRole(guildId, { name, mentionable: true });
      setNewRoleName('');
      await loadRoles();
      setFeedback('Role created.');
    } catch {
      Alert.alert('Error', 'Failed to create role.');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleMentionable(role: Role) {
    try {
      await guildsApi.updateRole(guildId, role.id, { mentionable: !role.mentionable });
      await loadRoles();
      setFeedback(role.mentionable ? 'Mention disabled.' : 'Role is now mentionable.');
    } catch {
      Alert.alert('Error', 'Failed to update role.');
    }
  }

  async function handleDeleteRole(role: Role) {
    Alert.alert('Delete Role', `Delete @${role.name}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await guildsApi.deleteRole(guildId, role.id);
            await loadRoles();
            setFeedback('Role deleted.');
          } catch {
            Alert.alert('Error', 'Failed to delete role.');
          }
        },
      },
    ]);
  }

  const renderRole = useCallback(({ item }: { item: Role }) => {
    const isEveryone = item.name === '@everyone';
    return (
      <View style={styles.roleCard}>
        <View style={styles.roleInfo}>
          <Text style={styles.roleName}>@{item.name}</Text>
          <Text style={styles.roleSubline}>
            {item.mentionable ? 'Mentionable' : 'Not mentionable'}
          </Text>
        </View>
        <View style={styles.roleActions}>
          {!isEveryone && (
            <TouchableOpacity
              style={[styles.actionButton, item.mentionable ? styles.actionActive : null]}
              onPress={() => handleToggleMentionable(item)}
            >
              <Text style={styles.actionText}>{item.mentionable ? 'Unmention' : 'Mention'}</Text>
            </TouchableOpacity>
          )}
          {!isEveryone && (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionDanger]}
              onPress={() => handleDeleteRole(item)}
            >
              <Text style={styles.actionDangerText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }, [guildId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <ActivityIndicator color={colors.brand.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Stats bar */}
      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statText}>{roleStats.total} total</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statText}>{roleStats.custom} custom</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statText}>{roleStats.mentionable} mentionable</Text>
        </View>
      </View>

      {/* Create role */}
      <View style={styles.createCard}>
        <TextInput
          style={styles.input}
          value={newRoleName}
          onChangeText={setNewRoleName}
          placeholder="New role name..."
          placeholderTextColor={colors.text.muted}
          editable={!creating}
          onSubmitEditing={handleCreateRole}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.createButton, (!newRoleName.trim() || creating) && styles.createButtonDisabled]}
          onPress={handleCreateRole}
          disabled={!newRoleName.trim() || creating}
        >
          {creating ? (
            <ActivityIndicator color={colors.text.inverse} size="small" />
          ) : (
            <Text style={styles.createButtonText}>Create</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Search */}
      <TextInput
        style={[styles.input, { marginHorizontal: spacing.lg, marginBottom: spacing.sm }]}
        value={search}
        onChangeText={setSearch}
        placeholder="Search roles..."
        placeholderTextColor={colors.text.muted}
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {feedback ? <Text style={styles.feedbackText}>{feedback}</Text> : null}

      {/* Role list */}
      <FlatList
        data={filteredRoles}
        keyExtractor={(item) => item.id}
        renderItem={renderRole}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand.primary}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {roles.length === 0 ? 'No roles found.' : 'No roles match your search.'}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg.primary,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  statPill: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statText: {
    color: colors.text.secondary,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  createCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text.primary,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  createButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: colors.text.inverse,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  roleCard: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  roleInfo: {
    marginBottom: spacing.sm,
  },
  roleName: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  roleSubline: {
    color: colors.text.muted,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  roleActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    backgroundColor: colors.bg.tertiary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  actionActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
  },
  actionText: {
    color: colors.text.secondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  actionDanger: {
    backgroundColor: 'rgba(232, 90, 110, 0.15)',
  },
  actionDangerText: {
    color: colors.accent.error,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  errorText: {
    color: colors.accent.error,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  feedbackText: {
    color: colors.accent.success,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  emptyText: {
    color: colors.text.muted,
    fontSize: fontSize.md,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
