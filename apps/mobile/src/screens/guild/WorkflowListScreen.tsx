import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workflows as workflowsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { Workflow } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'WorkflowList'>;

function getTriggerIcon(trigger: string): keyof typeof Ionicons.glyphMap {
  switch (trigger) {
    case 'message_create': return 'chatbubble-outline';
    case 'member_join': return 'person-add-outline';
    case 'member_leave': return 'person-remove-outline';
    case 'reaction_add': return 'happy-outline';
    case 'scheduled': return 'time-outline';
    default: return 'flash-outline';
  }
}

export default function WorkflowListScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId } = route.params;
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    try {
      const data = await workflowsApi.list(guildId);
      setWorkflows(data);
      setLoadError(null);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load workflows';
        if (refreshing || workflows.length > 0) {
          toast.error(message);
        } else {
          setLoadError(message);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId, refreshing, toast, workflows.length]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleToggle = async (workflow: Workflow) => {
    const newEnabled = !workflow.enabled;
    setWorkflows((prev) =>
      prev.map((w) => (w.id === workflow.id ? { ...w, enabled: newEnabled } : w))
    );

    try {
      await workflowsApi.update(guildId, workflow.id, { enabled: newEnabled });
    } catch (err: any) {
      setWorkflows((prev) =>
        prev.map((w) => (w.id === workflow.id ? { ...w, enabled: workflow.enabled } : w))
      );
      toast.error(err.message || 'Failed to update workflow');
    }
  };

  const renderItem = ({ item }: { item: Workflow }) => (
    <View style={styles.itemCard}>
      <View style={styles.iconCircle}>
        <Ionicons name={getTriggerIcon(item.trigger)} size={20} color={colors.accentPrimary} />
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        {item.description ? (
          <Text style={styles.itemDescription} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <Text style={styles.triggerText}>Trigger: {item.trigger.replace(/_/g, ' ')}</Text>
      </View>
      <Switch
        value={item.enabled}
        onValueChange={() => handleToggle(item)}
        trackColor={{ false: colors.bgTertiary, true: colors.accentPrimary }}
        thumbColor={colors.white}
      />
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
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    itemInfo: {
      flex: 1,
    },
    itemName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    itemDescription: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      marginTop: 2,
      lineHeight: 18,
    },
    triggerText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: spacing.xs,
      textTransform: 'capitalize',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  if (loadError && workflows.length === 0) {
    return (
      <PatternBackground>
        <EmptyState
          icon="alert-circle-outline"
          title="Failed to load workflows"
          subtitle={loadError}
          actionLabel="Retry"
          onAction={fetchWorkflows}
        />
      </PatternBackground>
    );
  }

  return (
    <PatternBackground>
      <FlatList
        data={workflows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchWorkflows(); }}
            tintColor={colors.accentPrimary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="git-branch-outline"
            title="No workflows configured"
            subtitle="Create workflows from the web app."
          />
        }
      />
    </PatternBackground>
  );
}
