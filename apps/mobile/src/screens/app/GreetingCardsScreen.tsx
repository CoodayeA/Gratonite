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
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { greetingCards as cardsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { GreetingCard, GreetingCardTemplate } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'GreetingCards'>;

type Tab = 'received' | 'sent';

export default function GreetingCardsScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('received');
  const [received, setReceived] = useState<GreetingCard[]>([]);
  const [sent, setSent] = useState<GreetingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composeVisible, setComposeVisible] = useState(false);
  const [templates, setTemplates] = useState<GreetingCardTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [recipientId, setRecipientId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const fetchCards = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([cardsApi.getReceived(), cardsApi.getSent()]);
      setReceived(r);
      setSent(s);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load greeting cards');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const openCompose = async () => {
    try {
      const t = await cardsApi.getTemplates();
      setTemplates(t);
      setSelectedTemplate(t.length > 0 ? t[0].id : null);
      setRecipientId('');
      setMessage('');
      setComposeVisible(true);
    } catch {
      toast.error('Failed to load templates');
    }
  };

  const handleSend = async () => {
    if (!selectedTemplate || !recipientId.trim() || !message.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    setSending(true);
    try {
      await cardsApi.send({ templateId: selectedTemplate, recipientId: recipientId.trim(), message: message.trim() });
      setComposeVisible(false);
      fetchCards();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send card');
    } finally {
      setSending(false);
    }
  };

  const data = tab === 'received' ? received : sent;

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    tabs: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.bgElevated,
    },
    tabActive: {
      backgroundColor: colors.accentPrimary,
    },
    tabText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    tabTextActive: {
      color: colors.white,
    },
    list: {
      paddingVertical: spacing.sm,
      paddingBottom: spacing.xxxl,
    },
    cardItem: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    templateImage: {
      width: 60,
      height: 60,
      borderRadius: borderRadius.md,
      backgroundColor: colors.bgElevated,
    },
    cardInfo: {
      flex: 1,
    },
    cardName: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    cardMessage: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      marginTop: 2,
    },
    cardDate: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: spacing.xs,
    },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.xxl,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.bgPrimary,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      padding: spacing.lg,
      maxHeight: '80%',
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
      fontWeight: '700',
      marginBottom: spacing.lg,
    },
    label: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      marginBottom: spacing.xs,
      marginTop: spacing.md,
    },
    templateRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    templateOption: {
      width: 64,
      height: 64,
      borderRadius: borderRadius.md,
      backgroundColor: colors.bgElevated,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    templateOptionSelected: {
      borderColor: colors.accentPrimary,
    },
    templateOptionImage: {
      width: '100%',
      height: '100%',
      borderRadius: borderRadius.md,
    },
    input: {
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sendButton: {
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    sendButtonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {(['received', 'sent'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCards(); }} tintColor={colors.accentPrimary} />
        }
        renderItem={({ item }) => {
          const name = tab === 'received' ? item.senderName : item.recipientName;
          return (
            <View style={styles.cardItem}>
              {item.template?.imageUrl ? (
                <Image source={{ uri: item.template.imageUrl }} style={styles.templateImage} />
              ) : (
                <View style={styles.templateImage} />
              )}
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>
                  {tab === 'received' ? 'From' : 'To'}: {name || 'Unknown'}
                </Text>
                <Text style={styles.cardMessage} numberOfLines={2}>{item.message}</Text>
                <Text style={styles.cardDate}>{formatRelativeTime(item.createdAt)}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="mail-outline"
            title={tab === 'received' ? 'No cards received' : 'No cards sent'}
            subtitle="Send a greeting card to a friend"
          />
        }
      />

      <TouchableOpacity style={styles.fab} onPress={openCompose}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      <Modal visible={composeVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Send a Card</Text>

            <Text style={styles.label}>Template</Text>
            <FlatList
              horizontal
              data={templates}
              keyExtractor={(t) => t.id}
              contentContainerStyle={styles.templateRow}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item: t }) => (
                <TouchableOpacity
                  style={[styles.templateOption, selectedTemplate === t.id && styles.templateOptionSelected]}
                  onPress={() => setSelectedTemplate(t.id)}
                >
                  <Image source={{ uri: t.imageUrl }} style={styles.templateOptionImage} />
                </TouchableOpacity>
              )}
            />

            <Text style={styles.label}>Recipient ID</Text>
            <TextInput
              style={styles.input}
              value={recipientId}
              onChangeText={setRecipientId}
              placeholder="Enter user ID"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              value={message}
              onChangeText={setMessage}
              placeholder="Write a message..."
              placeholderTextColor={colors.textMuted}
              multiline
            />

            <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={sending}>
              <Text style={styles.sendButtonText}>{sending ? 'Sending...' : 'Send Card'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setComposeVisible(false)} style={{ alignItems: 'center', marginTop: spacing.md }}>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.md }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
