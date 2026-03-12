import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { onboarding as onboardingApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { OnboardingStep } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'OnboardingConfig'>;

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  welcome: 'hand-right-outline',
  rules: 'document-text-outline',
  roles: 'shield-outline',
  channels: 'chatbubbles-outline',
};

export default function OnboardingConfigScreen({ route }: Props) {
  const { guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchSteps = useCallback(async () => {
    try {
      const data = await onboardingApi.getSteps(guildId);
      setSteps(data);
    } catch (err: any) {
      // silently ignore — empty state handles no data
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchSteps();
  }, [fetchSteps]);

  const toggleRequired = (stepId: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, required: !s.required } : s))
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onboardingApi.updateSteps(guildId, steps);
      setHasChanges(false);
      toast.success('Onboarding updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    list: {
      paddingBottom: spacing.xxxl,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    stepIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepInfo: {
      flex: 1,
    },
    stepTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    stepDescription: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      marginTop: 2,
    },
    stepMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    typeBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeBadgeText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    saveBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.bgPrimary,
    },
    saveButton: {
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xxl,
      alignItems: 'center',
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
      <FlatList
        data={steps}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const icon = TYPE_ICONS[item.type] || 'list-outline';
          return (
            <View style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <Ionicons name={icon} size={18} color={colors.textSecondary} />
              </View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepTitle}>{item.title}</Text>
                {item.description && (
                  <Text style={styles.stepDescription} numberOfLines={2}>{item.description}</Text>
                )}
                <View style={styles.stepMeta}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{item.type}</Text>
                  </View>
                </View>
              </View>
              <Switch
                value={item.required}
                onValueChange={() => toggleRequired(item.id)}
                trackColor={{ false: colors.bgSecondary, true: colors.accentPrimary }}
                thumbColor={colors.white}
              />
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="school-outline"
            title="No onboarding steps"
            subtitle="Configure onboarding in portal settings"
          />
        }
      />

      {hasChanges && (
        <View style={styles.saveBar}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </PatternBackground>
  );
}
