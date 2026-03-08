import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tickets as ticketsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { Ticket } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'TicketList'>;

type Tab = 'open' | 'closed';

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

export default function TicketListScreen({ route }: Props) {
  const { guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('open');
  const [ticketList, setTicketList] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [creating, setCreating] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const data = await ticketsApi.list(guildId, tab);
      setTicketList(data);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load tickets');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId, tab]);

  useEffect(() => {
    setLoading(true);
    fetchTickets();
  }, [fetchTickets]);

  const handleToggleStatus = (ticket: Ticket) => {
    const action = ticket.status === 'open' ? 'Close' : 'Reopen';
    Alert.alert(`${action} Ticket`, `Are you sure you want to ${action.toLowerCase()} this ticket?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action,
        onPress: async () => {
          try {
            if (ticket.status === 'open') {
              await ticketsApi.close(guildId, ticket.id);
            } else {
              await ticketsApi.reopen(guildId, ticket.id);
            }
            fetchTickets();
          } catch (err: any) {
            toast.error(err.message || `Failed to ${action.toLowerCase()} ticket`);
          }
        },
      },
    ]);
  };

  const handleCreate = async () => {
    if (!newSubject.trim()) {
      toast.error('Subject is required');
      return;
    }
    setCreating(true);
    try {
      await ticketsApi.create(guildId, { subject: newSubject.trim(), priority: newPriority });
      setCreateVisible(false);
      setNewSubject('');
      setNewPriority('medium');
      fetchTickets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.bgElevated,
    },
    tabActive: {
      backgroundColor: colors.accentPrimary,
    },
    tabText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    tabTextActive: {
      color: colors.white,
    },
    list: {
      paddingBottom: spacing.xxxl,
    },
    ticketRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    ticketInfo: {
      flex: 1,
    },
    ticketSubject: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    ticketMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: 4,
    },
    priorityBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
    },
    priorityText: {
      fontSize: fontSize.xs,
      fontWeight: '700',
      color: colors.white,
    },
    creatorName: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    ticketDate: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.xxl,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.bgPrimary,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      padding: spacing.lg,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
      fontWeight: '700',
      marginBottom: spacing.lg,
    },
    label: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    input: {
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    priorityPicker: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    priorityOption: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
      backgroundColor: colors.bgElevated,
    },
    priorityOptionSelected: {
      borderColor: colors.accentPrimary,
    },
    priorityOptionText: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    createButton: {
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    createButtonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {(['open', 'closed'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={ticketList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTickets(); }} tintColor={colors.accentPrimary} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.ticketRow} onLongPress={() => handleToggleStatus(item)}>
            <View style={[styles.statusDot, { backgroundColor: item.status === 'open' ? colors.success : colors.textMuted }]} />
            <View style={styles.ticketInfo}>
              <Text style={styles.ticketSubject}>{item.subject}</Text>
              <View style={styles.ticketMeta}>
                <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[item.priority] || colors.textMuted }]}>
                  <Text style={styles.priorityText}>{item.priority.toUpperCase()}</Text>
                </View>
                <Text style={styles.creatorName}>{item.creatorName || 'Unknown'}</Text>
                <Text style={styles.ticketDate}>{formatRelativeTime(item.createdAt)}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="ticket-outline"
            title={`No ${tab} tickets`}
            subtitle={tab === 'open' ? 'Create a ticket to get started' : 'No closed tickets yet'}
          />
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setCreateVisible(true)}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      <Modal visible={createVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Ticket</Text>

            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.input}
              value={newSubject}
              onChangeText={setNewSubject}
              placeholder="What's the issue?"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Priority</Text>
            <View style={styles.priorityPicker}>
              {(['low', 'medium', 'high'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.priorityOption, newPriority === p && styles.priorityOptionSelected]}
                  onPress={() => setNewPriority(p)}
                >
                  <Text style={styles.priorityOptionText}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.createButton} onPress={handleCreate} disabled={creating}>
              <Text style={styles.createButtonText}>{creating ? 'Creating...' : 'Create Ticket'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setCreateVisible(false)} style={{ alignItems: 'center', marginTop: spacing.md }}>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.md }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
