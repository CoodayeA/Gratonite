import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  Text,
  Switch,
  StyleSheet,
  Alert,
  Linking,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { colors, spacing, radius, fontSize } from '../../theme';

// ── Types ──────────────────────────────────────────────────────────────────

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function SettingRow({
  label,
  value,
  onValueChange,
  description,
  isFirst = false,
  isLast = false,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  description?: string;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.settingRow, !isLast && styles.settingRowBorder]}>
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description ? (
          <Text style={styles.settingDescription}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: colors.stroke.secondary,
          true: colors.brand.primary,
        }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────

export function NotificationSettingsScreen() {
  // ── Push permission state ────────────────────────────────────────────────
  const [pushEnabled, setPushEnabled] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionStatus>('undetermined');

  // ── Notification type toggles ────────────────────────────────────────────
  // TODO: Persist these preferences with AsyncStorage or expo-secure-store
  const [directMessages, setDirectMessages] = useState(true);
  const [mentions, setMentions] = useState(true);
  const [friendRequests, setFriendRequests] = useState(true);
  const [guildUpdates, setGuildUpdates] = useState(true);

  // ── Sound & vibration ────────────────────────────────────────────────────
  const [notificationSound, setNotificationSound] = useState(true);
  const [vibrate, setVibrate] = useState(true);

  // ── Do Not Disturb ───────────────────────────────────────────────────────
  const [doNotDisturb, setDoNotDisturb] = useState(false);

  // ── Check current permission status on mount ─────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus(status as PermissionStatus);
      setPushEnabled(status === 'granted');
    })();
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleTogglePush = useCallback(
    async (value: boolean) => {
      if (value) {
        const { status } = await Notifications.requestPermissionsAsync();
        setPermissionStatus(status as PermissionStatus);
        if (status === 'granted') {
          setPushEnabled(true);
        } else {
          setPushEnabled(false);
          Alert.alert(
            'Permissions Required',
            'Push notifications need permission to work. You can enable them in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => Linking.openSettings(),
              },
            ],
          );
        }
      } else {
        setPushEnabled(false);
      }
    },
    [],
  );

  const handleToggleDND = useCallback((value: boolean) => {
    setDoNotDisturb(value);
    if (value) {
      // TODO: Schedule DND start/end or apply immediately
    }
  }, []);

  // ── Permission status display ────────────────────────────────────────────

  const statusLabel =
    permissionStatus === 'granted'
      ? 'Enabled'
      : permissionStatus === 'denied'
        ? 'Disabled'
        : 'Not Determined';

  const statusColor =
    permissionStatus === 'granted'
      ? colors.accent.success
      : permissionStatus === 'denied'
        ? colors.accent.error
        : colors.text.muted;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Push Notifications ──────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="PUSH NOTIFICATIONS" />
          <View style={styles.card}>
            <SettingRow
              label="Enable Push Notifications"
              value={pushEnabled}
              onValueChange={handleTogglePush}
              isLast
            />
          </View>
          <View style={styles.statusRow}>
            <View
              style={[styles.statusDot, { backgroundColor: statusColor }]}
            />
            <Text style={[styles.statusText, { color: statusColor }]}>
              Status: {statusLabel}
            </Text>
          </View>

          {permissionStatus === 'denied' && (
            <View style={styles.deniedBanner}>
              <Text style={styles.deniedText}>
                Notifications are blocked by your device. You can re-enable them
                in Settings.
              </Text>
              <TouchableOpacity
                style={styles.openSettingsButton}
                onPress={() => Linking.openSettings()}
                activeOpacity={0.7}
              >
                <Text style={styles.openSettingsText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Notification Types ──────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="NOTIFICATION TYPES" />
          <View style={styles.card}>
            <SettingRow
              label="Direct Messages"
              value={directMessages}
              onValueChange={setDirectMessages}
              description="New direct message notifications"
            />
            <SettingRow
              label="Mentions"
              value={mentions}
              onValueChange={setMentions}
              description="When someone mentions you"
            />
            <SettingRow
              label="Friend Requests"
              value={friendRequests}
              onValueChange={setFriendRequests}
              description="Incoming friend requests"
            />
            <SettingRow
              label="Server Updates"
              value={guildUpdates}
              onValueChange={setGuildUpdates}
              description="Announcements and server events"
              isLast
            />
          </View>
        </View>

        {/* ── Sound & Vibration ───────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="SOUND & VIBRATION" />
          <View style={styles.card}>
            <SettingRow
              label="Notification Sound"
              value={notificationSound}
              onValueChange={setNotificationSound}
              description="Play a sound for new notifications"
            />
            <SettingRow
              label="Vibrate"
              value={vibrate}
              onValueChange={setVibrate}
              description="Vibrate on new notifications"
              isLast
            />
          </View>
        </View>

        {/* ── Do Not Disturb ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <SectionHeader title="DO NOT DISTURB" />
          <View style={styles.card}>
            <SettingRow
              label="Do Not Disturb"
              value={doNotDisturb}
              onValueChange={handleToggleDND}
              description="Silence all notifications"
              isLast={!doNotDisturb}
            />
            {doNotDisturb && (
              <View style={styles.dndActiveRow}>
                <View style={styles.dndBadge}>
                  <Text style={styles.dndBadgeText}>DND Active</Text>
                </View>
                <Text style={styles.dndHint}>
                  All notifications are currently silenced
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

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
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
    textTransform: 'uppercase',
  },

  // Card
  card: {
    backgroundColor: colors.bg.secondary,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },

  // Setting row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: spacing.lg,
  },
  settingRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.primary,
  },
  settingContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
  },
  settingDescription: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    marginTop: 1,
  },

  // Permission status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },

  // Denied banner
  deniedBanner: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  deniedText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  openSettingsButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.brand.primary,
  },
  openSettingsText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#ffffff',
  },

  // DND active
  dndActiveRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  dndBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  dndBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.status.dnd,
  },
  dndHint: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },
});
