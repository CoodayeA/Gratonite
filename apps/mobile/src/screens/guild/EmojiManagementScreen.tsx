import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { guildEmojis as guildEmojisApi, API_BASE } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { GuildEmoji } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'EmojiManagement'>;

export default function EmojiManagementScreen({ route }: Props) {
  const { guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const toast = useToast();
  const [emojis, setEmojis] = useState<GuildEmoji[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchEmojis = useCallback(async () => {
    try {
      const data = await guildEmojisApi.list(guildId);
      setEmojis(data);
    } catch (err: any) {
      // silently ignore — empty state handles no data
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchEmojis();
  }, [fetchEmojis]);

  const handleUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    Alert.prompt(
      'Emoji Name',
      'Enter a name for this emoji (letters, numbers, underscores)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upload',
          onPress: async (name?: string) => {
            const emojiName = name?.trim();
            if (!emojiName) {
              toast.error('Please enter a name');
              return;
            }

            setUploading(true);
            try {
              const asset = result.assets[0];
              const formData = new FormData();
              formData.append('name', emojiName);
              formData.append('file', {
                uri: asset.uri,
                type: asset.mimeType || 'image/png',
                name: `${emojiName}.png`,
              } as any);

              const emoji = await guildEmojisApi.upload(guildId, formData);
              setEmojis((prev) => [...prev, emoji]);
              toast.success(`Added :${emojiName}:`);
            } catch (err: any) {
              toast.error(err.message || 'Failed to upload emoji');
            } finally {
              setUploading(false);
            }
          },
        },
      ],
      'plain-text',
    );
  };

  const handleDelete = (emoji: GuildEmoji) => {
    Alert.alert(
      'Delete Emoji',
      `Remove :${emoji.name}: from this portal?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await guildEmojisApi.delete(guildId, emoji.id);
              setEmojis((prev) => prev.filter((e) => e.id !== emoji.id));
            } catch (err: any) {
              toast.error(err.message || 'Failed to delete emoji');
            }
          },
        },
      ],
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerCount: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    uploadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.accentPrimary,
      borderRadius: borderRadius.md,
    },
    uploadBtnDisabled: {
      opacity: 0.5,
    },
    uploadBtnText: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: '700',
    },
    gridContent: {
      padding: spacing.md,
      paddingBottom: spacing.xxxl,
    },
    emojiCell: {
      flex: 1,
      alignItems: 'center',
      margin: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.md,
    },
    emojiImage: {
      width: 48,
      height: 48,
    },
    emojiName: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    deleteIcon: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: colors.bgPrimary,
      borderRadius: 10,
    },
  }), [colors, spacing, fontSize, borderRadius]);

  const renderEmoji = ({ item }: { item: GuildEmoji }) => (
    <View style={styles.emojiCell}>
      <Image
        source={{ uri: `${API_BASE}/files/${item.imageHash}` }}
        style={styles.emojiImage}
        resizeMode="contain"
      />
      <Text style={styles.emojiName} numberOfLines={1}>:{item.name}:</Text>
      <TouchableOpacity style={styles.deleteIcon} onPress={() => handleDelete(item)}>
        <Ionicons name="close-circle" size={20} color={colors.error} />
      </TouchableOpacity>
    </View>
  );

  if (loading) return <LoadingScreen />;

  return (
    <PatternBackground>
      <View style={styles.header}>
        <Text style={styles.headerCount}>{emojis.length} emoji{emojis.length !== 1 ? 's' : ''}</Text>
        <TouchableOpacity
          style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
          onPress={handleUpload}
          disabled={uploading}
        >
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.uploadBtnText}>{uploading ? 'Uploading...' : 'Upload'}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={emojis}
        keyExtractor={(item) => item.id}
        renderItem={renderEmoji}
        numColumns={4}
        contentContainerStyle={styles.gridContent}
        ListEmptyComponent={
          <EmptyState
            icon="happy-outline"
            title="No custom emojis"
            subtitle="Upload emojis to use in this portal"
          />
        }
      />
    </PatternBackground>
  );
}
