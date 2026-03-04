import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSocket } from '../lib/socket';
import { colors, fontSize } from '../lib/theme';

export default function OfflineBanner() {
  const [isConnected, setIsConnected] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Poll socket connection state
    const interval = setInterval(() => {
      const socket = getSocket();
      if (socket) {
        setIsConnected(socket.connected);
      } else {
        setIsConnected(true); // Don't show if socket isn't even initialized (e.g. not logged in)
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (isConnected) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.banner}>
        <Text style={styles.text}>Connecting...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  banner: {
    backgroundColor: colors.error,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
