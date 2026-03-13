import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { starboard as starboardApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { StarboardConfig } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'StarboardConfig'>;

export default function StarboardConfigScreen({ route }: Props) {
  const { guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [config, setConfig] = useState<StarboardConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState('3');
  const [emoji, setEmoji] = useState('⭐');
  const [channelId, setChannelId] = useState('');

  const fetchConfig = useCallback(async () => {
    try {
      const data = await starboardApi.getConfig(guildId);
      setConfig(data);
      setEnabled(data.enabled);
      setThreshold(String(data.threshold));
      setEmoji(data.emoji);
      setChannelId(data.channelId || '');
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load starboard config');
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    const parsed = parseInt(threshold, 10);
    if (isNaN(parsed) || parsed < 1) {
      toast.error('Threshold must be at least 1');
      return;
    }
    setSaving(true);
    try {
      await starboardApi.updateConfig(guildId, {
        enabled,
        threshold: parsed,
        emoji: emoji.trim() || '⭐',
        channelId: channelId.trim() || null,
      });
      toast.success('Starboard config saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLabel: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    label: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      marginBottom: spacing.xs,
      marginTop: spacing.lg,
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
    hint: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: spacing.xs,
    },
    saveButton: {
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.xxl,
    },
    saveButtonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  if (loadError && !config) {
    return (
      <PatternBackground>
        <EmptyState
          icon="alert-circle-outline"
          title="Failed to load starboard"
          subtitle={loadError}
          actionLabel="Retry"
          onAction={fetchConfig}
        />
      </PatternBackground>
    );
  }

  return (
    <PatternBackground>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Enabled</Text>
        <Switch
          value={enabled}
          onValueChange={setEnabled}
          trackColor={{ false: colors.bgSecondary, true: colors.accentPrimary }}
          thumbColor={colors.white}
        />
      </View>

      <Text style={styles.label}>Star Threshold</Text>
      <TextInput
        style={styles.input}
        value={threshold}
        onChangeText={setThreshold}
        keyboardType="number-pad"
        placeholder="3"
        placeholderTextColor={colors.textMuted}
      />
      <Text style={styles.hint}>Minimum stars needed to appear on the starboard</Text>

      <Text style={styles.label}>Emoji</Text>
      <TextInput
        style={styles.input}
        value={emoji}
        onChangeText={setEmoji}
        placeholder="⭐"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Starboard Channel ID</Text>
      <TextInput
        style={styles.input}
        value={channelId}
        onChangeText={setChannelId}
        placeholder="Channel ID (optional)"
        placeholderTextColor={colors.textMuted}
      />
      <Text style={styles.hint}>Channel where starboard messages are posted</Text>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
      </TouchableOpacity>
    </ScrollView>
    </PatternBackground>
  );
}
