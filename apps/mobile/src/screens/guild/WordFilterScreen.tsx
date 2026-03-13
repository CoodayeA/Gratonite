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
import { wordFilter as wordFilterApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { WordFilter } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'WordFilterScreen'>;

type FilterAction = 'block' | 'delete' | 'warn';

const ACTIONS: FilterAction[] = ['block', 'delete', 'warn'];

function maskWord(word: string): string {
  if (word.length <= 2) return word;
  return word[0] + '*'.repeat(word.length - 2) + word[word.length - 1];
}

export default function WordFilterScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();

  const ACTION_CONFIG: Record<FilterAction, { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
    block: { color: colors.error, icon: 'ban-outline', label: 'Block' },
    delete: { color: colors.warning, icon: 'trash-outline', label: 'Delete' },
    warn: { color: colors.info, icon: 'warning-outline', label: 'Warn' },
  };

  const { guildId } = route.params;
  const [filters, setFilters] = useState<WordFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Add word form
  const [newWord, setNewWord] = useState('');
  const [selectedAction, setSelectedAction] = useState<FilterAction>('block');
  const [adding, setAdding] = useState(false);

  const fetchFilters = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await wordFilterApi.list(guildId);
      setFilters(data);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err.message || 'Failed to load word filters';
        setLoadError(message);
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, [guildId, toast]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  const handleAdd = async () => {
    const word = newWord.trim();
    if (!word) {
      toast.error('Please enter a word to filter');
      return;
    }

    setAdding(true);
    try {
      const filter = await wordFilterApi.add(guildId, word, selectedAction);
      setFilters((prev) => [...prev, filter]);
      setNewWord('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add word filter');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = (filter: WordFilter) => {
    Alert.alert(
      'Remove Filter',
      `Remove the filter for "${maskWord(filter.word)}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await wordFilterApi.remove(guildId, filter.id);
              setFilters((prev) => prev.filter((f) => f.id !== filter.id));
            } catch (err: any) {
              toast.error(err.message || 'Failed to remove filter');
            }
          },
        },
      ],
    );
  };

  const renderFilter = ({ item }: { item: WordFilter }) => {
    const config = ACTION_CONFIG[item.action];

    return (
      <View style={styles.filterRow}>
        <View style={styles.filterInfo}>
          <Text style={styles.filterWord}>{maskWord(item.word)}</Text>
        </View>
        <View style={[styles.actionBadge, { backgroundColor: `${config.color}22` }]}>
          <Ionicons name={config.icon} size={12} color={config.color} />
          <Text style={[styles.actionBadgeText, { color: config.color }]}>
            {config.label}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
          accessibilityLabel="Delete filter"
        >
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    addSection: {
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionTitle: {
      fontSize: fontSize.xs,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: spacing.md,
    },
    addForm: {
      gap: spacing.md,
    },
    wordInput: {
      backgroundColor: colors.inputBg,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    actionPicker: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    actionOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionOptionActive: {
      backgroundColor: colors.bgActive,
    },
    actionOptionText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.md,
    },
    addButtonDisabled: {
      backgroundColor: colors.bgElevated,
    },
    addButtonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    addButtonTextDisabled: {
      color: colors.textMuted,
    },
    listSection: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
    },
    listContent: {
      paddingBottom: spacing.xxxl,
    },
    filterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    filterInfo: {
      flex: 1,
    },
    filterWord: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
      fontFamily: 'Courier',
    },
    actionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: borderRadius.full,
    },
    actionBadgeText: {
      fontSize: fontSize.xs,
      fontWeight: '700',
    },
    deleteBtn: {
      padding: spacing.xs,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  if (loadError && filters.length === 0) {
    return (
      <PatternBackground>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl, gap: spacing.md }]}>
          <Ionicons name="alert-circle-outline" size={56} color={colors.accentPrimary} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontSize: fontSize.xl, textAlign: 'center', marginBottom: 0 }]}>Failed to load word filters</Text>
          <Text style={[styles.actionOptionText, { textAlign: 'center', color: colors.textMuted }]}>{loadError}</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => {
            setLoading(true);
            fetchFilters();
          }}>
            <Ionicons name="refresh" size={18} color={colors.white} />
            <Text style={styles.addButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </PatternBackground>
    );
  }

  return (
    <PatternBackground>
      {/* Add word section */}
      <View style={styles.addSection}>
        <Text style={styles.sectionTitle}>ADD WORD</Text>
        <View style={styles.addForm}>
          <TextInput
            style={styles.wordInput}
            value={newWord}
            onChangeText={setNewWord}
            placeholder="Enter word to filter"
            placeholderTextColor={colors.textMuted}
            maxLength={100}
            autoCapitalize="none"
          />

          <View style={styles.actionPicker}>
            {ACTIONS.map((action) => {
              const config = ACTION_CONFIG[action];
              return (
                <TouchableOpacity
                  key={action}
                  style={[
                    styles.actionOption,
                    selectedAction === action && [styles.actionOptionActive, { borderColor: config.color }],
                  ]}
                  onPress={() => setSelectedAction(action)}
                >
                  <Ionicons name={config.icon} size={14} color={selectedAction === action ? config.color : colors.textMuted} />
                  <Text
                    style={[
                      styles.actionOptionText,
                      selectedAction === action && { color: config.color },
                    ]}
                  >
                    {config.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.addButton, (!newWord.trim() || adding) && styles.addButtonDisabled]}
            onPress={handleAdd}
            disabled={!newWord.trim() || adding}
          >
            <Ionicons
              name="add"
              size={20}
              color={newWord.trim() && !adding ? colors.white : colors.textMuted}
            />
            <Text
              style={[styles.addButtonText, (!newWord.trim() || adding) && styles.addButtonTextDisabled]}
            >
              {adding ? 'Adding...' : 'Add Filter'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter list */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>
          FILTERED WORDS ({filters.length})
        </Text>
      </View>

      <FlatList
        data={filters}
        keyExtractor={(item) => item.id}
        renderItem={renderFilter}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="funnel-outline"
            title="No word filters"
            subtitle="Add words to automatically filter them from messages"
          />
        }
      />
    </PatternBackground>
  );
}
