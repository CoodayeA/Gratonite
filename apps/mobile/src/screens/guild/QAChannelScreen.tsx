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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { forum as forumApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import LoadErrorCard from '../../components/LoadErrorCard';
import RichText from '../../components/RichText';
import type { ForumPost, Message } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'QAChannel'>;

export default function QAChannelScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { channelId, channelName } = route.params;
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // New question modal
  const [showNewQuestion, setShowNewQuestion] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [creating, setCreating] = useState(false);

  // Question detail
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [replies, setReplies] = useState<Message[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await forumApi.listPosts(channelId);
      setPosts(data);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load questions';
        if (refreshing || posts.length > 0) {
          toast.error(message);
        } else {
          setLoadError(message);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [channelId]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleCreateQuestion = async () => {
    const title = newTitle.trim();
    const content = newContent.trim();
    if (!title || !content) {
      toast.error('Title and content are required');
      return;
    }

    setCreating(true);
    try {
      const post = await forumApi.createPost(channelId, { title, content, tags: ['question'] });
      setPosts((prev) => [post, ...prev]);
      setShowNewQuestion(false);
      setNewTitle('');
      setNewContent('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to post question');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenQuestion = async (post: ForumPost) => {
    setSelectedPost(post);
    setLoadingReplies(true);
    try {
      const data = await forumApi.getReplies(post.id);
      setReplies(data);
    } catch {
      setReplies([]);
    } finally {
      setLoadingReplies(false);
    }
  };

  const renderQuestion = ({ item }: { item: ForumPost }) => {
    const hasAccepted = item.tags?.includes('accepted');

    return (
      <TouchableOpacity
        style={styles.questionCard}
        onPress={() => handleOpenQuestion(item)}
        activeOpacity={0.7}
      >
        {/* Vote / answer counts */}
        <View style={styles.statsColumn}>
          <View style={styles.statBox}>
            <Ionicons name="arrow-up" size={14} color={colors.textMuted} />
            <Text style={styles.statNumber}>0</Text>
          </View>
          <View style={[styles.statBox, hasAccepted && styles.acceptedBox]}>
            <Ionicons
              name={hasAccepted ? 'checkmark-circle' : 'chatbubble-outline'}
              size={14}
              color={hasAccepted ? colors.success : colors.textMuted}
            />
            <Text style={[styles.statNumber, hasAccepted && { color: colors.success }]}>
              {item.replyCount}
            </Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.questionContent}>
          <Text style={styles.questionTitle} numberOfLines={2}>{item.title}</Text>

          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {item.tags.map((tag) => (
                <View key={tag} style={styles.tagPill}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.questionMeta}>
            <Text style={styles.questionAuthor}>{item.authorName || 'Unknown'}</Text>
            <Text style={styles.questionDot}>{'\u00B7'}</Text>
            <Text style={styles.questionDate}>{formatRelativeTime(item.createdAt)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    listContent: {
      padding: spacing.md,
      paddingBottom: 80,
      gap: spacing.md,
    },
    questionCard: {
      flexDirection: 'row',
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
    },
    statsColumn: {
      alignItems: 'center',
      gap: spacing.sm,
    },
    statBox: {
      alignItems: 'center',
      minWidth: 36,
    },
    acceptedBox: {
      // visual only
    },
    statNumber: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: '700',
      marginTop: 2,
    },
    questionContent: {
      flex: 1,
    },
    questionTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '700',
      lineHeight: 22,
    },
    tagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: spacing.sm,
    },
    tagPill: {
      backgroundColor: colors.accentLight,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
    },
    tagText: {
      color: colors.accentPrimary,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    questionMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.md,
      gap: spacing.xs,
    },
    questionAuthor: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    questionDot: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    questionDate: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    fab: {
      position: 'absolute',
      right: spacing.xl,
      bottom: spacing.xl,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.accentPrimary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 4,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    // Modals
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.bgPrimary,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      maxHeight: '90%',
      flex: 1,
      marginTop: 60,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '700',
      flex: 1,
      textAlign: 'center',
      marginHorizontal: spacing.md,
    },
    postButton: {
      color: colors.accentPrimary,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    postButtonDisabled: {
      color: colors.textMuted,
    },
    titleInput: {
      backgroundColor: colors.inputBg,
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '600',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    contentInput: {
      flex: 1,
      backgroundColor: colors.inputBg,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      minHeight: 200,
    },
    // Detail
    detailScroll: {
      flex: 1,
    },
    detailPost: {
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    detailTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    detailMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    detailContent: {
      marginTop: spacing.md,
    },
    repliesSection: {
      padding: spacing.lg,
    },
    repliesSectionTitle: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '700',
      marginBottom: spacing.lg,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    loadingRepliesText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      paddingVertical: spacing.xl,
    },
    noRepliesText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      paddingVertical: spacing.xl,
    },
    replyRow: {
      flexDirection: 'row',
      marginBottom: spacing.lg,
      gap: spacing.md,
    },
    replyLeft: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    replyAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
    },
    replyAvatarText: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '700',
    },
    acceptedIcon: {
      marginTop: spacing.xs,
    },
    replyBody: {
      flex: 1,
    },
    replyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    replyAuthor: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    replyDate: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  if (loadError && posts.length === 0) return <LoadErrorCard title="Failed to load Q&A" message={loadError} onRetry={() => { setLoading(true); fetchPosts(); }} />;

  return (
    <PatternBackground>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderQuestion}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchPosts(); }}
            tintColor={colors.accentPrimary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="help-circle-outline"
            title="No questions yet"
            subtitle="Ask a question to get the conversation started!"
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowNewQuestion(true)}
        accessibilityLabel="New question"
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* New Question Modal */}
      <Modal visible={showNewQuestion} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowNewQuestion(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Ask a Question</Text>
              <TouchableOpacity
                onPress={handleCreateQuestion}
                disabled={creating || !newTitle.trim() || !newContent.trim()}
              >
                <Text
                  style={[
                    styles.postButton,
                    (!newTitle.trim() || !newContent.trim() || creating) && styles.postButtonDisabled,
                  ]}
                >
                  {creating ? 'Posting...' : 'Ask'}
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.titleInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="What's your question?"
              placeholderTextColor={colors.textMuted}
              maxLength={200}
            />

            <TextInput
              style={styles.contentInput}
              value={newContent}
              onChangeText={setNewContent}
              placeholder="Provide details about your question..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={4000}
              textAlignVertical="top"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Question Detail Modal */}
      <Modal visible={!!selectedPost} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setSelectedPost(null); setReplies([]); }} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {selectedPost?.title}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.detailScroll}>
              {selectedPost && (
                <View style={styles.detailPost}>
                  <Text style={styles.detailTitle}>{selectedPost.title}</Text>
                  <View style={styles.detailMeta}>
                    <Text style={styles.questionAuthor}>{selectedPost.authorName || 'Unknown'}</Text>
                    <Text style={styles.questionDot}>{'\u00B7'}</Text>
                    <Text style={styles.questionDate}>{formatRelativeTime(selectedPost.createdAt)}</Text>
                  </View>
                  {selectedPost.tags && selectedPost.tags.length > 0 && (
                    <View style={styles.tagsRow}>
                      {selectedPost.tags.map((tag) => (
                        <View key={tag} style={styles.tagPill}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={styles.detailContent}>
                    <RichText content={selectedPost.content} />
                  </View>
                </View>
              )}

              <View style={styles.repliesSection}>
                <Text style={styles.repliesSectionTitle}>
                  Answers ({selectedPost?.replyCount ?? 0})
                </Text>

                {loadingReplies ? (
                  <Text style={styles.loadingRepliesText}>Loading answers...</Text>
                ) : replies.length === 0 ? (
                  <Text style={styles.noRepliesText}>No answers yet</Text>
                ) : (
                  replies.map((reply, idx) => (
                    <View key={reply.id} style={styles.replyRow}>
                      <View style={styles.replyLeft}>
                        <View style={styles.replyAvatar}>
                          <Text style={styles.replyAvatarText}>
                            {(reply.author?.username || 'U').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        {idx === 0 && (
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color={colors.success}
                            style={styles.acceptedIcon}
                          />
                        )}
                      </View>
                      <View style={styles.replyBody}>
                        <View style={styles.replyHeader}>
                          <Text style={styles.replyAuthor}>
                            {reply.author?.displayName || reply.author?.username || 'Unknown'}
                          </Text>
                          <Text style={styles.replyDate}>{formatRelativeTime(reply.createdAt)}</Text>
                        </View>
                        <RichText content={reply.content} />
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </PatternBackground>
  );
}
