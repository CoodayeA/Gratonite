import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { automod as automodApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { AutomodRule } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'AutomodConfig'>;

type RuleType = 'keyword' | 'spam' | 'caps' | 'links';

const RULE_TYPES: RuleType[] = ['keyword', 'spam', 'caps', 'links'];

const TYPE_CONFIG: Record<RuleType, { color: string; icon: string; label: string }> = {
  keyword: { color: '#e67e22', icon: 'text-outline', label: 'Keyword' },
  spam: { color: '#e74c3c', icon: 'flash-outline', label: 'Spam' },
  caps: { color: '#3498db', icon: 'volume-high-outline', label: 'Caps' },
  links: { color: '#9b59b6', icon: 'link-outline', label: 'Links' },
};

export default function AutomodConfigScreen({ route }: Props) {
  const { guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const toast = useToast();
  const [rules, setRules] = useState<AutomodRule[]>([]);
  const [loading, setLoading] = useState(true);

  // Add rule form
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<RuleType>('keyword');
  const [adding, setAdding] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      const data = await automodApi.listRules(guildId);
      setRules(data);
    } catch (err: any) {
      // silently ignore — empty state handles no data
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleToggle = async (rule: AutomodRule) => {
    try {
      const updated = await automodApi.updateRule(guildId, rule.id, { enabled: !rule.enabled });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
    } catch (err: any) {
      toast.error(err.message || 'Failed to update rule');
    }
  };

  const handleDelete = (rule: AutomodRule) => {
    Alert.alert(
      'Delete Rule',
      `Delete "${rule.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await automodApi.deleteRule(guildId, rule.id);
              setRules((prev) => prev.filter((r) => r.id !== rule.id));
            } catch (err: any) {
              toast.error(err.message || 'Failed to delete rule');
            }
          },
        },
      ],
    );
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error('Please enter a rule name');
      return;
    }

    setAdding(true);
    try {
      const rule = await automodApi.createRule(guildId, {
        name,
        type: newType,
        config: {},
        actions: [{ type: 'block' }],
      });
      setRules((prev) => [...prev, rule]);
      setNewName('');
      setShowForm(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create rule');
    } finally {
      setAdding(false);
    }
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
    nameInput: {
      backgroundColor: colors.inputBg,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    typePicker: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    typeOption: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeOptionActive: {
      backgroundColor: colors.bgActive,
    },
    typeOptionText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '600',
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
    ruleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    ruleInfo: {
      flex: 1,
    },
    ruleName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    typeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: borderRadius.full,
      alignSelf: 'flex-start',
      marginTop: 4,
    },
    typeBadgeText: {
      fontSize: fontSize.xs,
      fontWeight: '700',
    },
    deleteBtn: {
      padding: spacing.xs,
    },
  }), [colors, spacing, fontSize, borderRadius]);

  const renderRule = ({ item }: { item: AutomodRule }) => {
    const config = TYPE_CONFIG[item.type as RuleType] ?? TYPE_CONFIG.keyword;

    return (
      <View style={styles.ruleRow}>
        <View style={styles.ruleInfo}>
          <Text style={styles.ruleName}>{item.name}</Text>
          <View style={[styles.typeBadge, { backgroundColor: config.color + '22' }]}>
            <Ionicons name={config.icon as any} size={12} color={config.color} />
            <Text style={[styles.typeBadgeText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>
        <Switch
          value={item.enabled}
          onValueChange={() => handleToggle(item)}
          trackColor={{ false: colors.border, true: colors.accentPrimary + '88' }}
          thumbColor={item.enabled ? colors.accentPrimary : colors.textMuted}
        />
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerCount}>{rules.length} rule{rules.length !== 1 ? 's' : ''}</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
          <Ionicons name={showForm ? 'close' : 'add'} size={18} color={colors.white} />
          <Text style={styles.addBtnText}>{showForm ? 'Cancel' : 'Add Rule'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>NEW RULE</Text>
          <TextInput
            style={styles.nameInput}
            value={newName}
            onChangeText={setNewName}
            placeholder="Rule name"
            placeholderTextColor={colors.textMuted}
            maxLength={100}
          />
          <View style={styles.typePicker}>
            {RULE_TYPES.map((type) => {
              const config = TYPE_CONFIG[type];
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeOption,
                    newType === type && [styles.typeOptionActive, { borderColor: config.color }],
                  ]}
                  onPress={() => setNewType(type)}
                >
                  <Ionicons
                    name={config.icon as any}
                    size={14}
                    color={newType === type ? config.color : colors.textMuted}
                  />
                  <Text style={[styles.typeOptionText, newType === type && { color: config.color }]}>
                    {config.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[styles.submitBtn, (!newName.trim() || adding) && styles.submitBtnDisabled]}
            onPress={handleAdd}
            disabled={!newName.trim() || adding}
          >
            <Text style={[styles.submitBtnText, (!newName.trim() || adding) && styles.submitBtnTextDisabled]}>
              {adding ? 'Creating...' : 'Create Rule'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={rules}
        keyExtractor={(item) => item.id}
        renderItem={renderRule}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="hardware-chip-outline"
            title="No automod rules"
            subtitle="Create rules to automatically moderate your server"
          />
        }
      />
    </View>
  );
}
