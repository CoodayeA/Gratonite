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
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { marketplace as marketplaceApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/formatters';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { MarketplaceListing } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'Marketplace'>;

const CATEGORIES = ['All', 'Digital', 'Physical', 'Services', 'Other'] as const;
type Category = (typeof CATEGORIES)[number];

const STATUS_COLORS: Record<string, string> = {
  active: '#43b581',
  sold: '#9898b8',
  removed: '#e74c3c',
};

export default function MarketplaceScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>('All');

  // New listing modal
  const [showNewListing, setShowNewListing] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState<string>('Digital');
  const [creating, setCreating] = useState(false);

  // Detail modal
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);

  const fetchListings = useCallback(async () => {
    try {
      const category = activeCategory === 'All' ? undefined : activeCategory.toLowerCase();
      const data = await marketplaceApi.list(category);
      setListings(data);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load listings');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleCreateListing = async () => {
    const title = newTitle.trim();
    const description = newDescription.trim();
    const price = Number(newPrice.trim());
    if (!title || !description) {
      toast.error('Title and description are required');
      return;
    }
    if (isNaN(price) || price <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    setCreating(true);
    try {
      const listing = await marketplaceApi.create({
        title,
        description,
        price,
        category: newCategory.toLowerCase(),
      });
      setListings((prev) => [listing, ...prev]);
      setShowNewListing(false);
      setNewTitle('');
      setNewDescription('');
      setNewPrice('');
      setNewCategory('Digital');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create listing');
    } finally {
      setCreating(false);
    }
  };

  const handlePurchase = (listing: MarketplaceListing) => {
    Alert.alert(
      'Confirm Purchase',
      `Buy "${listing.title}" for ${listing.price} coins?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: async () => {
            try {
              await marketplaceApi.purchase(listing.id);
              toast.success(`Purchased "${listing.title}"!`);
              setSelectedListing(null);
              fetchListings();
            } catch (err: any) {
              toast.error(err.message || 'Failed to purchase');
            }
          },
        },
      ],
    );
  };

  const renderListing = ({ item }: { item: MarketplaceListing }) => {
    const statusColor = STATUS_COLORS[item.status] || colors.textMuted;

    return (
      <TouchableOpacity
        style={styles.listingCard}
        onPress={() => setSelectedListing(item)}
        activeOpacity={0.7}
      >
        <View style={styles.listingImageContainer}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.listingImage} />
          ) : (
            <View style={styles.listingImagePlaceholder}>
              <Ionicons name="pricetag-outline" size={28} color={colors.textMuted} />
            </View>
          )}
          {item.status !== 'active' && (
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
          )}
        </View>

        <View style={styles.listingInfo}>
          <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.coinEmoji}>{'\u{1FA99}'}</Text>
            <Text style={styles.priceText}>{item.price.toLocaleString()}</Text>
          </View>
          <Text style={styles.sellerText} numberOfLines={1}>{item.sellerName || 'Unknown'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
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
    gridContent: {
      padding: spacing.md,
      paddingBottom: 80,
    },
    gridRow: {
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    listingCard: {
      flex: 1,
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    listingImageContainer: {
      height: 120,
      backgroundColor: colors.bgTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listingImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    listingImagePlaceholder: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    statusBadge: {
      position: 'absolute',
      top: spacing.xs,
      right: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.full,
    },
    statusText: {
      color: colors.white,
      fontSize: fontSize.xs,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    listingInfo: {
      padding: spacing.md,
    },
    listingTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    coinEmoji: {
      fontSize: fontSize.sm,
    },
    priceText: {
      color: colors.warning,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    sellerText: {
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
    postButton: {
      color: colors.accentPrimary,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    postButtonDisabled: {
      color: colors.textMuted,
    },
    // Detail content
    detailScroll: {
      flex: 1,
    },
    detailImageContainer: {
      height: 200,
      backgroundColor: colors.bgTertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    detailImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    detailBody: {
      padding: spacing.lg,
    },
    detailTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    detailPriceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    detailPrice: {
      color: colors.warning,
      fontSize: fontSize.xl,
      fontWeight: '700',
    },
    detailMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.lg,
    },
    detailSeller: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    detailDot: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
    detailDate: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
    detailDescription: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      lineHeight: 22,
      marginBottom: spacing.xl,
    },
    purchaseButton: {
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    purchaseButtonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    // Create listing form
    formScrollContent: {
      padding: spacing.lg,
      gap: spacing.lg,
    },
    inputLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    textInput: {
      backgroundColor: colors.inputBg,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    categoryChip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryChipActive: {
      backgroundColor: colors.accentPrimary,
      borderColor: colors.accentPrimary,
    },
    categoryChipText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    categoryChipTextActive: {
      color: colors.white,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  return (
    <PatternBackground>
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

      {/* Listings grid */}
      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={renderListing}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchListings(); }}
            tintColor={colors.accentPrimary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="storefront-outline"
            title="No listings"
            subtitle="Be the first to list something for sale!"
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowNewListing(true)}
        accessibilityLabel="Edit listing"
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Listing Detail Modal */}
      <Modal visible={!!selectedListing} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedListing(null)} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {selectedListing?.title}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            {selectedListing && (
              <ScrollView style={styles.detailScroll}>
                <View style={styles.detailImageContainer}>
                  {selectedListing.imageUrl ? (
                    <Image source={{ uri: selectedListing.imageUrl }} style={styles.detailImage} />
                  ) : (
                    <Ionicons name="pricetag-outline" size={48} color={colors.textMuted} />
                  )}
                </View>

                <View style={styles.detailBody}>
                  <Text style={styles.detailTitle}>{selectedListing.title}</Text>
                  <View style={styles.detailPriceRow}>
                    <Text style={styles.coinEmoji}>{'\u{1FA99}'}</Text>
                    <Text style={styles.detailPrice}>{selectedListing.price.toLocaleString()}</Text>
                  </View>
                  <View style={styles.detailMeta}>
                    <Text style={styles.detailSeller}>{selectedListing.sellerName || 'Unknown'}</Text>
                    <Text style={styles.detailDot}>{'\u00B7'}</Text>
                    <Text style={styles.detailDate}>{formatRelativeTime(selectedListing.createdAt)}</Text>
                  </View>
                  <Text style={styles.detailDescription}>{selectedListing.description}</Text>

                  {selectedListing.status === 'active' && (
                    <TouchableOpacity
                      style={styles.purchaseButton}
                      onPress={() => handlePurchase(selectedListing)}
                    >
                      <Text style={styles.purchaseButtonText}>Purchase</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* New Listing Modal */}
      <Modal visible={showNewListing} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowNewListing(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>New Listing</Text>
              <TouchableOpacity
                onPress={handleCreateListing}
                disabled={creating || !newTitle.trim() || !newDescription.trim() || !newPrice.trim()}
              >
                <Text
                  style={[
                    styles.postButton,
                    (!newTitle.trim() || !newDescription.trim() || !newPrice.trim() || creating) && styles.postButtonDisabled,
                  ]}
                >
                  {creating ? 'Listing...' : 'List'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formScrollContent}>
              <View>
                <Text style={styles.inputLabel}>Title</Text>
                <TextInput
                  style={styles.textInput}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="What are you selling?"
                  placeholderTextColor={colors.textMuted}
                  maxLength={200}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, { minHeight: 100 }]}
                  value={newDescription}
                  onChangeText={setNewDescription}
                  placeholder="Describe your item..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={4000}
                  textAlignVertical="top"
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Price (coins)</Text>
                <TextInput
                  style={styles.textInput}
                  value={newPrice}
                  onChangeText={setNewPrice}
                  placeholder="100"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.categoryRow}>
                  {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryChip, newCategory === cat && styles.categoryChipActive]}
                      onPress={() => setNewCategory(cat)}
                    >
                      <Text
                        style={[styles.categoryChipText, newCategory === cat && styles.categoryChipTextActive]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </PatternBackground>
  );
}
