import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/auth.store';
import { colors, fontSize, spacing, radius } from '../../theme';

// ── Main Screen ───────────────────────────────────────────────────────────

export function AccountSettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleChangePassword = useCallback(() => {
    Alert.alert(
      'Change Password',
      'A password reset link will be sent to your email address.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: () => {
            // TODO: Call password reset API
            Alert.alert('Sent', 'Check your email for the reset link.');
          },
        },
      ],
    );
  }, []);

  const handleToggle2FA = useCallback(
    (value: boolean) => {
      if (value) {
        Alert.alert(
          'Enable 2FA',
          'Two-factor authentication adds an extra layer of security to your account.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Enable',
              onPress: () => setTwoFactorEnabled(true),
            },
          ],
        );
      } else {
        Alert.alert(
          'Disable 2FA',
          'Are you sure you want to disable two-factor authentication?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Disable',
              style: 'destructive',
              onPress: () => setTwoFactorEnabled(false),
            },
          ],
        );
      }
    },
    [],
  );

  const handleDisableAccount = useCallback(() => {
    Alert.alert(
      'Disable Account',
      'Your account will be disabled and you will be logged out. You can re-enable it by logging in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable Account',
          style: 'destructive',
          onPress: () => {
            // TODO: Call disable account API
          },
        },
      ],
    );
  }, []);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'This will permanently delete your account, all messages, and all data associated with it.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete',
                  style: 'destructive',
                  onPress: () => {
                    // TODO: Call delete account API
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  const emailVerified = true; // TODO: get from user data

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Email */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>EMAIL</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Email Address</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                  {user?.email ?? 'Not set'}
                </Text>
              </View>
              <View
                style={[
                  styles.verifiedBadge,
                  !emailVerified && styles.unverifiedBadge,
                ]}
              >
                <Text
                  style={[
                    styles.verifiedBadgeText,
                    !emailVerified && styles.unverifiedBadgeText,
                  ]}
                >
                  {emailVerified ? '\u2713 Verified' : 'Unverified'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Password */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PASSWORD</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleChangePassword}
              activeOpacity={0.7}
            >
              <View style={styles.actionContent}>
                <Text style={styles.actionLabel}>Change Password</Text>
                <Text style={styles.actionDesc}>
                  Send a password reset link to your email
                </Text>
              </View>
              <Text style={styles.chevron}>{'\u203A'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Two-Factor Authentication */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TWO-FACTOR AUTHENTICATION</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>
                  {twoFactorEnabled ? '2FA Enabled' : '2FA Disabled'}
                </Text>
                <Text style={styles.toggleDesc}>
                  {twoFactorEnabled
                    ? 'Your account is protected with two-factor authentication'
                    : 'Enable for an extra layer of security'}
                </Text>
              </View>
              <Switch
                value={twoFactorEnabled}
                onValueChange={handleToggle2FA}
                trackColor={{
                  false: colors.stroke.secondary,
                  true: colors.accent.success,
                }}
                thumbColor="#ffffff"
              />
            </View>
            {twoFactorEnabled && (
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>
                  Two-factor authentication is active
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, styles.dangerTitle]}>
            DANGER ZONE
          </Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.actionRow, styles.actionRowBorder]}
              onPress={handleDisableAccount}
              activeOpacity={0.7}
            >
              <View style={styles.actionContent}>
                <Text style={styles.dangerLabel}>Disable Account</Text>
                <Text style={styles.actionDesc}>
                  Temporarily disable your account
                </Text>
              </View>
              <Text style={styles.chevron}>{'\u203A'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
            >
              <View style={styles.actionContent}>
                <Text style={styles.deleteLabel}>Delete Account</Text>
                <Text style={styles.actionDesc}>
                  Permanently delete your account and all data
                </Text>
              </View>
              <Text style={[styles.chevron, { color: colors.accent.error }]}>
                {'\u203A'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing['5xl'],
  },

  // Section
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  dangerTitle: {
    color: colors.accent.error,
  },

  // Card
  card: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    overflow: 'hidden',
  },

  // Info row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
  },
  verifiedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  unverifiedBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  verifiedBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.accent.success,
  },
  unverifiedBadgeText: {
    color: colors.accent.warning,
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  actionRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.primary,
  },
  actionContent: {
    flex: 1,
  },
  actionLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },
  chevron: {
    fontSize: 22,
    color: colors.text.muted,
    fontWeight: '300',
  },

  // Danger labels
  dangerLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.accent.warning,
    marginBottom: 2,
  },
  deleteLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.accent.error,
    marginBottom: 2,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  toggleContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 2,
  },
  toggleDesc: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },

  // Status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent.success,
  },
  statusText: {
    fontSize: fontSize.sm,
    color: colors.accent.success,
    fontWeight: '500',
  },
});
