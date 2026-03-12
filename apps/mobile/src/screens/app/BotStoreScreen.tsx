import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { botStore } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { BotListing, BotReview } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'BotStore'>;

const CATEGORIES = ['All', 'Moderation', 'Music', 'Fun', 'Utility', 'Social'] as const;
type Category = (typeof CATEGORIES)[number];

export default function BotStoreScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();

  const [bots, setBots] = useState<BotListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [searchText, setSearchText] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Detail view
  const [selectedBot, setSelectedBot] = useState<BotListing | null>(null);
  const [reviews, setReviews] = useState<BotReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Review form
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewContent, setReviewContent] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 500);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchText]);

  const fetchBots = useCallback(async () => {
    try {
      const category = activeCategory === 'All' ? undefined : activeCategory.toLowerCase();
      const search = debouncedSearch.trim() || undefined;
      const data = await botStore.list(category, search);
      setBots(data);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load bots');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCategory, debouncedSearch]);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const fetchReviews = useCallback(async (botId: string) => {
    setLoadingReviews(true);
    try {
      const data = await botStore.getReviews(botId);
      setReviews(data);
    } catch {
      setReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  }, []);

  const handleSelectBot = useCallback((bot: BotListing) => {
    setSelectedBot(bot);
    setReviewRating(0);
    setReviewContent('');
    fetchReviews(bot.id);
  }, [fetchReviews]);

  const handleInstall = useCallback(() => {
    if (!selectedBot) return;
    Alert.prompt(
      'Install Bot',
      `Enter the portal ID to install "${selectedBot.name}" to:`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Install',
          onPress: async (guildId?: string) => {
            if (!guildId?.trim()) {
              toast.error('Please enter a portal ID');
              return;
            }
            setInstalling(true);
            try {
              await botStore.install(selectedBot.id, guildId.trim());
              toast.success(`Installed "${selectedBot.name}" to portal!`);
            } catch (err: any) {
              toast.error(err.message || 'Failed to install bot');
            } finally {
              setInstalling(false);
            }
          },
        },
      ],
      'plain-text',
    );
  }, [selectedBot]);

  const handleSubmitReview = useCallback(async () => {
    if (!selectedBot || reviewRating === 0) {
      toast.error('Please select a rating');
      return;
    }
    const content = reviewContent.trim();
    if (!content) {
      toast.error('Please write a review');
      return;
    }
    setSubmittingReview(true);
    try {
      const review = await botStore.postReview(selectedBot.id, {
        rating: reviewRating,
        content,
      });
      setReviews((prev) => [review, ...prev]);
      setReviewRating(0);
      setReviewContent('');
      toast.success('Review submitted!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  }, [selectedBot, reviewRating, reviewContent]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    // Search bar
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      borderRadius: borderRadius.md,
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    searchIcon: {
      marginRight: spacing.sm,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      paddingVertical: spacing.md,
    },
    clearBtn: {
      padding: spacing.xs,
    },
    // Category tabs
    tabsContainer: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabsContent: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
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
    // Bot list
    listContent: {
      padding: spacing.md,
      paddingBottom: 80,
    },
    botCard: {
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    botCardHeader: {
      flexDirection: 'row',
      marginBottom: spacing.md,
    },
    botIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    botIconLetter: {
      color: colors.white,
      fontSize: fontSize.lg,
      fontWeight: '700',
    },
    botCardInfo: {
      flex: 1,
    },
    botNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    botName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '700',
      flexShrink: 1,
    },
    botDescription: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 18,
    },
    botCardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    botStats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    botStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    botStatText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    categoryTag: {
      backgroundColor: colors.bgTertiary,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
    },
    categoryTagText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    addButton: {
      backgroundColor: colors.accentPrimary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
    },
    addButtonText: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    // Detail Modal
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
    detailScroll: {
      flex: 1,
    },
    detailHeader: {
      flexDirection: 'row',
      padding: spacing.lg,
      alignItems: 'center',
    },
    detailIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.lg,
    },
    detailIconLetter: {
      color: colors.white,
      fontSize: fontSize.xl,
      fontWeight: '700',
    },
    detailInfo: {
      flex: 1,
    },
    detailNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    detailName: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
      fontWeight: '700',
    },
    detailCreator: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
    statsRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      gap: spacing.lg,
    },
    statItem: {
      alignItems: 'center',
      flex: 1,
      backgroundColor: colors.bgElevated,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontWeight: '700',
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: spacing.xs,
    },
    detailDescription: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      lineHeight: 22,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    installButton: {
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.lg,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      alignItems: 'center',
    },
    installButtonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    // Reviews
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '700',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    reviewCard: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    reviewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    reviewAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.sm,
    },
    reviewAvatarText: {
      color: colors.white,
      fontSize: fontSize.xs,
      fontWeight: '700',
    },
    reviewMeta: {
      flex: 1,
    },
    reviewUsername: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    reviewStars: {
      flexDirection: 'row',
      gap: 2,
    },
    reviewDate: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    reviewContent: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      lineHeight: 18,
    },
    // Write review form
    reviewFormContainer: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
    },
    ratingRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    ratingButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.bgElevated,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    ratingButtonActive: {
      backgroundColor: colors.warning,
      borderColor: colors.warning,
    },
    ratingButtonText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    ratingButtonTextActive: {
      color: colors.white,
    },
    reviewInput: {
      backgroundColor: colors.inputBg,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 80,
      marginBottom: spacing.md,
      textAlignVertical: 'top',
    },
    submitReviewButton: {
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    submitReviewButtonDisabled: {
      opacity: 0.5,
    },
    submitReviewText: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderBotCard = useCallback(({ item }: { item: BotListing }) => (
    <TouchableOpacity
      style={styles.botCard}
      onPress={() => handleSelectBot(item)}
      activeOpacity={0.7}
    >
      <View style={styles.botCardHeader}>
        <View style={[styles.botIcon, { backgroundColor: colors.accentPrimary }]}>
          <Text style={styles.botIconLetter}>{item.name[0]?.toUpperCase()}</Text>
        </View>
        <View style={styles.botCardInfo}>
          <View style={styles.botNameRow}>
            <Text style={styles.botName} numberOfLines={1}>{item.name}</Text>
            {item.verified && (
              <Ionicons name="checkmark-circle" size={16} color={colors.accentPrimary} />
            )}
          </View>
          <Text style={styles.botDescription} numberOfLines={2}>{item.description}</Text>
        </View>
      </View>

      <View style={styles.botCardFooter}>
        <View style={styles.botStats}>
          <View style={styles.botStat}>
            <Ionicons name="download-outline" size={14} color={colors.textMuted} />
            <Text style={styles.botStatText}>{item.installCount.toLocaleString()}</Text>
          </View>
          <View style={styles.botStat}>
            <Ionicons name="star" size={14} color={colors.warning} />
            <Text style={styles.botStatText}>{item.rating.toFixed(1)}</Text>
          </View>
          <View style={styles.categoryTag}>
            <Text style={styles.categoryTagText}>{item.category}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleSelectBot(item)}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  ), [styles, colors, handleSelectBot]);

  const renderReview = useCallback(({ item }: { item: BotReview }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={[styles.reviewAvatar, { backgroundColor: colors.accentPrimary }]}>
          <Text style={styles.reviewAvatarText}>{(item.username || 'U')[0]?.toUpperCase()}</Text>
        </View>
        <View style={styles.reviewMeta}>
          <Text style={styles.reviewUsername}>{item.username || 'Anonymous'}</Text>
          <View style={styles.reviewStars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons
                key={s}
                name={s <= item.rating ? 'star' : 'star-outline'}
                size={12}
                color={colors.warning}
              />
            ))}
          </View>
        </View>
        <Text style={styles.reviewDate}>{formatRelativeTime(item.createdAt)}</Text>
      </View>
      <Text style={styles.reviewContent}>{item.content}</Text>
    </View>
  ), [styles, colors]);

  if (loading) return <LoadingScreen />;

  return (
    <PatternBackground>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search bots..."
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter chips */}
      <View style={styles.tabsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.tabsContent}
          renderItem={({ item: cat }) => (
            <TouchableOpacity
              style={[styles.tab, activeCategory === cat && styles.tabActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.tabText, activeCategory === cat && styles.tabTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Bot listings */}
      <FlatList
        data={bots}
        keyExtractor={(item) => item.id}
        renderItem={renderBotCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchBots(); }}
            tintColor={colors.accentPrimary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="hardware-chip-outline"
            title="No bots found"
            subtitle={searchText ? 'Try a different search term' : 'Check back later for new bots!'}
          />
        }
      />

      {/* Bot Detail Modal */}
      <Modal visible={!!selectedBot} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedBot(null)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {selectedBot?.name}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            {selectedBot && (
              <ScrollView style={styles.detailScroll}>
                {/* Bot header */}
                <View style={styles.detailHeader}>
                  <View style={[styles.detailIcon, { backgroundColor: colors.accentPrimary }]}>
                    <Text style={styles.detailIconLetter}>
                      {selectedBot.name[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.detailInfo}>
                    <View style={styles.detailNameRow}>
                      <Text style={styles.detailName}>{selectedBot.name}</Text>
                      {selectedBot.verified && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.accentPrimary} />
                      )}
                    </View>
                    {selectedBot.creatorName && (
                      <Text style={styles.detailCreator}>
                        by {selectedBot.creatorName}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Stats row */}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {selectedBot.installCount.toLocaleString()}
                    </Text>
                    <Text style={styles.statLabel}>Installs</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{selectedBot.rating.toFixed(1)}</Text>
                    <Text style={styles.statLabel}>Rating</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statValue, { textTransform: 'capitalize' }]}>
                      {selectedBot.category}
                    </Text>
                    <Text style={styles.statLabel}>Category</Text>
                  </View>
                </View>

                {/* Full description */}
                <Text style={styles.detailDescription}>{selectedBot.description}</Text>

                {/* Install button */}
                <TouchableOpacity
                  style={styles.installButton}
                  onPress={handleInstall}
                  disabled={installing}
                >
                  <Text style={styles.installButtonText}>
                    {installing ? 'Installing...' : 'Install to Portal'}
                  </Text>
                </TouchableOpacity>

                {/* Reviews section */}
                <Text style={styles.sectionTitle}>Reviews</Text>

                {loadingReviews ? (
                  <ActivityIndicator
                    color={colors.accentPrimary}
                    style={{ marginVertical: spacing.lg }}
                  />
                ) : (
                  reviews.map((review) => (
                    <View key={review.id}>
                      {renderReview({ item: review })}
                    </View>
                  ))
                )}

                {/* Write review form */}
                <Text style={styles.sectionTitle}>Write a Review</Text>
                <View style={styles.reviewFormContainer}>
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <TouchableOpacity
                        key={n}
                        style={[
                          styles.ratingButton,
                          reviewRating >= n && styles.ratingButtonActive,
                        ]}
                        onPress={() => setReviewRating(n)}
                      >
                        <Text
                          style={[
                            styles.ratingButtonText,
                            reviewRating >= n && styles.ratingButtonTextActive,
                          ]}
                        >
                          {n}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={styles.reviewInput}
                    value={reviewContent}
                    onChangeText={setReviewContent}
                    placeholder="Share your experience..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    maxLength={1000}
                  />

                  <TouchableOpacity
                    style={[
                      styles.submitReviewButton,
                      (reviewRating === 0 || !reviewContent.trim() || submittingReview) &&
                        styles.submitReviewButtonDisabled,
                    ]}
                    onPress={handleSubmitReview}
                    disabled={reviewRating === 0 || !reviewContent.trim() || submittingReview}
                  >
                    <Text style={styles.submitReviewText}>
                      {submittingReview ? 'Submitting...' : 'Submit Review'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </PatternBackground>
  );
}
