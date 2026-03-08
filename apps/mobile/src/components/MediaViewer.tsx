import React, { useMemo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, Modal, Text, FlatList, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface MediaViewerProps {
  visible: boolean;
  urls: string[];
  initialIndex?: number;
  onClose: () => void;
}

export default function MediaViewer({ visible, urls, initialIndex = 0, onClose }: MediaViewerProps) {
  const { colors, spacing } = useTheme();
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);

  React.useEffect(() => {
    if (visible) setCurrentIndex(initialIndex);
  }, [visible, initialIndex]);

  if (!visible || urls.length === 0) return null;

  const handleShare = async () => {
    try {
      const url = urls[currentIndex];
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(url);
      }
    } catch {
      // ignore
    }
  };

  const handleSave = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library access is needed to save images.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(urls[currentIndex]);
      Alert.alert('Saved', 'Image saved to your photo library.');
    } catch {
      Alert.alert('Error', 'Failed to save image.');
    }
  };

  const renderItem = ({ item }: { item: string }) => {
    return (
      <View style={{ width: SCREEN_W, height: SCREEN_H, justifyContent: 'center', alignItems: 'center' }}>
        <Image
          source={{ uri: item }}
          style={{ width: SCREEN_W, height: SCREEN_H * 0.75 }}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' }}>
        {/* Header */}
        <View style={{
          position: 'absolute', top: 50, left: 0, right: 0, zIndex: 10,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: spacing.lg,
        }}>
          <TouchableOpacity onPress={onClose} style={{ padding: spacing.sm }}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {urls.length > 1 && (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              {currentIndex + 1} / {urls.length}
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <TouchableOpacity onPress={handleShare} style={{ padding: spacing.sm }}>
              <Ionicons name="share-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={{ padding: spacing.sm }}>
              <Ionicons name="download-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Image gallery */}
        <FlatList
          data={urls}
          renderItem={renderItem}
          keyExtractor={(item, idx) => `${item}-${idx}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: SCREEN_W, offset: SCREEN_W * index, index })}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            setCurrentIndex(idx);
          }}
        />
      </View>
    </Modal>
  );
}
