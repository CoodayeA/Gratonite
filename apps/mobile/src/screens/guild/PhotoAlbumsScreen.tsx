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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { photoAlbums as albumsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import LoadErrorCard from '../../components/LoadErrorCard';
import type { PhotoAlbum, PhotoAlbumItem } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'PhotoAlbums'>;

export default function PhotoAlbumsScreen({ route }: Props) {
  const { guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detailAlbum, setDetailAlbum] = useState<PhotoAlbum | null>(null);
  const [detailItems, setDetailItems] = useState<PhotoAlbumItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchAlbums = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await albumsApi.list(guildId);
      setAlbums(data);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load albums';
        if (refreshing || albums.length > 0) {
          toast.error(message);
        } else {
          setLoadError(message);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  const openAlbumDetail = async (album: PhotoAlbum) => {
    setDetailAlbum(album);
    setDetailLoading(true);
    try {
      const items = await albumsApi.getItems(guildId, album.id);
      setDetailItems(items);
    } catch {
      toast.error('Failed to load photos');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error('Album name is required');
      return;
    }
    setCreating(true);
    try {
      await albumsApi.create(guildId, { name: newName.trim(), description: newDesc.trim() || undefined });
      setCreateVisible(false);
      setNewName('');
      setNewDesc('');
      fetchAlbums();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create album');
    } finally {
      setCreating(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    grid: {
      padding: spacing.sm,
      paddingBottom: spacing.xxxl,
    },
    albumCard: {
      flex: 1,
      margin: spacing.xs,
      borderRadius: borderRadius.md,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    coverImage: {
      width: '100%',
      height: 120,
      backgroundColor: colors.bgSecondary,
    },
    albumInfo: {
      padding: spacing.md,
    },
    albumName: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    albumCount: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
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
    modalClose: {
      position: 'absolute',
      right: spacing.lg,
      top: spacing.lg,
      zIndex: 1,
    },
    photoGrid: {
      paddingTop: spacing.md,
      paddingBottom: spacing.xxxl,
    },
    photoItem: {
      flex: 1,
      margin: spacing.xs,
      aspectRatio: 1,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.bgSecondary,
    },
    photoImage: {
      width: '100%',
      height: '100%',
      borderRadius: borderRadius.sm,
    },
    label: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      marginBottom: spacing.xs,
      marginTop: spacing.md,
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
    createButton: {
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    createButtonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '700',
    },
    emptyPhotos: {
      alignItems: 'center',
      paddingTop: 40,
      gap: spacing.md,
    },
    emptyPhotosText: {
      color: colors.textMuted,
      fontSize: fontSize.md,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  if (loadError && albums.length === 0) return <LoadErrorCard title="Failed to load albums" message={loadError} onRetry={() => { setLoading(true); fetchAlbums(); }} />;

  return (
    <PatternBackground>
      <FlatList
        data={albums}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAlbums(); }} tintColor={colors.accentPrimary} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.albumCard} onPress={() => openAlbumDetail(item)}>
            {item.coverUrl ? (
              <Image source={{ uri: item.coverUrl }} style={styles.coverImage} />
            ) : (
              <View style={styles.coverImage}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="images-outline" size={32} color={colors.textMuted} />
                </View>
              </View>
            )}
            <View style={styles.albumInfo}>
              <Text style={styles.albumName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.albumCount}>{item.itemCount} items</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="images-outline"
            title="No albums"
            subtitle="Create a photo album to get started"
          />
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setCreateVisible(true)} accessibilityLabel="Create album">
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* Album detail modal */}
      <Modal visible={!!detailAlbum} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { flex: 1, marginTop: 80 }]}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setDetailAlbum(null)} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{detailAlbum?.name}</Text>
            {detailLoading ? (
              <LoadingScreen />
            ) : (
              <FlatList
                data={detailItems}
                keyExtractor={(item) => item.id}
                numColumns={3}
                contentContainerStyle={styles.photoGrid}
                renderItem={({ item }) => (
                  <View style={styles.photoItem}>
                    <Image source={{ uri: item.imageUrl }} style={styles.photoImage} />
                  </View>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyPhotos}>
                    <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
                    <Text style={styles.emptyPhotosText}>No photos yet</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Create album modal */}
      <Modal visible={createVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Album</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="Album name"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="Optional description"
              placeholderTextColor={colors.textMuted}
            />

            <TouchableOpacity style={styles.createButton} onPress={handleCreate} disabled={creating}>
              <Text style={styles.createButtonText}>{creating ? 'Creating...' : 'Create Album'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setCreateVisible(false)} style={{ alignItems: 'center', marginTop: spacing.md }}>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.md }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </PatternBackground>
  );
}
