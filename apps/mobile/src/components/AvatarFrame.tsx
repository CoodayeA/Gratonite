import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

interface AvatarFrameProps {
  size: number;
  frameUrl?: string | null;
  children: React.ReactNode;
}

export default function AvatarFrame({ size, frameUrl, children }: AvatarFrameProps) {
  if (!frameUrl) {
    return <>{children}</>;
  }

  const frameSize = size + 8;
  const frameOffset = -4;

  return (
    <View style={[styles.container, { width: frameSize, height: frameSize }]}>
      <View style={styles.childWrapper}>
        {children}
      </View>
      <Image
        source={{ uri: frameUrl }}
        style={[
          styles.frame,
          {
            width: frameSize,
            height: frameSize,
            top: frameOffset,
            left: frameOffset,
            borderRadius: frameSize / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  childWrapper: {
    position: 'relative',
  },
  frame: {
    position: 'absolute',
    resizeMode: 'contain',
  },
});
