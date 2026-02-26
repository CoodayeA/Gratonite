import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, fontSize } from '../../theme';

type Nav = NativeStackNavigationProp<any>;
type RouteProps = RouteProp<{ params: { guildId: string; channelId: string } }, 'params'>;

interface QAQuestion {
  id: string;
  question: string;
  answer?: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  upvotes: number;
  isAnswered: boolean;
}

export function QAScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { guildId, channelId } = route.params;
  const [questions, setQuestions] = useState<QAQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQuestion, setNewQuestion] = useState('');

  React.useEffect(() => {
    async function fetchQuestions() {
      if (!channelId) return;
      try {
        const res = await fetch(`/api/v1/channels/${channelId}/qa`, { credentials: 'include' });
        const data = await res.json();
        setQuestions(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchQuestions();
  }, [channelId]);

  const handleSubmit = async () => {
    if (!newQuestion.trim()) return;
    try {
      const res = await fetch(`/api/v1/channels/${channelId}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: newQuestion }),
        credentials: 'include',
      });
      if (res.ok) {
        const q = await res.json();
        setQuestions([q, ...questions]);
        setNewQuestion('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpvote = async (questionId: string) => {
    try {
      await fetch(`/api/v1/qa/${questionId}/upvote`, { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error(e);
    }
  };

  const renderQuestion = ({ item }: { item: QAQuestion }) => (
    <View style={[styles.questionCard, item.isAnswered && styles.answeredCard]}>
      <View style={styles.questionHeader}>
        <TouchableOpacity onPress={() => handleUpvote(item.id)} style={styles.upvoteButton}>
          <Text style={styles.upvoteIcon}>▲</Text>
          <Text style={styles.upvoteCount}>{item.upvotes}</Text>
        </TouchableOpacity>
        <View style={styles.questionInfo}>
          <Text style={styles.questionText}>{item.question}</Text>
          <Text style={styles.questionMeta}>
            {item.authorName} • {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
      {item.answer && (
        <View style={styles.answerBox}>
          <Text style={styles.answerLabel}>Answer:</Text>
          <Text style={styles.answerText}>{item.answer}</Text>
        </View>
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
        <Text style={styles.headerTitle}>Q&A</Text>
      </View>
      <View style={styles.inputBox}>
        <TextInput
          style={styles.input}
          placeholder="Ask a question..."
          placeholderTextColor={colors.text.muted}
          value={newQuestion}
          onChangeText={setNewQuestion}
          multiline
        />
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Text style={styles.submitText}>Ask</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={questions}
        renderItem={renderQuestion}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No questions yet. Be the first to ask!</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.stroke.primary },
  headerTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text.primary },
  inputBox: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.stroke.primary },
  input: { flex: 1, backgroundColor: colors.bg.secondary, borderRadius: radius.md, padding: spacing.sm, color: colors.text.primary, maxHeight: 80 },
  submitBtn: { backgroundColor: colors.brand.primary, borderRadius: radius.md, paddingHorizontal: spacing.md, justifyContent: 'center' },
  submitText: { color: colors.text.primary, fontWeight: '600' },
  list: { padding: spacing.md },
  questionCard: { backgroundColor: colors.bg.secondary, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  answeredCard: { borderLeftWidth: 3, borderLeftColor: colors.accent.success },
  questionHeader: { flexDirection: 'row' },
  upvoteButton: { alignItems: 'center', marginRight: spacing.md },
  upvoteIcon: { color: colors.brand.primary, fontSize: 18 },
  upvoteCount: { color: colors.text.primary, fontWeight: '600' },
  questionInfo: { flex: 1 },
  questionText: { fontSize: fontSize.md, fontWeight: '500', color: colors.text.primary, marginBottom: 4 },
  questionMeta: { fontSize: fontSize.xs, color: colors.text.muted },
  answerBox: { marginTop: spacing.md, padding: spacing.sm, backgroundColor: colors.bg.primary, borderRadius: radius.sm },
  answerLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.accent.success, marginBottom: 4 },
  answerText: { fontSize: fontSize.sm, color: colors.text.secondary },
  emptyText: { color: colors.text.muted, textAlign: 'center', marginTop: spacing.xl },
});
