import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { channels as channelsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import type { Channel } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ChannelEdit'>;

export default function ChannelEditScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { channelId, guildId } = route.params;

  const [channel, setChannel] = useState<Channel | null>(null);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchChannel = useCallback(async () => {
    try {
      const data = await channelsApi.get(channelId);
      setChannel(data);
      setName(data.name);
      setTopic(data.topic || '');
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load channel');
        navigation.goBack();
      }
    } finally {
      setLoading(false);
    }
  }, [channelId, navigation]);

  useEffect(() => {
    fetchChannel();
  }, [fetchChannel]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Channel name is required');
      return;
    }

    setSaving(true);
    try {
      await channelsApi.update(channelId, {
        name: trimmedName,
        topic: topic.trim() || null,
      });
      toast.success('Channel updated');
      navigation.goBack();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update channel');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Channel',
      `Are you sure you want to delete #${channel?.name}? This cannot be undone and all messages will be lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await channelsApi.delete(channelId);
              toast.success('Channel deleted');
              navigation.goBack();
            } catch (err: any) {
              toast.error(err.message || 'Failed to delete channel');
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
    content: {
      paddingBottom: spacing.xxxl * 2,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    channelHeader: {
      alignItems: 'center',
      paddingVertical: spacing.xxl,
      gap: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    channelType: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    section: {
      marginTop: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    sectionTitle: {
      fontSize: fontSize.xs,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      color: colors.textPrimary,
      fontSize: fontSize.md,
    },
    topicInput: {
      minHeight: 80,
      paddingTop: spacing.md,
    },
    saveBtn: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.xxl,
      backgroundColor: colors.accentPrimary,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    saveBtnDisabled: {
      opacity: 0.5,
    },
    saveBtnText: {
      color: colors.white,
      fontWeight: '700',
      fontSize: fontSize.md,
    },
    dangerSection: {
      marginTop: spacing.xxxl,
      paddingHorizontal: spacing.lg,
    },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgSecondary,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      gap: spacing.md,
    },
    deleteBtnText: {
      color: colors.error,
      fontSize: fontSize.md,
      fontWeight: '600',
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Channel info */}
      <View style={styles.channelHeader}>
        <Ionicons
          name={channel?.type === 'voice' ? 'volume-high-outline' : 'chatbubble-outline'}
          size={28}
          color={colors.textSecondary}
        />
        <Text style={styles.channelType}>{channel?.type || 'text'} channel</Text>
      </View>

      {/* Name */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CHANNEL NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="channel-name"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Topic */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CHANNEL TOPIC</Text>
        <TextInput
          style={[styles.input, styles.topicInput]}
          value={topic}
          onChangeText={setTopic}
          placeholder="What is this channel about?"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving || !name.trim()}
      >
        {saving ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Text style={styles.saveBtnText}>Save Changes</Text>
        )}
      </TouchableOpacity>

      {/* Delete */}
      <View style={styles.dangerSection}>
        <Text style={styles.sectionTitle}>DANGER ZONE</Text>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
          <Text style={styles.deleteBtnText}>Delete Channel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
