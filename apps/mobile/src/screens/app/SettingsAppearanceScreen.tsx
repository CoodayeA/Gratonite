import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ActivityIndicator,
  Appearance,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { userSettings as settingsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { themeStore } from '../../lib/themeStore';
import { themes } from '../../lib/themes';
import type { ThemeName } from '../../lib/themes';
import SectionHeader from '../../components/SectionHeader';
import LoadingScreen from '../../components/LoadingScreen';
import type { UserSettings } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'SettingsAppearance'>;

// API expects fontSize as an integer (10–24); map labels to numeric values
const FONT_SIZE_OPTIONS: { value: number; label: string }[] = [
  { value: 12, label: 'Small' },
  { value: 14, label: 'Medium' },
  { value: 18, label: 'Large' },
];

const THEME_OPTIONS: { name: ThemeName; label: string; icon: string }[] = [
  { name: 'neobrutalism', label: 'Neo Light', icon: 'flash' },
  { name: 'neobrutalism-dark', label: 'Neo Dark', icon: 'flash' },
  { name: 'glassmorphism', label: 'Glass Light', icon: 'water' },
  { name: 'glassmorphism-dark', label: 'Glass Dark', icon: 'water' },
  { name: 'light', label: 'Classic Light', icon: 'sunny' },
  { name: 'dark', label: 'Classic Dark', icon: 'moon' },
];

export default function SettingsAppearanceScreen({ navigation }: Props) {
  const { name: currentTheme, colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoMode, setAutoMode] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('gratonite_auto_theme').then(v => setAutoMode(v === 'true'));
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await settingsApi.get();
      setSettings(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (updates: Partial<UserSettings>) => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await settingsApi.update(updates);
      setSettings(updated);
      // Apply font size change app-wide immediately
      if (updates.fontSize !== undefined) {
        themeStore.setFontSize(updates.fontSize);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const selectTheme = async (name: ThemeName) => {
    themeStore.setTheme(name);
    try {
      await SecureStore.setItemAsync('gratonite_theme', name);
    } catch {
      // ignore persist failure
    }
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
    themeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    themeCard: {
      width: '47%',
      borderRadius: neo ? 0 : borderRadius.lg,
      backgroundColor: colors.bgSecondary,
      padding: spacing.md,
      borderWidth: 2,
      borderColor: colors.transparent,
    },
    themeCardSelected: {
      borderColor: colors.accentPrimary,
      shadowColor: colors.accentPrimary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 6,
    },
    themePreview: {
      height: 70,
      borderRadius: borderRadius.sm,
      marginBottom: spacing.sm,
      padding: spacing.sm,
      flexDirection: 'row',
      gap: spacing.xs,
      overflow: 'hidden',
    },
    previewSwatch: {
      flex: 1,
      borderRadius: borderRadius.sm,
    },
    themeIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    themeCardLabel: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: neo ? '800' : '600',
      textAlign: 'center',
      ...(neo ? { textTransform: 'uppercase' as const, letterSpacing: 0.5 } : {}),
    },
    checkmark: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.sm,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    switchInfo: {
      flex: 1,
      marginRight: spacing.lg,
    },
    switchLabel: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    switchDescription: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: 2,
    },
    fontSizeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
    },
    fontSizeLabel: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.textMuted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioSelected: {
      borderColor: colors.accentPrimary,
    },
    radioInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.accentPrimary,
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
  }), [colors, spacing, fontSize, borderRadius]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <PatternBackground>
    <ScrollView style={{ flex: 1 }}>
      <SectionHeader title="Auto (Follow System)" />
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Follow System Theme</Text>
            <Text style={styles.switchDescription}>
              Automatically switch between light and dark based on your device settings
            </Text>
          </View>
          <Switch
            value={autoMode}
            onValueChange={(value) => {
              setAutoMode(value);
              themeStore.setAutoMode(value);
              if (value) {
                const colorScheme = Appearance.getColorScheme();
                // Auto-switch within the same theme family
                const current = themeStore.getThemeName();
                let target: ThemeName;
                if (current.startsWith('neobrutalism')) {
                  target = colorScheme === 'dark' ? 'neobrutalism-dark' : 'neobrutalism';
                } else if (current.startsWith('glassmorphism')) {
                  target = colorScheme === 'dark' ? 'glassmorphism-dark' : 'glassmorphism';
                } else {
                  target = colorScheme === 'dark' ? 'dark' : 'light';
                }
                themeStore.setTheme(target);
              }
            }}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      <SectionHeader title="Theme" />
      <View style={styles.section}>
        <View style={styles.themeGrid}>
          {THEME_OPTIONS.map((opt) => {
            const t = themes[opt.name];
            const isSelected = currentTheme === opt.name;
            const isNeo = opt.name.startsWith('neobrutalism');
            const isGlass = opt.name.startsWith('glassmorphism');
            return (
              <TouchableOpacity
                key={opt.name}
                style={[styles.themeCard, isSelected && styles.themeCardSelected]}
                onPress={() => selectTheme(opt.name)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.themePreview,
                  { backgroundColor: t.colors.bgPrimary },
                  isNeo && { borderWidth: 3, borderColor: '#000', borderRadius: 0 },
                  isGlass && { borderWidth: 1, borderColor: t.colors.border, borderRadius: 14 },
                ]}>
                  <View style={[styles.previewSwatch, { backgroundColor: t.colors.bgSecondary }, isNeo && { borderRadius: 0 }, isGlass && { borderRadius: 8 }]} />
                  <View style={[styles.previewSwatch, { backgroundColor: t.colors.accentPrimary }, isNeo && { borderRadius: 0 }, isGlass && { borderRadius: 8 }]} />
                  <View style={[styles.previewSwatch, { backgroundColor: t.colors.bgElevated }, isNeo && { borderRadius: 0 }, isGlass && { borderRadius: 8 }]} />
                </View>
                <View style={styles.themeIconRow}>
                  <Ionicons name={opt.icon as any} size={14} color={isSelected ? colors.accentPrimary : colors.textMuted} />
                  <Text style={styles.themeCardLabel}>{opt.label}</Text>
                </View>
                {isSelected && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark-circle" size={22} color={colors.accentPrimary} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Compact Mode */}
      <SectionHeader title="Display" />
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Compact Mode</Text>
            <Text style={styles.switchDescription}>
              Reduce spacing between messages for a denser layout
            </Text>
          </View>
          <Switch
            value={settings?.compactMode ?? false}
            onValueChange={(value) => updateSetting({ compactMode: value })}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
            thumbColor={colors.white}
            disabled={saving}
          />
        </View>
      </View>

      {/* Font Size */}
      <SectionHeader title="Font Size" />
      <View style={styles.section}>
        {FONT_SIZE_OPTIONS.map((option) => {
          const isSelected = (settings?.fontSize ?? 14) === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={styles.fontSizeRow}
              onPress={() => updateSetting({ fontSize: option.value })}
              disabled={saving}
              activeOpacity={0.6}
            >
              <Text style={styles.fontSizeLabel}>{option.label}</Text>
              <View style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          );
        })}
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
