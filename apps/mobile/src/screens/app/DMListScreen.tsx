import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { relationships as relApi } from '../../lib/api';
import { colors, spacing, fontSize, borderRadius } from '../../lib/theme';
import type { DMChannel } from '../../types';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppTabParamList, AppStackParamList } from '../../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'DMs'>,
  NativeStackScreenProps<AppStackParamList>
>;

export default function DMListScreen({ navigation }: Props) {
  const [channels, setChannels] = useState<DMChannel[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDMs = useCallback(async () => {
    try {
      const data = await relApi.getDMChannels();
      setChannels(data);
    } catch (err: any) {
      if (err.status !== 401) {
        Alert.alert('Error', 'Failed to load messages');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDMs();
  }, [fetchDMs]);

  const renderItem = ({ item }: { item: DMChannel }) => {
    const name = item.recipient?.displayName || item.recipient?.username || 'Unknown';

    return (
      <TouchableOpacity
        style={styles.dmItem}
        onPress={() => navigation.navigate('DirectMessage', {
          channelId: item.id,
          recipientName: name,
        })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.dmInfo}>
          <Text style={styles.dmName} numberOfLines={1}>{name}</Text>
          {item.lastMessageAt && (
            <Text style={styles.dmMeta} numberOfLines={1}>
              {new Date(item.lastMessageAt).toLocaleDateString()}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      <FlatList
        data={channels}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDMs(); }} tintColor={colors.accentPrimary} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>Start a conversation from the Friends tab</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  list: {
    paddingTop: spacing.sm,
  },
  dmItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  dmInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  dmName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  dmMeta: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: spacing.md,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
  },
});
