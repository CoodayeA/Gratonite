import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SectionList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { interestTags } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import { selectionFeedback, mediumImpact } from '../../lib/haptics';
import LoadingScreen from '../../components/LoadingScreen';
import type { InterestTag } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'InterestTags'>;

export default function InterestTagsScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [allTags, setAllTags] = useState<InterestTag[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [tags, myInterests] = await Promise.all([
        interestTags.listAll(),
        interestTags.getMyInterests(),
      ]);
      setAllTags(tags);
      // Backend returns string[] (tag names), match by name against allTags
      const myTagIds = tags
        .filter(t => myInterests.includes(t.name))
        .map(t => t.id);
      setSelectedIds(new Set(myTagIds));
    } catch {
      toast.error('Failed to load interests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleTag = (tagId: string) => {
    selectionFeedback();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId); else next.add(tagId);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    mediumImpact();
    try {
      // API expects tag names, not IDs
      const selectedNames = allTags
        .filter(t => selectedIds.has(t.id))
        .map(t => t.name);
      await interestTags.setMyInterests(selectedNames);
      toast.success('Interests saved!');
      navigation.goBack();
    } catch {
      toast.error('Failed to save interests');
    } finally {
      setSaving(false);
    }
  };

  const categories = useMemo(() => {
    const map = new Map<string, InterestTag[]>();
    allTags.forEach(tag => {
      const list = map.get(tag.category) || [];
      list.push(tag);
      map.set(tag.category, list);
    });
    return Array.from(map.entries()).map(([cat, tags]) => ({ title: cat, data: [tags] }));
  }, [allTags]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    header: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerText: { fontSize: fontSize.sm, color: colors.textSecondary },
    selectedCount: { fontSize: fontSize.md, fontWeight: '700', color: colors.accentPrimary, marginTop: spacing.xs },
    sectionHeader: { backgroundColor: colors.bgPrimary, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
    sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
    chipContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
    chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: neo ? 0 : borderRadius.full, backgroundColor: colors.bgElevated, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    chipSelected: { backgroundColor: colors.accentPrimary + '20', borderColor: colors.accentPrimary, borderWidth: 2 },
    chipEmoji: { fontSize: 16 },
    chipText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
    chipTextSelected: { color: colors.accentPrimary },
    footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: spacing.xxxl },
    saveBtn: { backgroundColor: colors.accentPrimary, borderRadius: neo ? 0 : borderRadius.md, padding: spacing.lg, alignItems: 'center', ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    saveBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSize.md },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  return (
    <PatternBackground>
      <View style={styles.header}>
        <Text style={styles.headerText}>Select topics you're interested in</Text>
        <Text style={styles.selectedCount}>{selectedIds.size} selected</Text>
      </View>

      <SectionList
        sections={categories}
        keyExtractor={(_, index) => String(index)}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        renderItem={({ item: tags }) => (
          <View style={styles.chipContainer}>
            {tags.map(tag => (
              <TouchableOpacity
                key={tag.id}
                style={[styles.chip, selectedIds.has(tag.id) && styles.chipSelected]}
                onPress={() => toggleTag(tag.id)}
              >
                <Text style={styles.chipEmoji}>{tag.emoji}</Text>
                <Text style={[styles.chipText, selectedIds.has(tag.id) && styles.chipTextSelected]}>{tag.name}</Text>
                {selectedIds.has(tag.id) && <Ionicons name="checkmark" size={14} color={colors.accentPrimary} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      />

      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Interests'}</Text>
        </TouchableOpacity>
      </View>
    </PatternBackground>
  );
}
