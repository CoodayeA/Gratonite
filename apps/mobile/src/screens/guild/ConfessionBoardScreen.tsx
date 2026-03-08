import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { confessions as confessionsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { Confession } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ConfessionBoard'>;

export default function ConfessionBoardScreen({ route }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId } = route.params;
  const [confessionList, setConfessionList] = useState<Confession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composeVisible, setComposeVisible] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchConfessions = useCallback(async () => {
    try {
      const data = await confessionsApi.list(guildId);
      setConfessionList(data);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load confessions');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchConfessions();
  }, [fetchConfessions]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchConfessions();
  };

  const handleSubmit = async () => {
    const content = composeText.trim();
    if (!content) return;
    setSubmitting(true);
    try {
      const created = await confessionsApi.create(guildId, content);
      setConfessionList((prev) => [created, ...prev]);
      setComposeText('');
      setComposeVisible(false);
    } catch {
      toast.error('Failed to post confession');
    } finally {
      setSubmitting(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    listContent: {
      paddingVertical: spacing.sm,
    },
    card: {
      marginHorizontal: spacing.lg,
      marginVertical: spacing.sm,
      backgroundColor: colors.bgElevated,
      borderRadius: neo ? 0 : borderRadius.lg,
      padding: spacing.lg,
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    confessionNumber: {
      color: colors.accentPrimary,
      fontSize: fontSize.sm,
      fontWeight: '700',
      ...(neo ? { textTransform: 'uppercase' } : {}),
    },
    timeText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    content: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      lineHeight: 22,
    },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.xl,
      width: 56,
      height: 56,
      borderRadius: neo ? 0 : 28,
      backgroundColor: colors.accentPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      ...(neo ? { borderWidth: 3, borderColor: colors.border } : {}),
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.bgPrimary,
      borderTopLeftRadius: neo ? 0 : borderRadius.xl,
      borderTopRightRadius: neo ? 0 : borderRadius.xl,
      padding: spacing.lg,
      ...(neo ? { borderTopWidth: 3, borderColor: colors.border } : {}),
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: neo ? '700' : '600',
      ...(neo ? { textTransform: 'uppercase' } : {}),
    },
    textInput: {
      backgroundColor: colors.bgElevated,
      borderRadius: neo ? 0 : borderRadius.md,
      padding: spacing.md,
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      minHeight: 120,
      textAlignVertical: 'top',
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
    },
    submitButton: {
      marginTop: spacing.md,
      backgroundColor: colors.accentPrimary,
      paddingVertical: spacing.md,
      borderRadius: neo ? 0 : borderRadius.md,
      alignItems: 'center',
      ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}),
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: '700',
      ...(neo ? { textTransform: 'uppercase' } : {}),
    },
    anonymousNote: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderConfession = ({ item }: { item: Confession }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.confessionNumber}>#{item.number}</Text>
        <Text style={styles.timeText}>{formatRelativeTime(item.createdAt)}</Text>
      </View>
      <Text style={styles.content}>{item.content}</Text>
    </View>
  );

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <FlatList
        data={confessionList}
        keyExtractor={(item) => item.id}
        renderItem={renderConfession}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentPrimary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="chatbubble-ellipses-outline"
            title="No confessions yet"
            subtitle="Be the first to share anonymously"
          />
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setComposeVisible(true)}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      <Modal
        visible={composeVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setComposeVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setComposeVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Confession</Text>
              <TouchableOpacity onPress={() => setComposeVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Write your confession..."
              placeholderTextColor={colors.textMuted}
              value={composeText}
              onChangeText={setComposeText}
              multiline
              autoFocus
            />
            <TouchableOpacity
              style={[styles.submitButton, (!composeText.trim() || submitting) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!composeText.trim() || submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Posting...' : 'Post Anonymously'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.anonymousNote}>
              Your identity will not be revealed
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
