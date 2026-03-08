import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { userMutes as mutesApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import LoadingScreen from '../../components/LoadingScreen';
import type { UserMute } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'SettingsMutedUsers'>;

export default function SettingsMutedUsersScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [mutes, setMutes] = useState<UserMute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMutes = useCallback(async () => {
    try {
      const data = await mutesApi.list();
      setMutes(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load muted users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMutes();
  }, [fetchMutes]);

  const handleUnmute = (mute: UserMute) => {
    const username = mute.mutedUser?.username || 'this user';
    Alert.alert('Unmute User', `Are you sure you want to unmute ${username}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unmute',
        onPress: async () => {
          try {
            await mutesApi.unmute(mute.mutedUserId);
            setMutes((prev) => prev.filter((m) => m.id !== mute.id));
          } catch (err: any) {
            toast.error(err.message || 'Failed to unmute user');
          }
        },
      },
    ]);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    list: {
      paddingTop: spacing.sm,
      flexGrow: 1,
    },
    muteItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    muteInfo: {
      flex: 1,
    },
    muteName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    muteUsername: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: 1,
    },
    unmuteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.bgElevated,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border } : {}),
    },
    unmuteText: {
      color: colors.accentPrimary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderItem = ({ item }: { item: UserMute }) => {
    const user = item.mutedUser;
    const name = user?.displayName || user?.username || 'Unknown User';

    return (
      <View style={styles.muteItem}>
        <Avatar
          userId={user?.id}
          avatarHash={user?.avatarHash}
          name={name}
          size={40}
        />
        <View style={styles.muteInfo}>
          <Text style={styles.muteName}>{name}</Text>
          {user?.username && (
            <Text style={styles.muteUsername}>@{user.username}</Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.unmuteButton}
          onPress={() => handleUnmute(item)}
        >
          <Ionicons name="volume-high-outline" size={18} color={colors.accentPrimary} />
          <Text style={styles.unmuteText}>Unmute</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={mutes}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchMutes(); }}
            tintColor={colors.accentPrimary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="volume-mute-outline"
            title="No Muted Users"
            subtitle="Users you mute will appear here"
          />
        }
      />
    </View>
  );
}
