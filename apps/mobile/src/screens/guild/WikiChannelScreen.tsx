import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { wiki as wikiApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import LoadErrorCard from '../../components/LoadErrorCard';
import RichText from '../../components/RichText';
import type { WikiPage, WikiRevision } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'WikiChannel'>;

export default function WikiChannelScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { channelId, channelName } = route.params;
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // View page
  const [viewingPage, setViewingPage] = useState<WikiPage | null>(null);

  // Edit page
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Create page
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createContent, setCreateContent] = useState('');
  const [creating, setCreating] = useState(false);

  // Revisions
  const [showRevisions, setShowRevisions] = useState(false);
  const [revisions, setRevisions] = useState<WikiRevision[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  const fetchPages = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await wikiApi.listPages(channelId);
      setPages(data);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load wiki pages';
        if (pages.length > 0) {
          toast.error(message);
        } else {
          setLoadError(message);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [channelId, pages.length, toast]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const handleViewPage = async (page: WikiPage) => {
    try {
      const full = await wikiApi.getPage(page.id);
      setViewingPage(full);
    } catch {
      setViewingPage(page);
    }
  };

  const handleStartEdit = () => {
    if (!viewingPage) return;
    setEditContent(viewingPage.content);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!viewingPage) return;
    setSaving(true);
    try {
      const updated = await wikiApi.updatePage(viewingPage.id, { content: editContent });
      setViewingPage(updated);
      setPages((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p)),
      );
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePage = async () => {
    const title = createTitle.trim();
    if (!title) {
      toast.error('Title is required');
      return;
    }

    setCreating(true);
    try {
      const page = await wikiApi.createPage(channelId, {
        title,
        content: createContent.trim() || undefined,
      });
      setPages((prev) => [page, ...prev]);
      setShowCreate(false);
      setCreateTitle('');
      setCreateContent('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create page');
    } finally {
      setCreating(false);
    }
  };

  const handleShowRevisions = async () => {
    if (!viewingPage) return;
    setShowRevisions(true);
    setLoadingRevisions(true);
    try {
      const data = await wikiApi.getRevisions(viewingPage.id);
      setRevisions(data);
    } catch {
      setRevisions([]);
    } finally {
      setLoadingRevisions(false);
    }
  };

  const renderPage = ({ item }: { item: WikiPage }) => (
    <TouchableOpacity
      style={styles.pageRow}
      onPress={() => handleViewPage(item)}
      activeOpacity={0.7}
    >
      <View style={styles.pageIcon}>
        <Ionicons name="document-text-outline" size={20} color={colors.accentPrimary} />
      </View>
      <View style={styles.pageInfo}>
        <Text style={styles.pageTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.pageMetaRow}>
          <Text style={styles.pageMeta}>
            {item.author || 'Unknown'}
          </Text>
          <Text style={styles.pageMetaDot}>{'\u00B7'}</Text>
          <Text style={styles.pageMeta}>
            Updated {formatRelativeTime(item.updatedAt)}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    listContent: {
      paddingBottom: 80,
    },
    pageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    pageIcon: {
      width: 36,
      height: 36,
      borderRadius: borderRadius.md,
      backgroundColor: colors.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pageInfo: {
      flex: 1,
    },
    pageTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    pageMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: 2,
    },
    pageMeta: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    pageMetaDot: {
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
    headerActions: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    headerAction: {
      padding: spacing.xs,
    },
    cancelText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    saveText: {
      color: colors.accentPrimary,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    saveTextDisabled: {
      color: colors.textMuted,
    },
    pageContentScroll: {
      flex: 1,
    },
    pageContentContainer: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    editInput: {
      flex: 1,
      backgroundColor: colors.inputBg,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      lineHeight: 22,
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
    // Revisions
    revisionsList: {
      flex: 1,
      padding: spacing.lg,
    },
    revisionsTitle: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.lg,
    },
    loadingText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      paddingVertical: spacing.xl,
    },
    revisionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    revisionInfo: {
      flex: 1,
    },
    revisionAuthor: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    revisionDate: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
    backToContentBtn: {
      marginTop: spacing.xl,
      alignItems: 'center',
      paddingVertical: spacing.md,
    },
    backToContentText: {
      color: colors.accentPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  if (loadError && pages.length === 0) return <LoadErrorCard title="Failed to load wiki" message={loadError} onRetry={() => { setLoading(true); fetchPages(); }} />;

  return (
    <PatternBackground>
      <FlatList
        data={pages}
        keyExtractor={(item) => item.id}
        renderItem={renderPage}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="book-outline"
            title="No wiki pages"
            subtitle="Create the first page to get started!"
          />
        }
      />

      {/* Create page button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowCreate(true)}
        accessibilityLabel="Create page"
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* View Page Modal */}
      <Modal visible={!!viewingPage && !editing} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setViewingPage(null); setShowRevisions(false); }} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {viewingPage?.title}
              </Text>
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={handleShowRevisions} style={styles.headerAction} accessibilityLabel="View revisions">
                  <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleStartEdit} style={styles.headerAction} accessibilityLabel="Edit page">
                  <Ionicons name="create-outline" size={20} color={colors.accentPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {showRevisions ? (
              <ScrollView style={styles.revisionsList}>
                <Text style={styles.revisionsTitle}>Revision History</Text>
                {loadingRevisions ? (
                  <Text style={styles.loadingText}>Loading revisions...</Text>
                ) : revisions.length === 0 ? (
                  <Text style={styles.loadingText}>No revisions</Text>
                ) : (
                  revisions.map((rev) => (
                    <View key={rev.id} style={styles.revisionRow}>
                      <Ionicons name="git-commit-outline" size={16} color={colors.textMuted} />
                      <View style={styles.revisionInfo}>
                        <Text style={styles.revisionAuthor}>{rev.author || 'Unknown'}</Text>
                        <Text style={styles.revisionDate}>{formatRelativeTime(rev.createdAt)}</Text>
                      </View>
                    </View>
                  ))
                )}
                <TouchableOpacity
                  style={styles.backToContentBtn}
                  onPress={() => setShowRevisions(false)}
                >
                  <Text style={styles.backToContentText}>Back to Content</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <ScrollView style={styles.pageContentScroll} contentContainerStyle={styles.pageContentContainer}>
                {viewingPage && <RichText content={viewingPage.content} />}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Page Modal */}
      <Modal visible={editing} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditing(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Page</Text>
              <TouchableOpacity onPress={handleSaveEdit} disabled={saving}>
                <Text style={[styles.saveText, saving && styles.saveTextDisabled]}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.editInput}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              textAlignVertical="top"
              placeholder="Page content..."
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Create Page Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCreate(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>New Page</Text>
              <TouchableOpacity
                onPress={handleCreatePage}
                disabled={creating || !createTitle.trim()}
              >
                <Text style={[styles.saveText, (creating || !createTitle.trim()) && styles.saveTextDisabled]}>
                  {creating ? 'Creating...' : 'Create'}
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.titleInput}
              value={createTitle}
              onChangeText={setCreateTitle}
              placeholder="Page title"
              placeholderTextColor={colors.textMuted}
              maxLength={200}
            />
            <TextInput
              style={styles.editInput}
              value={createContent}
              onChangeText={setCreateContent}
              multiline
              textAlignVertical="top"
              placeholder="Page content (optional)"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </PatternBackground>
  );
}
