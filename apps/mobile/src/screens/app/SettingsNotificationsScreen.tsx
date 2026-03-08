import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { userSettings as settingsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import SectionHeader from '../../components/SectionHeader';
import LoadingScreen from '../../components/LoadingScreen';
import type { UserSettings } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'SettingsNotifications'>;

export default function SettingsNotificationsScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const toast = useToast();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local toggles backed by settings
  const [pushEnabled, setPushEnabled] = useState(false);
  const [messagesEnabled, setMessagesEnabled] = useState(true);
  const [mentionsEnabled, setMentionsEnabled] = useState(true);
  const [friendRequestsEnabled, setFriendRequestsEnabled] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await settingsApi.get();
      setSettings(data);
      setPushEnabled(data.pushEnabled);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

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
  }), [colors, spacing, fontSize, borderRadius]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <ScrollView style={styles.container}>
      {/* Push notifications master toggle */}
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

      {/* Per-type toggles */}
      <SectionHeader title="Notification Types" />
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Messages</Text>
            <Text style={styles.switchDescription}>
              New messages in channels and DMs
            </Text>
          </View>
          <Switch
            value={messagesEnabled}
            onValueChange={setMessagesEnabled}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
            thumbColor={colors.white}
            disabled={!pushEnabled}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Mentions</Text>
            <Text style={styles.switchDescription}>
              When someone @mentions you
            </Text>
          </View>
          <Switch
            value={mentionsEnabled}
            onValueChange={setMentionsEnabled}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
            thumbColor={colors.white}
            disabled={!pushEnabled}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Friend Requests</Text>
            <Text style={styles.switchDescription}>
              Incoming friend requests
            </Text>
          </View>
          <Switch
            value={friendRequestsEnabled}
            onValueChange={setFriendRequestsEnabled}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
            thumbColor={colors.white}
            disabled={!pushEnabled}
          />
        </View>
      </View>

      {!pushEnabled && (
        <Text style={styles.disabledHint}>
          Enable push notifications to configure per-type settings
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
  );
}
