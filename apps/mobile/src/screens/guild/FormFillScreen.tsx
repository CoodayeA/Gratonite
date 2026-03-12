import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Switch } from 'react-native';
import { guildForms } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import { mediumImpact } from '../../lib/haptics';
import LoadingScreen from '../../components/LoadingScreen';
import type { FormTemplate } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'FormFill'>;

export default function FormFillScreen({ route, navigation }: Props) {
  const { guildId, formId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [form, setForm] = useState<FormTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);

  const fetchForm = useCallback(async () => {
    try {
      const data = await guildForms.get(guildId, formId);
      setForm(data);
    } catch {
      toast.error('Failed to load form');
    } finally {
      setLoading(false);
    }
  }, [guildId, formId]);

  useEffect(() => { fetchForm(); }, [fetchForm]);

  const handleSubmit = async () => {
    if (!form) return;
    const missing = form.fields.filter(f => f.required && !answers[f.name]);
    if (missing.length) {
      toast.error(`Please fill required field: ${missing[0].name}`);
      return;
    }
    setSubmitting(true);
    mediumImpact();
    try {
      await guildForms.submit(guildId, formId, answers);
      toast.success('Form submitted!');
      navigation.goBack();
    } catch {
      toast.error('Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    scroll: { padding: spacing.xl },
    title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
    desc: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xl },
    fieldContainer: { marginBottom: spacing.xl },
    fieldLabel: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
    required: { color: colors.error },
    input: { backgroundColor: colors.bgElevated, borderRadius: neo ? 0 : borderRadius.md, padding: spacing.md, color: colors.textPrimary, fontSize: fontSize.md, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    textArea: { minHeight: 100, textAlignVertical: 'top' },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    submitBtn: { backgroundColor: colors.accentPrimary, borderRadius: neo ? 0 : borderRadius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xxxl, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    submitText: { color: colors.white, fontWeight: '700', fontSize: fontSize.md },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading || !form) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>{form.title}</Text>
        {form.description && <Text style={styles.desc}>{form.description}</Text>}

        {form.fields.map((field, i) => (
          <View key={i} style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>
              {field.name} {field.required && <Text style={styles.required}>*</Text>}
            </Text>
            {field.type === 'boolean' ? (
              <View style={styles.switchRow}>
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm }}>{answers[field.name] ? 'Yes' : 'No'}</Text>
                <Switch
                  value={!!answers[field.name]}
                  onValueChange={(v) => setAnswers(prev => ({ ...prev, [field.name]: v }))}
                  trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
                />
              </View>
            ) : (
              <TextInput
                style={[styles.input, field.type === 'textarea' && styles.textArea]}
                placeholder={`Enter ${field.name.toLowerCase()}...`}
                placeholderTextColor={colors.textMuted}
                value={String(answers[field.name] ?? '')}
                onChangeText={(v) => setAnswers(prev => ({ ...prev, [field.name]: v }))}
                multiline={field.type === 'textarea'}
              />
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}