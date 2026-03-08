import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, spacing, fontSize } from '../lib/theme';

interface DisappearTimerProps {
  createdAt: string;
  disappearTimer: number; // seconds
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'expired';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function DisappearTimer({ createdAt, disappearTimer }: DisappearTimerProps) {
  const colors = useColors();
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    const expiresAt = new Date(createdAt).getTime() + disappearTimer * 1000;
    const update = () => setRemaining(expiresAt - Date.now());
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [createdAt, disappearTimer]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 40,
      marginTop: 2,
      gap: 4,
    },
    text: {
      color: remaining <= 0 ? colors.error : colors.textMuted,
      fontSize: fontSize.xs,
    },
  }), [colors, remaining]);

  return (
    <View style={styles.container}>
      <Ionicons name="time-outline" size={12} color={remaining <= 0 ? colors.error : colors.textMuted} />
      <Text style={styles.text}>
        {remaining <= 0 ? 'expired' : `expires in ${formatCountdown(remaining)}`}
      </Text>
    </View>
  );
}
