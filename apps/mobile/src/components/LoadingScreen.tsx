import React, { useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../lib/theme';

export default function LoadingScreen() {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accentPrimary} />
    </View>
  );
}
