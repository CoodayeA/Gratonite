import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSocket } from '../lib/socket';
import { useTheme } from '../lib/theme';

export function useIsOnline(): boolean {
  const [isConnected, setIsConnected] = useState(true);
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    setIsConnected(socket.connected);
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);
  return isConnected;
}

export default function OfflineBanner() {
  const [isConnected, setIsConnected] = useState(true);
  const insets = useSafeAreaInsets();
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    setIsConnected(socket.connected);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  const styles = useMemo(() => StyleSheet.create({
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
      ...(neo ? { borderBottomWidth: 2, borderBottomColor: colors.border } : {}),
    },
    text: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: neo ? '700' : '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (isConnected) return null;

  return (
    <Animated.View
      entering={SlideInUp.duration(300)}
      exiting={SlideOutUp.duration(300)}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <View style={styles.banner}>
        <Text style={styles.text}>Connecting...</Text>
      </View>
    </Animated.View>
  );
}
