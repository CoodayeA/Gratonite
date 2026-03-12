import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { userSettings as settingsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { switchSoundPack } from '../../lib/soundEngine';
import SectionHeader from '../../components/SectionHeader';
import LoadingScreen from '../../components/LoadingScreen';
import type { UserSettings } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'SettingsSound'>;

const SOUND_PACKS = ['default', 'retro', 'minimal'] as const;

export default function SettingsSoundScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [volume, setVolume] = useState(100);
  const [soundPack, setSoundPack] = useState<string>('default');
  const [muted, setMuted] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await settingsApi.get();
      setSettings(data);
      setVolume((data as any).soundVolume ?? 100);
      setSoundPack((data as any).soundPack ?? 'default');
      setMuted((data as any).soundMuted ?? false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const save = async (updates: Record<string, unknown>) => {
    setSaving(true);
    try {
      const updated = await settingsApi.update(updates as Partial<UserSettings>);
      setSettings(updated);
      toast.success('Sound settings saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const adjustVolume = (delta: number) => {
    const next = Math.max(0, Math.min(100, volume + delta));
    setVolume(next);
    save({ soundVolume: next });
    SecureStore.setItemAsync('gratonite_sound_volume', String(next)).catch(() => {});
  };

  const selectPack = (pack: string) => {
    setSoundPack(pack);
    save({ soundPack: pack });
    switchSoundPack(pack);
  };

  const toggleMute = (value: boolean) => {
    setMuted(value);
    save({ soundMuted: value });
    SecureStore.setItemAsync('gratonite_sound_muted', String(value)).catch(() => {});
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    section: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    volumeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
      paddingVertical: spacing.md,
    },
    volumeButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.bgSecondary,
      justifyContent: 'center',
      alignItems: 'center',
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    volumeText: {
      fontSize: fontSize.xxl || 24,
      fontWeight: '700',
      color: colors.textPrimary,
      minWidth: 60,
      textAlign: 'center',
    },
    packRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    packButton: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.bgSecondary,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.transparent,
    },
    packSelected: {
      borderColor: colors.accentPrimary,
      backgroundColor: colors.accentPrimary + '20',
    },
    packLabel: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.textPrimary,
      textTransform: 'capitalize',
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    switchLabel: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    savingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    savingText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
    bottomPad: {
      height: 40,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  return (
    <PatternBackground>
    <ScrollView style={{ flex: 1 }}>
      <SectionHeader title="Volume" />
      <View style={styles.section}>
        <View style={styles.volumeRow}>
          <TouchableOpacity
            style={styles.volumeButton}
            onPress={() => adjustVolume(-10)}
            disabled={saving}
          >
            <Ionicons name="remove" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.volumeText}>{volume}%</Text>
          <TouchableOpacity
            style={styles.volumeButton}
            onPress={() => adjustVolume(10)}
            disabled={saving}
          >
            <Ionicons name="add" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <SectionHeader title="Sound Pack" />
      <View style={styles.section}>
        <View style={styles.packRow}>
          {SOUND_PACKS.map((pack) => (
            <TouchableOpacity
              key={pack}
              style={[styles.packButton, soundPack === pack && styles.packSelected]}
              onPress={() => selectPack(pack)}
              disabled={saving}
            >
              <Text style={styles.packLabel}>{pack}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <SectionHeader title="Mute" />
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Mute All Sounds</Text>
          <Switch
            value={muted}
            onValueChange={toggleMute}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
            thumbColor={colors.white}
            disabled={saving}
          />
        </View>
      </View>

      {saving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color={colors.accentPrimary} />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
    </PatternBackground>
  );
}
