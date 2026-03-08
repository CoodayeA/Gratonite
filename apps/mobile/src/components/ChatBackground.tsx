import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

interface ChatBackgroundProps {
  url: string;
  type: 'image' | 'video';
}

export default function ChatBackground({ url, type }: ChatBackgroundProps) {
  // expo-image handles images and animated GIFs. Video URLs render as a still frame.
  return (
    <View style={styles.container} pointerEvents="none">
      <Image
        source={{ uri: url }}
        style={styles.media}
        contentFit="cover"
      />
      <View style={styles.overlay} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  media: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
});
