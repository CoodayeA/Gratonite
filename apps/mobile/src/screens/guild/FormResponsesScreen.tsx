import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { guildForms } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import { mediumImpact } from '../../lib/haptics';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { FormResponse } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'FormResponses'>;

export default function FormResponsesScreen({ route }: Props) {
  const { guildId, formId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchResponses = useCallback(async () => {
    try {
      const data = await guildForms.getResponses(guildId, formId);
      setResponses(data);
    } catch {
      toast.error('Failed to load responses');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId, formId]);

  useEffect(() => { fetchResponses(); }, [fetchResponses]);

  const handleReview = async (responseId: string, status: 'approved' | 'rejected') => {
    mediumImpact();
    try {
      await guildForms.reviewResponse(guildId, formId, responseId, { status });
      toast.success(`Response ${status}`);
      fetchResponses();
    } catch {
      toast.error('Failed to review');
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    card: { marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.bgElevated, borderRadius: neo ? 0 : borderRadius.lg, padding: spacing.lg, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    username: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
    date: { fontSize: fontSize.xs, color: colors.textMuted },
    answerRow: { marginBottom: spacing.sm },
    answerLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
    answerValue: { fontSize: fontSize.sm, color: colors.textPrimary },
    btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
    approveBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: neo ? 0 : borderRadius.md, alignItems: 'center', backgroundColor: colors.success + '20' },
    rejectBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: neo ? 0 : borderRadius.md, alignItems: 'center', backgroundColor: colors.error + '20' },
    approveBtnText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.success },
    rejectBtnText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.error },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  return (
    <PatternBackground>
      <FlatList
        data={responses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.username}>{item.username || 'User'}</Text>
              <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            {Object.entries(item.answers ?? {}).map(([key, val]) => (
              <View key={key} style={styles.answerRow}>
                <Text style={styles.answerLabel}>{key}</Text>
                <Text style={styles.answerValue}>{String(val)}</Text>
              </View>
            ))}
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.approveBtn} onPress={() => handleReview(item.id, 'approved')}>
                <Text style={styles.approveBtnText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReview(item.id, 'rejected')}>
                <Text style={styles.rejectBtnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="document-text-outline" title="No responses" subtitle="Responses will appear here" />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchResponses(); }} tintColor={colors.accentPrimary} />}
      />
    </PatternBackground>
  );
}