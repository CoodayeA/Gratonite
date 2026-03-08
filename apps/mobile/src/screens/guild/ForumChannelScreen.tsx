import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
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
import RichText from '../../components/RichText';
import type { ForumPost, Message } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ForumChannel'>;

export default function ForumChannelScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { channelId, channelName } = route.params;
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);

  // New post modal
  const [showNewPost, setShowNewPost] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [creating, setCreating] = useState(false);

  // Post detail
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [replies, setReplies] = useState<Message[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      const data = await forumApi.listPosts(channelId);
      setPosts(data);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load forum posts');
      }
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleCreatePost = async () => {
    const title = newTitle.trim();
    const content = newContent.trim();
    if (!title || !content) {
      toast.error('Title and content are required');
      return;
    }

    setCreating(true);
    try {
      const post = await forumApi.createPost(channelId, { title, content });
      setPosts((prev) => [post, ...prev]);
      setShowNewPost(false);
      setNewTitle('');
      setNewContent('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create post');
    } finally {
      setCreating(false);
    }
  };

  const handleOpenPost = async (post: ForumPost) => {
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

  const renderPost = ({ item }: { item: ForumPost }) => (
    <TouchableOpacity
      style={styles.postCard}
      onPress={() => handleOpenPost(item)}
      activeOpacity={0.7}
    >
      <View style={styles.postHeader}>
        <Text style={styles.postTitle} numberOfLines={2}>{item.title}</Text>
        {item.pinned && (
          <Ionicons name="pin" size={14} color={colors.warning} />
        )}
        {item.locked && (
          <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
        )}
      </View>

      {item.tags.length > 0 && (
        <View style={styles.tagsRow}>
          {item.tags.map((tag) => (
            <View key={tag} style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.postMeta}>
        <Text style={styles.postAuthor}>{item.authorName || 'Unknown'}</Text>
        <Text style={styles.postDot}>{'\u00B7'}</Text>
        <Text style={styles.postDate}>{formatRelativeTime(item.createdAt)}</Text>
        <View style={styles.replyCountRow}>
          <Ionicons name="chatbubble-outline" size={12} color={colors.textMuted} />
          <Text style={styles.replyCount}>{item.replyCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

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
    postCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    postHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    postTitle: {
      flex: 1,
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
    postMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.md,
      gap: spacing.xs,
    },
    postAuthor: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    postDot: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    postDate: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    replyCountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginLeft: 'auto',
    },
    replyCount: {
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
    replyContent: {
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

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="newspaper-outline"
            title="No posts yet"
            subtitle="Start a discussion by creating the first post!"
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowNewPost(true)}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* New Post Modal */}
      <Modal visible={showNewPost} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowNewPost(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>New Post</Text>
              <TouchableOpacity
                onPress={handleCreatePost}
                disabled={creating || !newTitle.trim() || !newContent.trim()}
              >
                <Text
                  style={[
                    styles.postButton,
                    (!newTitle.trim() || !newContent.trim() || creating) && styles.postButtonDisabled,
                  ]}
                >
                  {creating ? 'Posting...' : 'Post'}
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.titleInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Post title"
              placeholderTextColor={colors.textMuted}
              maxLength={200}
            />

            <TextInput
              style={styles.contentInput}
              value={newContent}
              onChangeText={setNewContent}
              placeholder="What do you want to discuss?"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={4000}
              textAlignVertical="top"
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Post Detail Modal */}
      <Modal visible={!!selectedPost} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setSelectedPost(null); setReplies([]); }}>
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
                    <Text style={styles.postAuthor}>{selectedPost.authorName || 'Unknown'}</Text>
                    <Text style={styles.postDot}>{'\u00B7'}</Text>
                    <Text style={styles.postDate}>{formatRelativeTime(selectedPost.createdAt)}</Text>
                  </View>
                  {selectedPost.tags.length > 0 && (
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
                  Replies ({selectedPost?.replyCount ?? 0})
                </Text>

                {loadingReplies ? (
                  <Text style={styles.loadingRepliesText}>Loading replies...</Text>
                ) : replies.length === 0 ? (
                  <Text style={styles.noRepliesText}>No replies yet</Text>
                ) : (
                  replies.map((reply) => (
                    <View key={reply.id} style={styles.replyRow}>
                      <View style={styles.replyAvatar}>
                        <Text style={styles.replyAvatarText}>
                          {(reply.author?.username || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.replyContent}>
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
    </View>
  );
}
