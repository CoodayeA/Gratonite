import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { guildForms } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import { mediumImpact } from '../../lib/haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'FormCreate'>;

interface FormField {
  name: string;
  type: string;
  required: boolean;
}

const FIELD_TYPES = ['text', 'textarea', 'boolean'];

export default function FormCreateScreen({ route, navigation }: Props) {
  const { guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FormField[]>([{ name: '', type: 'text', required: false }]);
  const [creating, setCreating] = useState(false);

  const addField = () => {
    setFields([...fields, { name: '', type: 'text', required: false }]);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    setFields(fields.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  const handleCreate = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    const validFields = fields.filter(f => f.name.trim());
    if (!validFields.length) { toast.error('Add at least one field'); return; }
    setCreating(true);
    mediumImpact();
    try {
      await guildForms.create(guildId, {
        title: title.trim(),
        description: description.trim() || undefined,
        fields: validFields.map(f => ({ name: f.name.trim(), type: f.type, required: f.required })),
      });
      toast.success('Form created!');
      navigation.goBack();
    } catch {
      toast.error('Failed to create form');
    } finally {
      setCreating(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    scroll: { padding: spacing.xl },
    label: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.lg, textTransform: 'uppercase' },
    input: { backgroundColor: colors.bgElevated, borderRadius: neo ? 0 : borderRadius.md, padding: spacing.md, color: colors.textPrimary, fontSize: fontSize.md, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    fieldCard: { backgroundColor: colors.bgElevated, borderRadius: neo ? 0 : borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    fieldNum: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary },
    fieldInput: { backgroundColor: colors.bgPrimary, borderRadius: neo ? 0 : borderRadius.md, padding: spacing.md, color: colors.textPrimary, fontSize: fontSize.sm, marginBottom: spacing.sm, ...(neo ? { borderWidth: 1, borderColor: colors.border } : {}) },
    typeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    typeBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: neo ? 0 : borderRadius.full, backgroundColor: colors.bgPrimary },
    typeBtnActive: { backgroundColor: colors.accentPrimary },
    typeText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary },
    typeTextActive: { color: colors.white },
    requiredRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    requiredText: { fontSize: fontSize.sm, color: colors.textSecondary },
    addFieldBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: neo ? 0 : borderRadius.lg, borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', marginBottom: spacing.lg },
    addFieldText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
    createBtn: { backgroundColor: colors.accentPrimary, borderRadius: neo ? 0 : borderRadius.md, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.xxxl, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    createBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSize.md },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <PatternBackground>
      <ScrollView style={styles.scroll}>
        <Text style={[styles.label, { marginTop: 0 }]}>Form Title</Text>
        <TextInput style={styles.input} placeholder="e.g. Portal Application" placeholderTextColor={colors.textMuted} value={title} onChangeText={setTitle} />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput style={styles.input} placeholder="What is this form for?" placeholderTextColor={colors.textMuted} value={description} onChangeText={setDescription} multiline />

        <Text style={styles.label}>Fields</Text>
        {fields.map((field, i) => (
          <View key={i} style={styles.fieldCard}>
            <View style={styles.fieldHeader}>
              <Text style={styles.fieldNum}>Field {i + 1}</Text>
              {fields.length > 1 && (
                <TouchableOpacity onPress={() => removeField(i)} accessibilityLabel="Remove field">
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </TouchableOpacity>
              )}
            </View>
            <TextInput style={styles.fieldInput} placeholder="Field name" placeholderTextColor={colors.textMuted} value={field.name} onChangeText={(v) => updateField(i, { name: v })} />
            <View style={styles.typeRow}>
              {FIELD_TYPES.map(t => (
                <TouchableOpacity key={t} style={[styles.typeBtn, field.type === t && styles.typeBtnActive]} onPress={() => updateField(i, { type: t })}>
                  <Text style={[styles.typeText, field.type === t && styles.typeTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.requiredRow}>
              <Text style={styles.requiredText}>Required</Text>
              <TouchableOpacity onPress={() => updateField(i, { required: !field.required })} accessibilityLabel="Toggle field required">
                <Ionicons name={field.required ? 'checkbox' : 'square-outline'} size={22} color={field.required ? colors.accentPrimary : colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addFieldBtn} onPress={addField}>
          <Ionicons name="add" size={20} color={colors.textSecondary} />
          <Text style={styles.addFieldText}>Add Field</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={creating}>
          <Text style={styles.createBtnText}>{creating ? 'Creating...' : 'Create Form'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </PatternBackground>
  );
}
