import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { userSettings as settingsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import SectionHeader from '../../components/SectionHeader';
import LoadingScreen from '../../components/LoadingScreen';
import type { UserSettings } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'SettingsPrivacy'>;

interface PickerOption {
  value: string;
  label: string;
  description: string;
}

const DM_OPTIONS: PickerOption[] = [
  { value: 'everyone', label: 'Everyone', description: 'Anyone can send you direct messages' },
  { value: 'friends', label: 'Friends Only', description: 'Only friends can DM you' },
  { value: 'none', label: 'No One', description: 'Block all direct messages' },
];

const FRIEND_REQUEST_OPTIONS: PickerOption[] = [
  { value: 'everyone', label: 'Everyone', description: 'Anyone can send you a friend request' },
  { value: 'mutual', label: 'Mutual Servers', description: 'Only people in shared servers' },
  { value: 'none', label: 'No One', description: 'Block all friend requests' },
];

export default function SettingsPrivacyScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
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
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
    },
    optionInfo: {
      flex: 1,
      marginRight: spacing.lg,
    },
    optionLabel: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    optionDescription: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: 2,
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
    divider: {
      height: 1,
      backgroundColor: colors.border,
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

  if (loading) {
    return <LoadingScreen />;
  }

  const renderPicker = (
    title: string,
    options: PickerOption[],
    currentValue: string,
    onSelect: (value: string) => void,
  ) => (
    <>
      <SectionHeader title={title} />
      <View style={styles.section}>
        {options.map((option, index) => {
          const isSelected = currentValue === option.value;
          return (
            <React.Fragment key={option.value}>
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => onSelect(option.value)}
                disabled={saving}
                activeOpacity={0.6}
              >
                <View style={styles.optionInfo}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
              {index < options.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          );
        })}
      </View>
    </>
  );

  return (
    <ScrollView style={styles.container}>
      {renderPicker(
        'Direct Messages',
        DM_OPTIONS,
        settings?.dmPrivacy ?? 'everyone',
        (value) => updateSetting({ dmPrivacy: value }),
      )}

      {renderPicker(
        'Friend Requests',
        FRIEND_REQUEST_OPTIONS,
        settings?.friendRequestPrivacy ?? 'everyone',
        (value) => updateSetting({ friendRequestPrivacy: value }),
      )}

      {saving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color={colors.accentPrimary} />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}
