import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, useGlass } from '../../lib/theme';
import Avatar from '../../components/Avatar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';
import PressableScale from '../../components/PressableScale';
import SectionCard from '../../components/SectionCard';

type Props = NativeStackScreenProps<AppStackParamList, 'Settings'>;

interface SettingsRow {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  screen: keyof AppStackParamList;
}

const ACCOUNT_ROWS: SettingsRow[] = [
  { icon: 'person-outline', label: 'Account', screen: 'SettingsAccount' },
  { icon: 'lock-closed-outline', label: 'Two-Factor Auth', screen: 'MFASetup' },
  { icon: 'shield-checkmark-outline', label: 'Security', screen: 'SettingsSecurity' },
  { icon: 'phone-portrait-outline', label: 'Sessions', screen: 'SettingsSessions' },
  { icon: 'finger-print-outline', label: 'App Lock', screen: 'SettingsAppLock' },
];

const PREFERENCES_ROWS: SettingsRow[] = [
  { icon: 'color-palette-outline', label: 'Appearance', screen: 'SettingsAppearance' },
  { icon: 'notifications-outline', label: 'Notifications', screen: 'SettingsNotifications' },
  { icon: 'musical-notes-outline', label: 'Sound', screen: 'SettingsSound' },
  { icon: 'shield-outline', label: 'Privacy', screen: 'SettingsPrivacy' },
  { icon: 'volume-mute-outline', label: 'Muted Users', screen: 'SettingsMutedUsers' },
  { icon: 'server-outline', label: 'Server', screen: 'SettingsServer' },
  { icon: 'globe-outline', label: 'Federation', screen: 'Federation' },
];

const SOCIAL_ROWS: SettingsRow[] = [
  { icon: 'star-outline', label: 'Fame', screen: 'FameDashboard' },
  { icon: 'trophy-outline', label: 'Achievements', screen: 'Achievements' },
  { icon: 'shirt-outline', label: 'Wardrobe', screen: 'Cosmetics' },
  { icon: 'link-outline', label: 'Connections', screen: 'Connections' },
  { icon: 'pricetag-outline', label: 'Interest Tags', screen: 'InterestTags' },
];

const SUPPORT_ROWS: SettingsRow[] = [
  { icon: 'chatbox-outline', label: 'Feedback', screen: 'Feedback' },
  { icon: 'help-circle-outline', label: 'Help Center', screen: 'HelpCenter' },
  { icon: 'calendar-outline', label: 'Seasonal Events', screen: 'SeasonalEvents' },
  { icon: 'hammer-outline', label: 'Auctions', screen: 'Auctions' },
];

export default function SettingsScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const glass = useGlass();

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
      borderBottomWidth: glass ? 0 : 1,
      borderBottomColor: colors.border,
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: glass.glassBorder,
      } : {}),
      ...(neo ? {
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
        backgroundColor: colors.bgElevated,
      } : {}),
    },
    userInfo: {
      marginLeft: spacing.lg,
      flex: 1,
    },
    displayName: {
      fontSize: fontSize.lg,
      fontWeight: neo ? '900' : '700',
      color: colors.textPrimary,
      ...(neo ? { textTransform: 'uppercase' as const } : {}),
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
      ...(neo ? {
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
      } : {}),
    },
    rowLabel: {
      flex: 1,
      fontSize: neo ? fontSize.sm : fontSize.md,
      color: colors.textPrimary,
      fontWeight: neo ? '700' : '500',
      ...(neo ? { textTransform: 'uppercase' as const, letterSpacing: 0.5 } : {}),
    },
    logoutSection: {
      marginTop: spacing.xxxl,
      paddingBottom: spacing.xxxl,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: glass ? glass.glassBackground : colors.bgElevated,
      paddingVertical: spacing.lg,
      borderRadius: neo ? 0 : borderRadius.md,
      ...(glass ? { borderWidth: 1, borderColor: glass.glassBorder } : {}),
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.error } : {}),
    },
    logoutText: {
      color: colors.error,
      fontSize: fontSize.md,
      fontWeight: neo ? '800' : '600',
      ...(neo ? { textTransform: 'uppercase' as const } : {}),
    },
  }), [colors, spacing, fontSize, borderRadius, neo, glass]);

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
    <PatternBackground>
    <ScrollView style={{ flex: 1 }}>
      {/* User info header */}
      {user && (
        <View>
          <View style={{ height: 4, backgroundColor: colors.accentPrimary, marginHorizontal: glass ? spacing.md : 0, borderRadius: glass ? borderRadius.lg : 0 }} />
          <View style={styles.userHeader}>
            <Avatar
              userId={user.id}
              avatarHash={user.avatarHash}
              name={user.displayName || user.username}
              size={64}
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
        </View>
      )}

      {/* Settings rows — grouped by category */}
      {[
        { title: 'Account', rows: ACCOUNT_ROWS },
        { title: 'Preferences', rows: PREFERENCES_ROWS },
        { title: 'Social', rows: SOCIAL_ROWS },
        { title: 'Support', rows: SUPPORT_ROWS },
      ].map((section) => (
        <SectionCard key={section.title} title={section.title}>
          {section.rows.map((row) => (
            <PressableScale
              key={row.screen}
              style={styles.row}
              onPress={() => navigation.navigate(row.screen as any)}
              accessibilityRole="button"
              accessibilityLabel={row.label}
            >
              <Ionicons name={row.icon} size={22} color={colors.textSecondary} />
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </PressableScale>
          ))}
        </SectionCard>
      ))}

      {/* Logout */}
      <SectionCard style={{ marginBottom: spacing.xxxl }}>
        <PressableScale style={styles.logoutButton} onPress={handleLogout} accessibilityRole="button" accessibilityLabel="Log out">
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </PressableScale>
      </SectionCard>
    </ScrollView>
    </PatternBackground>
  );
}
