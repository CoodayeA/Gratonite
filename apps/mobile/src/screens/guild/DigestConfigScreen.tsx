import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { digest as digestApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import type { DigestConfig } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'DigestConfig'>;

export default function DigestConfigScreen({ route }: Props) {
  const { guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');

  const fetchConfig = useCallback(async () => {
    try {
      const data = await digestApi.getConfig(guildId);
      setEnabled(data.enabled);
      setFrequency(data.frequency);
    } catch (err: any) {
      // silently ignore — empty state handles no data
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await digestApi.updateConfig(guildId, { enabled, frequency });
      toast.success('Digest config saved');
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
    frequencyPicker: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    frequencyOption: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      backgroundColor: colors.bgElevated,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    frequencyOptionSelected: {
      borderColor: colors.accentPrimary,
    },
    frequencyOptionText: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
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

      <Text style={styles.label}>Frequency</Text>
      <View style={styles.frequencyPicker}>
        {(['daily', 'weekly'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.frequencyOption, frequency === f && styles.frequencyOptionSelected]}
            onPress={() => setFrequency(f)}
          >
            <Text style={styles.frequencyOptionText}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
      </TouchableOpacity>
    </ScrollView>
    </PatternBackground>
  );
}
