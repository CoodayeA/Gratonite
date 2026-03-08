import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { templates as templatesApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { ServerTemplate } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ServerTemplates'>;

export default function ServerTemplatesScreen({ route }: Props) {
  const { guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const toast = useToast();
  const [templateList, setTemplateList] = useState<ServerTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await templatesApi.list(guildId);
      setTemplateList(data);
    } catch (err: any) {
      // silently ignore — empty state handles no data
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error('Please enter a template name');
      return;
    }

    setCreating(true);
    try {
      const template = await templatesApi.create(guildId, {
        name,
        description: newDescription.trim() || undefined,
      });
      setTemplateList((prev) => [...prev, template]);
      setNewName('');
      setNewDescription('');
      setShowForm(false);
      toast.success('Template created');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create template');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    toast.success('Template code copied');
  };

  const handleDelete = (template: ServerTemplate) => {
    Alert.alert(
      'Delete Template',
      `Delete "${template.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await templatesApi.delete(guildId, template.id);
              setTemplateList((prev) => prev.filter((t) => t.id !== template.id));
            } catch (err: any) {
              toast.error(err.message || 'Failed to delete template');
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerCount: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.md,
    },
    addBtnText: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    formSection: {
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    sectionTitle: {
      fontSize: fontSize.xs,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
    },
    input: {
      backgroundColor: colors.inputBg,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.md,
    },
    submitBtnDisabled: {
      backgroundColor: colors.bgElevated,
    },
    submitBtnText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    submitBtnTextDisabled: {
      color: colors.textMuted,
    },
    listContent: {
      paddingBottom: spacing.xxxl,
    },
    templateRow: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    templateHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    templateInfo: {
      flex: 1,
    },
    templateName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    templateDescription: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: 2,
    },
    usageCount: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 4,
    },
    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
      gap: spacing.sm,
    },
    codeText: {
      flex: 1,
      color: colors.accentPrimary,
      fontSize: fontSize.sm,
      fontFamily: 'Courier',
    },
    copyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.sm,
    },
    copyBtnText: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
    },
    deleteBtn: {
      padding: spacing.xs,
    },
  }), [colors, spacing, fontSize, borderRadius]);

  const renderTemplate = ({ item }: { item: ServerTemplate }) => (
    <View style={styles.templateRow}>
      <View style={styles.templateHeader}>
        <Ionicons name="copy-outline" size={22} color={colors.textSecondary} />
        <View style={styles.templateInfo}>
          <Text style={styles.templateName}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.templateDescription} numberOfLines={2}>{item.description}</Text>
          ) : null}
          <Text style={styles.usageCount}>
            Used {item.usageCount} time{item.usageCount !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>
      <View style={styles.codeRow}>
        <Text style={styles.codeText} numberOfLines={1}>{item.code}</Text>
        <TouchableOpacity style={styles.copyBtn} onPress={() => handleCopyCode(item.code)}>
          <Ionicons name="clipboard-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.copyBtnText}>Copy</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerCount}>
          {templateList.length} template{templateList.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
          <Ionicons name={showForm ? 'close' : 'add'} size={18} color={colors.white} />
          <Text style={styles.addBtnText}>{showForm ? 'Cancel' : 'Create'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>NEW TEMPLATE</Text>
          <TextInput
            style={styles.input}
            value={newName}
            onChangeText={setNewName}
            placeholder="Template name"
            placeholderTextColor={colors.textMuted}
            maxLength={100}
          />
          <TextInput
            style={styles.input}
            value={newDescription}
            onChangeText={setNewDescription}
            placeholder="Description (optional)"
            placeholderTextColor={colors.textMuted}
            maxLength={300}
            multiline
          />
          <TouchableOpacity
            style={[styles.submitBtn, (!newName.trim() || creating) && styles.submitBtnDisabled]}
            onPress={handleCreate}
            disabled={!newName.trim() || creating}
          >
            <Text style={[styles.submitBtnText, (!newName.trim() || creating) && styles.submitBtnTextDisabled]}>
              {creating ? 'Creating...' : 'Create Template'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={templateList}
        keyExtractor={(item) => item.id}
        renderItem={renderTemplate}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="copy-outline"
            title="No templates"
            subtitle="Create a template to share your server structure"
          />
        }
      />
    </View>
  );
}
