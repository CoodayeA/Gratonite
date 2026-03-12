import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { clips } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import { mediumImpact } from '../../lib/haptics';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { Clip } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'Clips'>;

export default function ClipsScreen({ route }: Props) {
  const { guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [items, setItems] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const fetchClips = useCallback(async () => {
    try {
      const data = await clips.list(guildId);
      setItems(data);
    } catch {
      toast.error('Failed to load clips');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId]);

  useEffect(() => { fetchClips(); }, [fetchClips]);

  const handleDelete = (clipId: string) => {
    Alert.alert('Delete Clip', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await clips.delete(guildId, clipId);
          toast.success('Clip deleted');
          fetchClips();
        } catch { toast.error('Failed to delete'); }
      }},
    ]);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    card: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.bgElevated, borderRadius: neo ? 0 : borderRadius.lg, padding: spacing.lg, gap: spacing.md, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentPrimary, justifyContent: 'center', alignItems: 'center', ...(neo ? { borderRadius: 0 } : {}) },
    info: { flex: 1 },
    title: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textPrimary },
    meta: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
    deleteBtn: { padding: spacing.xs },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  return (
    <PatternBackground>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity style={styles.playBtn} onPress={() => { mediumImpact(); setPlayingId(playingId === item.id ? null : item.id); }}>
              <Ionicons name={playingId === item.id ? 'pause' : 'play'} size={22} color={colors.white} />
            </TouchableOpacity>
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.meta}>{item.creatorName || 'Unknown'} · {formatDuration(item.duration)} · {item.channelName || 'Voice'}</Text>
              <Text style={styles.meta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="videocam-outline" title="No clips" subtitle="Record clips from voice channels" />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchClips(); }} tintColor={colors.accentPrimary} />}
      />
    </PatternBackground>
  );
}
