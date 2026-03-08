import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { guilds, channels, messages } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Guild, Channel } from '../types';

interface ForwardModalProps {
  visible: boolean;
  onClose: () => void;
  messageContent: string;
}

export default function ForwardModal({ visible, onClose, messageContent }: ForwardModalProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [guildList, setGuildList] = useState<Guild[]>([]);
  const [channelList, setChannelList] = useState<Channel[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchGuilds = useCallback(async () => {
    setLoading(true);
    try {
      const data = await guilds.getMine();
      setGuildList(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchChannels = useCallback(async (guildId: string) => {
    setLoading(true);
    try {
      const data = await channels.getForGuild(guildId);
      setChannelList(data.filter((c) => c.type === 'text'));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setSelectedGuild(null);
      setChannelList([]);
      fetchGuilds();
    }
  }, [visible, fetchGuilds]);

  const handleGuildSelect = (guild: Guild) => {
    setSelectedGuild(guild);
    fetchChannels(guild.id);
  };

  const handleBack = () => {
    setSelectedGuild(null);
    setChannelList([]);
  };

  const handleChannelSelect = async (channel: Channel) => {
    if (sending) return;
    setSending(true);
    try {
      await messages.send(channel.id, messageContent);
      toast.success(`Message sent to #${channel.name}`);
      onClose();
    } catch {
      toast.error('Failed to forward message');
    } finally {
      setSending(false);
    }
  };

  const renderGuild = ({ item }: { item: Guild }) => (
    <TouchableOpacity style={styles.listItem} onPress={() => handleGuildSelect(item)}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.itemName} numberOfLines={1}>
        {item.name}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const renderChannel = ({ item }: { item: Channel }) => (
    <TouchableOpacity
      style={[styles.listItem, sending && styles.listItemDisabled]}
      onPress={() => handleChannelSelect(item)}
      disabled={sending}
    >
      <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
      <Text style={styles.itemName} numberOfLines={1}>
        #{item.name}
      </Text>
    </TouchableOpacity>
  );

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: colors.bgSecondary,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
      paddingBottom: 30,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: colors.textMuted,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      marginRight: spacing.sm,
    },
    title: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '600',
      flex: 1,
    },
    preview: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      backgroundColor: colors.bgElevated,
      marginHorizontal: spacing.xl,
      marginTop: spacing.md,
      borderRadius: borderRadius.md,
    },
    previewLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    previewContent: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 20,
    },
    loader: {
      paddingVertical: spacing.xxxl,
    },
    listContent: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.md,
      marginBottom: spacing.sm,
      gap: spacing.md,
    },
    listItemDisabled: {
      opacity: 0.5,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.accentPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    itemName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
      flex: 1,
    },
    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxxl,
      gap: spacing.sm,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: fontSize.md,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            {selectedGuild ? (
              <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            ) : null}
            <Text style={styles.title}>
              {selectedGuild ? selectedGuild.name : 'Forward to...'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.preview}>
            <Text style={styles.previewLabel}>Message:</Text>
            <Text style={styles.previewContent} numberOfLines={2}>
              {messageContent}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator
              size="large"
              color={colors.accentPrimary}
              style={styles.loader}
            />
          ) : selectedGuild ? (
            <FlatList
              data={channelList}
              keyExtractor={(item) => item.id}
              renderItem={renderChannel}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="chatbubble-outline" size={40} color={colors.textMuted} />
                  <Text style={styles.emptyText}>No text channels</Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={guildList}
              keyExtractor={(item) => item.id}
              renderItem={renderGuild}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="server-outline" size={40} color={colors.textMuted} />
                  <Text style={styles.emptyText}>No servers found</Text>
                </View>
              }
            />
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
