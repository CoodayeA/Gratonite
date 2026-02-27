import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, fontSize } from '../../theme';

type Nav = NativeStackNavigationProp<any>;
type RouteProps = RouteProp<{ params: { guildId: string } }, 'params'>;

interface SoundboardSound {
  id: string;
  name: string;
  emoji: string;
  duration: number;
  plays: number;
  category?: string;
}

export function SoundboardScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { guildId } = route.params;
  const [sounds, setSounds] = useState<SoundboardSound[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);

  React.useEffect(() => {
    async function fetchSounds() {
      if (!guildId) return;
      try {
        const res = await fetch(`/api/v1/guilds/${guildId}/soundboard`, { credentials: 'include' });
        const data = await res.json();
        setSounds(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchSounds();
  }, [guildId]);

  const playSound = async (soundId: string) => {
    setPlayingId(soundId);
    try {
      await fetch(`/api/v1/soundboard/${soundId}/play`, { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => setPlayingId(null), 2000);
  };

  const renderSound = ({ item }: { item: SoundboardSound }) => (
    <TouchableOpacity
      style={[styles.soundButton, playingId === item.id && styles.playingButton]}
      onPress={() => playSound(item.id)}
      disabled={playingId !== null}
    >
      <Text style={styles.soundEmoji}>{item.emoji}</Text>
      <Text style={styles.soundName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.soundDuration}>{Math.round(item.duration)}s</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Soundboard</Text>
      </View>
      <View style={styles.grid}>
        <FlatList
          data={sounds}
          renderItem={renderSound}
          keyExtractor={(item) => item.id}
          numColumns={3}
          ListEmptyComponent={<Text style={styles.emptyText}>No sounds available</Text>}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.stroke.primary },
  headerTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text.primary },
  grid: { flex: 1, padding: spacing.sm },
  soundButton: { flex: 1, aspectRatio: 1, margin: spacing.xs, backgroundColor: colors.bg.secondary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', padding: spacing.sm },
  playingButton: { backgroundColor: colors.brand.primary + '30', transform: [{ scale: 1.05 }] },
  soundEmoji: { fontSize: 32, marginBottom: spacing.xs },
  soundName: { fontSize: fontSize.xs, color: colors.text.primary, textAlign: 'center', fontWeight: '500' },
  soundDuration: { fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 },
  emptyText: { color: colors.text.muted, textAlign: 'center', marginTop: spacing.xl },
});
