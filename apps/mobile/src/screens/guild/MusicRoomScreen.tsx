import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, RefreshControl, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { musicRooms } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import { mediumImpact } from '../../lib/haptics';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import type { MusicQueue } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'MusicRoom'>;

export default function MusicRoomScreen({ route }: Props) {
  const { channelId, channelName } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [queue, setQueue] = useState<MusicQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchQueue = useCallback(async () => {
    try {
      const data = await musicRooms.getState(channelId);
      setQueue(data);
    } catch {
      toast.error('Failed to load music queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [channelId]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const handleAdd = async () => {
    if (!addUrl.trim() || !addTitle.trim()) return;
    setAdding(true);
    try {
      await musicRooms.addTrack(channelId, { url: addUrl.trim(), title: addTitle.trim() });
      setAddUrl('');
      setAddTitle('');
      toast.success('Track added to queue');
      fetchQueue();
    } catch {
      toast.error('Failed to add track');
    } finally {
      setAdding(false);
    }
  };

  const handleSkip = async () => {
    mediumImpact();
    try {
      await musicRooms.skip(channelId);
      toast.success('Skipped');
      fetchQueue();
    } catch {
      toast.error('Failed to skip');
    }
  };

  const handleRemoveTrack = async (trackId: string) => {
    mediumImpact();
    try {
      await musicRooms.removeTrack(channelId, trackId);
      toast.success('Track removed');
      fetchQueue();
    } catch {
      toast.error('Failed to remove track');
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    nowPlaying: { padding: spacing.xl, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
    nowPlayingLabel: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
    trackTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
    trackArtist: { fontSize: fontSize.md, color: colors.textSecondary },
    controls: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center', marginTop: spacing.md },
    controlBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bgElevated, justifyContent: 'center', alignItems: 'center', ...(neo ? { borderWidth: 2, borderColor: colors.border, borderRadius: 0 } : {}) },
    removeBtn: { padding: 4 },
    addRow: { flexDirection: 'row', padding: spacing.lg, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
    addInput: { flex: 1, backgroundColor: colors.bgElevated, borderRadius: neo ? 0 : borderRadius.md, padding: spacing.md, color: colors.textPrimary, fontSize: fontSize.sm, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    addBtn: { backgroundColor: colors.accentPrimary, borderRadius: neo ? 0 : borderRadius.md, paddingHorizontal: spacing.lg, justifyContent: 'center', ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    addBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSize.sm },
    queueHeader: { padding: spacing.lg, paddingBottom: spacing.sm },
    queueHeaderText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
    trackRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    trackInfo: { flex: 1 },
    trackName: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
    trackMeta: { fontSize: fontSize.xs, color: colors.textMuted },
    noTrack: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.md },
    noTrackText: { fontSize: fontSize.md, color: colors.textMuted },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  const currentTrack = queue?.queue?.[0] ?? null;
  const upcomingQueue = queue?.queue?.slice(1) ?? [];

  return (
    <PatternBackground>
      <View style={styles.nowPlaying}>
        {currentTrack ? (
          <>
            <Text style={styles.nowPlayingLabel}>Now Playing</Text>
            <Ionicons name="musical-notes" size={40} color={colors.accentPrimary} />
            <Text style={styles.trackTitle} numberOfLines={2}>{currentTrack.title}</Text>
            <Text style={styles.trackArtist}>{formatDuration(currentTrack.duration)}</Text>
            <View style={styles.controls}>
              <TouchableOpacity style={styles.controlBtn} onPress={handleSkip}>
                <Ionicons name="play-skip-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.noTrack}>
            <Ionicons name="musical-notes-outline" size={48} color={colors.textMuted} />
            <Text style={styles.noTrackText}>No track playing</Text>
          </View>
        )}
      </View>

      <View style={styles.addRow}>
        <View style={{ flex: 1, gap: 8 }}>
          <TextInput
            style={styles.addInput}
            placeholder="Track title"
            placeholderTextColor={colors.textMuted}
            value={addTitle}
            onChangeText={setAddTitle}
          />
          <TextInput
            style={styles.addInput}
            placeholder="Paste a music URL..."
            placeholderTextColor={colors.textMuted}
            value={addUrl}
            onChangeText={setAddUrl}
            autoCapitalize="none"
          />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={adding}>
          <Text style={styles.addBtnText}>{adding ? '...' : 'Add'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.queueHeader}>
        <Text style={styles.queueHeaderText}>Queue ({upcomingQueue.length})</Text>
      </View>

      <FlatList
        data={upcomingQueue}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View style={styles.trackRow}>
            <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, width: 24 }}>{index + 1}</Text>
            <Ionicons name="musical-note" size={18} color={colors.textMuted} />
            <View style={styles.trackInfo}>
              <Text style={styles.trackName} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.trackMeta}>{formatDuration(item.duration)} · Added by {item.addedByName || 'Unknown'}</Text>
            </View>
            <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveTrack(item.id)}>
              <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="musical-notes-outline" title="Queue is empty" subtitle="Add a track to get started" />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchQueue(); }} tintColor={colors.accentPrimary} />}
      />
    </PatternBackground>
  );
}
