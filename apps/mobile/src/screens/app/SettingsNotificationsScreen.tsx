import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { userSettings as settingsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import SectionHeader from '../../components/SectionHeader';
import LoadingScreen from '../../components/LoadingScreen';
import type { UserSettings } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'SettingsNotifications'>;

const FRIEND_REQUEST_PREF_KEY = 'gratonite_notify_friend_requests';

export default function SettingsNotificationsScreen(_props: Props) {
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const toast = useToast();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailMentions, setEmailMentions] = useState(false);
  const [emailDms, setEmailDms] = useState(false);
  const [friendRequestsEnabled, setFriendRequestsEnabled] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await settingsApi.get();
      setSettings(data);
      setPushEnabled(data.pushEnabled ?? false);
      setEmailMentions(!!data.emailNotifications?.mentions);
      setEmailDms(!!data.emailNotifications?.dms);
      const friendRequestsPref = await SecureStore.getItemAsync(FRIEND_REQUEST_PREF_KEY);
      setFriendRequestsEnabled(friendRequestsPref !== 'false');
    } catch (err: any) {
      toast.error(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updatePushEnabled = async (value: boolean) => {
    setPushEnabled(value);
    setSaving(true);
    try {
      const updated = await settingsApi.update({ pushEnabled: value });
      setSettings(updated);
    } catch (err: any) {
      setPushEnabled(!value);
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateEmailPrefs = async (partial: NonNullable<UserSettings['emailNotifications']>) => {
    setSaving(true);
    try {
      const merged = { ...settings?.emailNotifications, ...partial };
      const updated = await settingsApi.update({ emailNotifications: merged });
      setSettings(updated);
      if (partial.mentions !== undefined) setEmailMentions(!!updated.emailNotifications?.mentions);
      if (partial.dms !== undefined) setEmailDms(!!updated.emailNotifications?.dms);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save email preferences');
    } finally {
      setSaving(false);
    }
  };

  const updateLocalFriendRequests = async (value: boolean) => {
    setFriendRequestsEnabled(value);
    try {
      await SecureStore.setItemAsync(FRIEND_REQUEST_PREF_KEY, String(value));
    } catch {
      setFriendRequestsEnabled(!value);
      toast.error('Failed to save friend request preference');
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    section: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    switchInfo: {
      flex: 1,
      marginRight: spacing.lg,
    },
    switchLabel: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    switchDescription: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.xs,
    },
    disabledHint: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      fontStyle: 'italic',
    },
    savingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    savingText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
    bottomPad: {
      height: 40,
    },
    note: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      lineHeight: 20,
    },
  }), [colors, spacing, fontSize, borderRadius]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <PatternBackground>
    <ScrollView style={{ flex: 1 }}>
      <SectionHeader title="Push Notifications" />
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Enable Push Notifications</Text>
            <Text style={styles.switchDescription}>
              Receive push notifications on this device
            </Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={updatePushEnabled}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
            thumbColor={colors.white}
            disabled={saving}
          />
        </View>
      </View>

      <Text style={styles.note}>
        Email mention and DM preferences sync with your account (same as the web app). Configure quiet hours on web under Settings → Notifications.
      </Text>

      <SectionHeader title="Email (account)" />
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Email: @mentions</Text>
            <Text style={styles.switchDescription}>
              Message digest for mentions (respects server defaults)
            </Text>
          </View>
          <Switch
            value={emailMentions}
            onValueChange={(v) => void updateEmailPrefs({ mentions: v })}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
            thumbColor={colors.white}
            disabled={saving}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Email: direct messages</Text>
            <Text style={styles.switchDescription}>
              Notifications for DMs when email is enabled
            </Text>
          </View>
          <Switch
            value={emailDms}
            onValueChange={(v) => void updateEmailPrefs({ dms: v })}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
            thumbColor={colors.white}
            disabled={saving}
          />
        </View>
      </View>

      <SectionHeader title="On this device" />
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Friend requests (local)</Text>
            <Text style={styles.switchDescription}>
              Push routing for friend requests until a server field exists
            </Text>
          </View>
          <Switch
            value={friendRequestsEnabled}
            onValueChange={(value) => void updateLocalFriendRequests(value)}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
            thumbColor={colors.white}
            disabled={!pushEnabled}
          />
        </View>
      </View>

      {!pushEnabled && (
        <Text style={styles.disabledHint}>
          Enable push notifications to configure on-device friend-request routing
        </Text>
      )}

      {saving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color={colors.accentPrimary} />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
    </PatternBackground>
  );
}
