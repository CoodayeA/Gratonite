import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { guildForms } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { FormTemplate } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'GuildForms'>;

export default function GuildFormsScreen({ route, navigation }: Props) {
  const { guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchForms = useCallback(async () => {
    try {
      const data = await guildForms.list(guildId);
      setForms(data);
    } catch {
      toast.error('Failed to load forms');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId]);

  useEffect(() => { fetchForms(); }, [fetchForms]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    card: { marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.bgElevated, borderRadius: neo ? 0 : borderRadius.lg, padding: spacing.lg, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
    cardDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
    cardMeta: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.sm },
    btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    actionBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: neo ? 0 : borderRadius.md, alignItems: 'center', backgroundColor: colors.accentPrimary + '15' },
    actionBtnText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.accentPrimary },
    fab: { position: 'absolute', bottom: spacing.xxxl, right: spacing.xl, width: 56, height: 56, borderRadius: neo ? 0 : 28, backgroundColor: colors.accentPrimary, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  return (
    <PatternBackground>
      <FlatList
        data={forms}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
            <Text style={styles.cardMeta}>{item.fields.length} fields · Created {new Date(item.createdAt).toLocaleDateString()}</Text>
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('FormFill', { guildId, formId: item.id })}>
                <Text style={styles.actionBtnText}>Fill Out</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('FormResponses', { guildId, formId: item.id })}>
                <Text style={styles.actionBtnText}>Responses</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="document-text-outline" title="No forms" subtitle="Create a form to collect responses" />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchForms(); }} tintColor={colors.accentPrimary} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('FormCreate', { guildId })} accessibilityLabel="Create form">
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </PatternBackground>
  );
}