import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { webhooks as webhooksApi, channels as channelsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { Webhook, Channel } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'WebhookManagement'>;

export default function WebhookManagementScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId } = route.params;
  const [webhookList, setWebhookList] = useState<Webhook[]>([]);
  const [channelList, setChannelList] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showChannelPicker, setShowChannelPicker] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [hooks, channels] = await Promise.all([
        webhooksApi.listForGuild(guildId),
        channelsApi.getForGuild(guildId),
      ]);
      setWebhookList(hooks);
      setChannelList(channels.filter((c) => c.type === 'text'));
    } catch (err: any) {
      // silently ignore — empty state handles no data
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = (webhook: Webhook) => {
    Alert.alert(
      'Delete Webhook',
      `Are you sure you want to delete "${webhook.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await webhooksApi.delete(webhook.id);
              setWebhookList((prev) => prev.filter((w) => w.id !== webhook.id));
            } catch (err: any) {
              toast.error(err.message || 'Failed to delete webhook');
            }
          },
        },
      ],
    );
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || !selectedChannelId) {
      toast.error('Name and channel are required');
      return;
    }

    setCreating(true);
    try {
      const webhook = await webhooksApi.create(guildId, { name, channelId: selectedChannelId });
      setWebhookList((prev) => [...prev, webhook]);
      setShowCreate(false);
      setNewName('');
      setSelectedChannelId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create webhook');
    } finally {
      setCreating(false);
    }
  };

  const getChannelName = (channelId: string): string => {
    const channel = channelList.find((c) => c.id === channelId);
    return channel?.name || 'Unknown';
  };

  const renderWebhook = ({ item }: { item: Webhook }) => (
    <View style={styles.webhookRow}>
      <View style={styles.webhookIcon}>
        <Ionicons name="globe-outline" size={20} color={colors.accentPrimary} />
      </View>
      <View style={styles.webhookInfo}>
        <Text style={styles.webhookName}>{item.name}</Text>
        <Text style={styles.webhookChannel}>#{getChannelName(item.channelId)}</Text>
        <Text style={styles.webhookDate}>
          Created {formatRelativeTime(item.createdAt)}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item)}
      >
        <Ionicons name="trash-outline" size={18} color={colors.error} />
      </TouchableOpacity>
    </View>
  );

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    listContent: {
      paddingBottom: spacing.xxxl,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      margin: spacing.lg,
      paddingVertical: spacing.lg,
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    createButtonText: {
      color: colors.accentPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    webhookRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    webhookIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    webhookInfo: {
      flex: 1,
    },
    webhookName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    webhookChannel: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
    webhookDate: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
    deleteButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(240, 71, 71, 0.12)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.bgPrimary,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingBottom: spacing.xxxl,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '700',
    },
    createText: {
      color: colors.accentPrimary,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    createTextDisabled: {
      color: colors.textMuted,
    },
    formSection: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
    },
    formLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    formInput: {
      backgroundColor: colors.inputBg,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    channelSelect: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.inputBg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    channelSelectText: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
    },
    channelSelectPlaceholder: {
      color: colors.textMuted,
    },
    channelPickerList: {
      marginTop: spacing.sm,
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.md,
      maxHeight: 200,
      overflow: 'hidden',
    },
    channelPickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    channelPickerItemActive: {
      backgroundColor: colors.accentLight,
    },
    channelPickerText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: fontSize.sm,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <FlatList
        data={webhookList}
        keyExtractor={(item) => item.id}
        renderItem={renderWebhook}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <TouchableOpacity style={styles.createButton} onPress={() => setShowCreate(true)}>
            <Ionicons name="add-circle-outline" size={22} color={colors.accentPrimary} />
            <Text style={styles.createButtonText}>Create Webhook</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <EmptyState
            icon="globe-outline"
            title="No webhooks"
            subtitle="Create webhooks to integrate external services"
          />
        }
      />

      {/* Create Webhook Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Create Webhook</Text>
              <TouchableOpacity
                onPress={handleCreate}
                disabled={creating || !newName.trim() || !selectedChannelId}
              >
                <Text
                  style={[
                    styles.createText,
                    (creating || !newName.trim() || !selectedChannelId) && styles.createTextDisabled,
                  ]}
                >
                  {creating ? 'Creating...' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Name</Text>
              <TextInput
                style={styles.formInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="Webhook name"
                placeholderTextColor={colors.textMuted}
                maxLength={100}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Channel</Text>
              <TouchableOpacity
                style={styles.channelSelect}
                onPress={() => setShowChannelPicker(!showChannelPicker)}
              >
                <Text style={[styles.channelSelectText, !selectedChannelId && styles.channelSelectPlaceholder]}>
                  {selectedChannelId
                    ? `#${getChannelName(selectedChannelId)}`
                    : 'Select a channel'}
                </Text>
                <Ionicons
                  name={showChannelPicker ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>

              {showChannelPicker && (
                <View style={styles.channelPickerList}>
                  {channelList.map((channel) => (
                    <TouchableOpacity
                      key={channel.id}
                      style={[
                        styles.channelPickerItem,
                        selectedChannelId === channel.id && styles.channelPickerItemActive,
                      ]}
                      onPress={() => {
                        setSelectedChannelId(channel.id);
                        setShowChannelPicker(false);
                      }}
                    >
                      <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.channelPickerText}>#{channel.name}</Text>
                      {selectedChannelId === channel.id && (
                        <Ionicons name="checkmark" size={16} color={colors.accentPrimary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
