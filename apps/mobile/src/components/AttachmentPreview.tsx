import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import type { Attachment } from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface AttachmentPreviewProps {
  attachment: Attachment;
  onImagePress?: (url: string, allImageUrls?: string[], imageIndex?: number) => void;
  allImageUrls?: string[];
  imageIndex?: number;
}

export default function AttachmentPreview({ attachment, onImagePress, allImageUrls, imageIndex }: AttachmentPreviewProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const contentType = attachment.contentType ?? '';
  const fileName = attachment.filename || 'Attachment';
  const fileSize = typeof attachment.size === 'number' ? attachment.size : 0;
  const isImage = contentType.startsWith('image/');
  const isVideo = contentType.startsWith('video/');
  const isAudio = contentType.startsWith('audio/');

  const styles = useMemo(() => StyleSheet.create({
    fileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      gap: spacing.md,
      maxWidth: SCREEN_WIDTH * 0.7,
    },
    fileInfo: {
      flex: 1,
    },
    fileName: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontWeight: '500',
    },
    fileSize: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (isImage) {
    const maxW = SCREEN_WIDTH * 0.65;
    const ratio = attachment.width && attachment.height ? attachment.height / attachment.width : 0.75;
    const w = Math.min(maxW, attachment.width || maxW);
    const h = w * ratio;

    return (
      <TouchableOpacity onPress={() => onImagePress?.(attachment.url, allImageUrls, imageIndex)} activeOpacity={0.9}>
        <Image
          source={{ uri: attachment.url }}
          style={{ width: w, height: h, borderRadius: borderRadius.md }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      </TouchableOpacity>
    );
  }

  if (isVideo || isAudio) {
    return (
      <TouchableOpacity
        style={styles.fileCard}
        onPress={() => Linking.openURL(attachment.url)}
      >
        <Ionicons
          name={isVideo ? 'videocam-outline' : 'musical-notes-outline'}
          size={24}
          color={colors.accentPrimary}
        />
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
          <Text style={styles.fileSize}>{formatFileSize(fileSize)}</Text>
        </View>
        <Ionicons name="play-circle-outline" size={24} color={colors.textMuted} />
      </TouchableOpacity>
    );
  }

  // Generic file
  return (
    <TouchableOpacity
      style={styles.fileCard}
      onPress={() => Linking.openURL(attachment.url)}
    >
      <Ionicons name="document-outline" size={24} color={colors.accentPrimary} />
      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
        <Text style={styles.fileSize}>{formatFileSize(fileSize)}</Text>
      </View>
      <Ionicons name="download-outline" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
