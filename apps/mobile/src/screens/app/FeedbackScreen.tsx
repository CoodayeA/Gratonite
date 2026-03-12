import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { feedback } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import SectionHeader from '../../components/SectionHeader';
import type { FeedbackItem } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'Feedback'>;

const TYPES = ['bug', 'feature', 'general'] as const;
type FeedbackType = (typeof TYPES)[number];

const TYPE_ICONS: Record<FeedbackType, keyof typeof Ionicons.glyphMap> = {
  bug: 'bug-outline',
  feature: 'bulb-outline',
  general: 'chatbox-outline',
};

const TYPE_COLORS: Record<FeedbackType, string> = {
  bug: '#ef4444',
  feature: '#8b5cf6',
  general: '#3b82f6',
};

export default function FeedbackScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();

  const [type, setType] = useState<FeedbackType>('general');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const fetchMine = useCallback(async () => {
    try {
      const data = await feedback.mine();
      setItems(data);
    } catch {
      // silent
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error('Please enter your feedback');
      return;
    }
    setSubmitting(true);
    try {
      const item = await feedback.submit({ type, content: trimmed });
      setItems((prev) => [item, ...prev]);
      setContent('');
      toast.success('Feedback submitted, thank you!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    formSection: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    typeRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    typeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.bgSecondary,
      borderWidth: 2,
      borderColor: colors.transparent,
    },
    typeSelected: {
      borderColor: colors.accentPrimary,
    },
    typeLabel: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.textPrimary,
      textTransform: 'capitalize',
    },
    input: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: colors.textPrimary,
      minHeight: 100,
      textAlignVertical: 'top',
      marginBottom: spacing.md,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    submitButton: {
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border, shadowColor: neo.shadowColor, shadowOffset: neo.shadowOffset, shadowOpacity: neo.shadowOpacity, shadowRadius: neo.shadowRadius } : {}),
    },
    submitDisabled: {
      opacity: 0.6,
    },
    submitText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    listSection: {
      flex: 1,
    },
    feedbackItem: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    typeBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
      alignSelf: 'flex-start',
    },
    typeBadgeText: {
      fontSize: fontSize.xs,
      fontWeight: '700',
      color: colors.white,
      textTransform: 'uppercase',
    },
    itemContent: {
      flex: 1,
    },
    itemText: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      lineHeight: 20,
    },
    itemDate: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: spacing.xs,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      paddingVertical: spacing.xl,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderItem = ({ item }: { item: FeedbackItem }) => {
    const badgeColor = TYPE_COLORS[item.type] || colors.textMuted;
    return (
      <View style={styles.feedbackItem}>
        <View style={[styles.typeBadge, { backgroundColor: badgeColor }]}>
          <Text style={styles.typeBadgeText}>{item.type}</Text>
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemText} numberOfLines={3}>{item.content}</Text>
          <Text style={styles.itemDate}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <PatternBackground>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            <SectionHeader title="Submit Feedback" />
            <View style={styles.formSection}>
              <View style={styles.typeRow}>
                {TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeButton, type === t && styles.typeSelected]}
                    onPress={() => setType(t)}
                  >
                    <Ionicons name={TYPE_ICONS[t]} size={16} color={TYPE_COLORS[t]} />
                    <Text style={styles.typeLabel}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.input}
                value={content}
                onChangeText={setContent}
                placeholder="Describe your feedback..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                maxLength={2000}
              />
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.submitText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>

            <SectionHeader title="Your Submissions" />
          </>
        }
        ListEmptyComponent={
          loadingItems ? (
            <ActivityIndicator size="small" color={colors.accentPrimary} style={{ padding: spacing.xl }} />
          ) : (
            <Text style={styles.emptyText}>No submissions yet</Text>
          )
        }
      />
    </KeyboardAvoidingView>
    </PatternBackground>
  );
}
