import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Modal } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface MediaViewerProps {
  visible: boolean;
  url: string;
  onClose: () => void;
}

export default function MediaViewer({ visible, url, onClose }: MediaViewerProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  if (!visible) return null;

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.95)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeBtn: {
      position: 'absolute',
      top: 50,
      right: spacing.lg,
      zIndex: 10,
      padding: spacing.sm,
    },
    image: {
      width: SCREEN_W,
      height: SCREEN_H * 0.8,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Ionicons name="close" size={28} color={colors.white} />
        </TouchableOpacity>
        <Image
          source={{ uri: url }}
          style={styles.image}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      </View>
    </Modal>
  );
}
