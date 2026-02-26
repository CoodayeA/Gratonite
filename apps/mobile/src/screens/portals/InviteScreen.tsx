import React, { useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PortalsStackParamList } from '../../navigation/types';
import { Image } from 'expo-image';
import { invitesApi, getFileUrl } from '../../lib/api';
import { colors, fontSize, spacing, radius } from '../../theme';

type Nav = NativeStackNavigationProp<PortalsStackParamList, 'Invite'>;
type Route = RouteProp<PortalsStackParamList, 'Invite'>;

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 45%)`;
}

function guildInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function InviteScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const queryClient = useQueryClient();
  const { code } = route.params;

  const { data: invite, isLoading, error } = useQuery<{
    code: string;
    guild: {
      id: string;
      name: string;
      description?: string | null;
      memberCount?: number;
      iconHash?: string | null;
    };
  }>({
    queryKey: ['invite', code],
    queryFn: () => invitesApi.get(code),
  });

  const acceptMutation = useMutation({
    mutationFn: () => invitesApi.accept(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guilds'] });
      Alert.alert('Joined!', `You joined ${invite?.guild?.name ?? 'the portal'}.`, [
        {
          text: 'OK',
          onPress: () => {
            if (invite?.guild?.id) {
              navigation.navigate('Guild', { guildId: invite.guild.id });
            } else {
              navigation.goBack();
            }
          },
        },
      ]);
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message);
    },
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Invite',
    });
  }, [navigation]);

  const handleAccept = useCallback(() => {
    acceptMutation.mutate();
  }, [acceptMutation]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  if (error || !invite) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.errorTitle}>Invalid Invite</Text>
          <Text style={styles.errorSubtitle}>
            This invite may have expired or is no longer valid.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const guild = invite.guild;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.inviteCard}>
          <Text style={styles.inviteLabel}>You have been invited to join</Text>
          {guild.iconHash ? (
            <Image
              source={{ uri: getFileUrl(guild.iconHash) }}
              style={[styles.guildIcon, { backgroundColor: stringToColor(guild.id) }]}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View
              style={[
                styles.guildIcon,
                { backgroundColor: stringToColor(guild.id) },
              ]}
            >
              <Text style={styles.guildIconText}>
                {guildInitials(guild.name)}
              </Text>
            </View>
          )}
          <Text style={styles.guildName}>{guild.name}</Text>
          {guild.description ? (
            <Text style={styles.guildDescription}>{guild.description}</Text>
          ) : null}
          {guild.memberCount != null && (
            <Text style={styles.memberCount}>
              {guild.memberCount} members
            </Text>
          )}
          <TouchableOpacity
            style={[
              styles.joinButton,
              acceptMutation.isPending && styles.joinButtonDisabled,
            ]}
            onPress={handleAccept}
            disabled={acceptMutation.isPending}
            activeOpacity={0.7}
          >
            <Text style={styles.joinButtonText}>
              {acceptMutation.isPending ? 'Joining...' : 'Accept Invite'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  inviteCard: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.xl,
    padding: spacing['3xl'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    width: '100%',
    maxWidth: 340,
  },
  inviteLabel: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    marginBottom: spacing.xl,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  guildIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  guildIconText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  guildName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  guildDescription: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  memberCount: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    marginBottom: spacing.xl,
  },
  joinButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  joinButtonDisabled: {
    opacity: 0.5,
  },
  joinButtonText: {
    color: '#ffffff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  errorSubtitle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  backButton: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  backButtonText: {
    color: colors.text.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
