import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../lib/theme';
import Avatar from '../../components/Avatar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'Settings'>;

interface SettingsRow {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  screen: keyof AppStackParamList;
}

const SETTINGS_ROWS: SettingsRow[] = [
  { icon: 'person-outline', label: 'Account', screen: 'SettingsAccount' },
  { icon: 'color-palette-outline', label: 'Appearance', screen: 'SettingsAppearance' },
  { icon: 'notifications-outline', label: 'Notifications', screen: 'SettingsNotifications' },
  { icon: 'shield-outline', label: 'Privacy', screen: 'SettingsPrivacy' },
  { icon: 'phone-portrait-outline', label: 'Sessions', screen: 'SettingsSessions' },
  { icon: 'volume-mute-outline', label: 'Muted Users', screen: 'SettingsMutedUsers' },
];

export default function SettingsScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const { colors, spacing, fontSize, borderRadius } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    userHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    userInfo: {
      marginLeft: spacing.lg,
      flex: 1,
    },
    displayName: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    username: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },
    section: {
      marginTop: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      gap: spacing.md,
    },
    rowLabel: {
      flex: 1,
      fontSize: fontSize.md,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    logoutSection: {
      marginTop: spacing.xxxl,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.bgElevated,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.md,
    },
    logoutText: {
      color: colors.error,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius]);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch {
            // ignore
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* User info header */}
      {user && (
        <View style={styles.userHeader}>
          <Avatar
            userId={user.id}
            avatarHash={user.avatarHash}
            name={user.displayName || user.username}
            size={56}
            showStatus
            statusOverride={user.status}
          />
          <View style={styles.userInfo}>
            <Text style={styles.displayName}>
              {user.displayName || user.username}
            </Text>
            <Text style={styles.username}>@{user.username}</Text>
          </View>
        </View>
      )}

      {/* Settings rows */}
      <View style={styles.section}>
        {SETTINGS_ROWS.map((row) => (
          <TouchableOpacity
            key={row.screen}
            style={styles.row}
            onPress={() => navigation.navigate(row.screen as any)}
            activeOpacity={0.6}
          >
            <Ionicons name={row.icon} size={22} color={colors.textSecondary} />
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <View style={styles.logoutSection}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
