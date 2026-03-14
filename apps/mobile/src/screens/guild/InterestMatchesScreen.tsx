import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { interestTags } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import LoadErrorCard from '../../components/LoadErrorCard';
import Avatar from '../../components/Avatar';
import type { InterestMatch } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'InterestMatches'>;

export default function InterestMatchesScreen({ route, navigation }: Props) {
  const { guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [matches, setMatches] = useState<InterestMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchMatches = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await interestTags.getMatches(guildId);
      setMatches(data);
    } catch (err: any) {
      const message = err?.message || 'Failed to load matches';
      if (refreshing || matches.length > 0) {
        toast.error(message);
      } else {
        setLoadError(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guildId]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md, borderBottomWidth: neo ? 2 : 1, borderBottomColor: colors.border },
    info: { flex: 1 },
    name: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textPrimary },
    interests: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
    matchCount: { backgroundColor: colors.accentPrimary + '20', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: neo ? 0 : borderRadius.full },
    matchCountText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.accentPrimary },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  if (loadError && matches.length === 0) return <LoadErrorCard title="Failed to load matches" message={loadError} onRetry={() => { setLoading(true); fetchMatches(); }} />;

  return (
    <PatternBackground>
      <FlatList
        data={matches}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar userId={item.userId} avatarHash={item.avatarHash} name={item.displayName || item.username} size={40} />
            <View style={styles.info}>
              <Text style={styles.name}>{item.displayName || item.username}</Text>
              <Text style={styles.interests} numberOfLines={1}>{item.sharedInterests.join(', ')}</Text>
            </View>
            <View style={styles.matchCount}>
              <Text style={styles.matchCountText}>{item.sharedInterests.length} shared</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="heart-outline" title="No matches" subtitle="Add interests to find like-minded members" />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMatches(); }} tintColor={colors.accentPrimary} />}
      />
    </PatternBackground>
  );
}
