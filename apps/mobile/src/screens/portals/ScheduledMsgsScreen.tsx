import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, fontSize } from '../../theme';

type Nav = NativeStackNavigationProp<any>;
type RouteProps = RouteProp<{ params: { guildId: string } }, 'params'>;

interface ScheduledMessage {
  id: string;
  channelId: string;
  channelName: string;
  content: string;
  scheduledAt: string;
  status: 'pending' | 'sent' | 'cancelled';
}

export function ScheduledMsgsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { guildId } = route.params;
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    async function fetchMessages() {
      if (!guildId) return;
      try {
        const res = await fetch(`/api/v1/guilds/${guildId}/scheduled-messages`, { credentials: 'include' });
        const data = await res.json();
        setMessages(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchMessages();
  }, [guildId]);

  const handleCancel = async (messageId: string) => {
    try {
      await fetch(`/api/v1/scheduled-messages/${messageId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setMessages(messages.map(m => m.id === messageId ? { ...m, status: 'cancelled' as const } : m));
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return colors.accent.warning;
      case 'sent': return colors.accent.success;
      case 'cancelled': return colors.accent.error;
      default: return colors.text.muted;
    }
  };

  const renderMessage = ({ item }: { item: ScheduledMessage }) => (
    <View style={[styles.messageCard, item.status === 'cancelled' && styles.cancelledCard]}>
      <View style={styles.messageHeader}>
        <Text style={styles.channelName}>#{item.channelName}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '30' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.messageContent} numberOfLines={3}>{item.content}</Text>
      <View style={styles.messageFooter}>
        <Text style={styles.scheduledTime}>
          {new Date(item.scheduledAt).toLocaleString()}
        </Text>
        {item.status === 'pending' && (
          <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item.id)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scheduled Messages</Text>
      </View>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No scheduled messages</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.stroke.primary },
  headerTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text.primary },
  list: { padding: spacing.md },
  messageCard: { backgroundColor: colors.bg.secondary, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  cancelledCard: { opacity: 0.6 },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  channelName: { fontSize: fontSize.sm, fontWeight: '600', color: colors.brand.primary },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  statusText: { fontSize: fontSize.xs, fontWeight: '600', textTransform: 'capitalize' },
  messageContent: { fontSize: fontSize.md, color: colors.text.primary, marginBottom: spacing.sm },
  messageFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scheduledTime: { fontSize: fontSize.xs, color: colors.text.muted },
  cancelBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  cancelText: { color: colors.accent.error, fontSize: fontSize.sm, fontWeight: '500' },
  emptyText: { color: colors.text.muted, textAlign: 'center', marginTop: spacing.xl },
});
