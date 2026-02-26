import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, fontSize } from '../../theme';

type Nav = NativeStackNavigationProp<any>;

interface PollOption {
  id: string;
  text: string;
  voteCount: number;
}

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  isMultiSelect: boolean;
  endsAt?: string;
  status: 'active' | 'closed';
  totalVotes: number;
}

export function PollsScreen() {
  const navigation = useNavigation<Nav>();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'closed'>('active');

  React.useEffect(() => {
    async function fetchPolls() {
      try {
        const res = await fetch(`/api/v1/polls?status=${filter}`, { credentials: 'include' });
        const data = await res.json();
        setPolls(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchPolls();
  }, [filter]);

  const handleVote = async (pollId: string, optionId: string) => {
    try {
      await fetch(`/api/v1/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId }),
        credentials: 'include',
      });
    } catch (e) {
      console.error(e);
    }
  };

  const renderPoll = ({ item }: { item: Poll }) => (
    <View style={styles.pollCard}>
      <View style={styles.pollHeader}>
        <Text style={styles.pollQuestion}>{item.question}</Text>
        <View style={[styles.statusBadge, item.status === 'active' ? styles.activeBadge : styles.closedBadge]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.voteCount}>{item.totalVotes} votes</Text>
      {item.options.map((option) => (
        <TouchableOpacity
          key={option.id}
          style={styles.optionButton}
          onPress={() => item.status === 'active' && handleVote(item.id, option.id)}
        >
          <View style={styles.optionContent}>
            <Text style={styles.optionText}>{option.text}</Text>
            <Text style={styles.optionVotes}>{option.voteCount}</Text>
          </View>
          <View style={[styles.progressBar, { width: `${(option.voteCount / (item.totalVotes || 1)) * 100}%` }]} />
        </TouchableOpacity>
      ))}
      {item.endsAt && (
        <Text style={styles.endsAt}>Ends: {new Date(item.endsAt).toLocaleString()}</Text>
      )}
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
        <Text style={styles.headerTitle}>Polls</Text>
      </View>
      <View style={styles.filters}>
        <TouchableOpacity style={[styles.filterBtn, filter === 'active' && styles.filterBtnActive]} onPress={() => setFilter('active')}>
          <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterBtn, filter === 'closed' && styles.filterBtnActive]} onPress={() => setFilter('closed')}>
          <Text style={[styles.filterText, filter === 'closed' && styles.filterTextActive]}>Closed</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={polls}
        renderItem={renderPoll}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No polls found</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.stroke.primary },
  headerTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text.primary },
  filters: { flexDirection: 'row', padding: spacing.sm, gap: spacing.sm },
  filterBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.bg.secondary },
  filterBtnActive: { backgroundColor: colors.brand.primary },
  filterText: { color: colors.text.secondary, fontWeight: '500' },
  filterTextActive: { color: colors.text.primary },
  list: { padding: spacing.md },
  pollCard: { backgroundColor: colors.bg.secondary, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  pollHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  pollQuestion: { flex: 1, fontSize: fontSize.lg, fontWeight: '600', color: colors.text.primary },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  activeBadge: { backgroundColor: colors.accent.success + '30' },
  closedBadge: { backgroundColor: colors.text.muted + '30' },
  statusText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.text.secondary },
  voteCount: { fontSize: fontSize.sm, color: colors.text.muted, marginBottom: spacing.md },
  optionButton: { marginBottom: spacing.sm, position: 'relative', overflow: 'hidden' },
  optionContent: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.sm, backgroundColor: colors.bg.primary, borderRadius: radius.sm, zIndex: 1 },
  optionText: { color: colors.text.primary },
  optionVotes: { color: colors.text.muted },
  progressBar: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.brand.primary + '30', zIndex: 0 },
  endsAt: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: spacing.sm },
  emptyText: { color: colors.text.muted, textAlign: 'center', marginTop: spacing.xl },
});
