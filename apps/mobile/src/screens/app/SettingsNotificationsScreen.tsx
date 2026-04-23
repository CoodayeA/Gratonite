import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { userSettings as settingsApi } from '../../lib/api';
import { registerForPushNotifications } from '../../lib/notifications';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import SectionHeader from '../../components/SectionHeader';
import LoadingScreen from '../../components/LoadingScreen';
import type { UserSettings } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

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

  // Quiet hours state
  const [qhEnabled, setQhEnabled] = useState(false);
  const [qhStartHour, setQhStartHour] = useState(22);
  const [qhStartMinute, setQhStartMinute] = useState(0);
  const [qhEndHour, setQhEndHour] = useState(7);
  const [qhEndMinute, setQhEndMinute] = useState(0);
  const [qhDays, setQhDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await settingsApi.get();
      setSettings(data);
      setPushEnabled(data.pushEnabled ?? false);
      setEmailMentions(!!data.emailNotifications?.mentions);
      setEmailDms(!!data.emailNotifications?.dms);
      const friendRequestsPref = await SecureStore.getItemAsync(FRIEND_REQUEST_PREF_KEY);
      setFriendRequestsEnabled(friendRequestsPref !== 'false');

      // Load quiet hours
      const qh = data.notificationQuietHours;
      if (qh) {
        setQhEnabled(qh.enabled ?? false);
        if (qh.startTime) {
          const [sh, sm] = qh.startTime.split(':').map(Number);
          if (Number.isFinite(sh)) setQhStartHour(sh);
          if (Number.isFinite(sm)) setQhStartMinute(sm);
        }
        if (qh.endTime) {
          const [eh, em] = qh.endTime.split(':').map(Number);
          if (Number.isFinite(eh)) setQhEndHour(eh);
          if (Number.isFinite(em)) setQhEndMinute(em);
        }
        if (qh.days && Array.isArray(qh.days)) {
          setQhDays(qh.days);
        }
      }
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
      if (value) {
        const token = await registerForPushNotifications();
        if (!token) {
          throw new Error('Push notification permission was not granted');
        }
      }
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

  const padTime = (n: number) => String(Math.min(59, Math.max(0, n))).padStart(2, '0');

  const saveQuietHours = async () => {
    setSaving(true);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const updated = await settingsApi.update({
        notificationQuietHours: {
          enabled: qhEnabled,
          startTime: `${padTime(qhStartHour)}:${padTime(qhStartMinute)}`,
          endTime: `${padTime(qhEndHour)}:${padTime(qhEndMinute)}`,
          timezone: tz,
          days: qhDays,
        },
      });
      setSettings(updated);
      toast.success('Quiet hours saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save quiet hours');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (dayIndex: number) => {
    setQhDays(prev => {
      const hasDay = prev.includes(dayIndex);
      const next = hasDay ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex].sort();
      return next;
    });
  };

  const selectAllDays = () => setQhDays([0, 1, 2, 3, 4, 5, 6]);
  const clearAllDays = () => setQhDays([]);

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
    quietHoursCard: {
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    quietHoursHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    quietHoursTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    quietHoursDescription: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginBottom: spacing.md,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    timeLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
    },
    timeInput: {
      backgroundColor: colors.bgPrimary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      width: 50,
      textAlign: 'center',
    },
    daysContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.md,
    },
    dayChip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
      minWidth: 44,
      alignItems: 'center',
    },
    dayChipActive: {
      backgroundColor: colors.accentPrimary,
      borderColor: colors.accentPrimary,
    },
    dayChipInactive: {
      backgroundColor: colors.bgPrimary,
      borderColor: colors.border,
    },
    dayChipText: {
      fontSize: fontSize.sm,
      fontWeight: '500',
    },
    dayChipTextActive: {
      color: '#000',
    },
    dayChipTextInactive: {
      color: colors.textSecondary,
    },
    daysActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    daysActionText: {
      color: colors.accentPrimary,
      fontSize: fontSize.sm,
      fontWeight: '500',
    },
    saveButton: {
      backgroundColor: colors.accentPrimary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.sm,
      alignSelf: 'flex-start',
    },
    saveButtonText: {
      color: '#000',
      fontWeight: '600',
      fontSize: fontSize.sm,
    },
    saveButtonDisabled: {
      opacity: 0.6,
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
        Email mention and DM preferences sync with your account (same as the web app).
      </Text>

      <SectionHeader title="Quiet Hours" />
      <View style={styles.quietHoursCard}>
        <View style={styles.quietHoursHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.quietHoursTitle}>Enable quiet hours</Text>
          </View>
          <Switch
            value={qhEnabled}
            onValueChange={setQhEnabled}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
            thumbColor={colors.white}
            disabled={saving}
          />
        </View>
        <Text style={styles.quietHoursDescription}>
          While on, new push notifications are held until after this window.
        </Text>

        <View style={styles.timeRow}>
          <Text style={styles.timeLabel}>From</Text>
          <TextInput
            style={styles.timeInput}
            value={String(qhStartHour)}
            onChangeText={t => setQhStartHour(Math.min(23, Math.max(0, parseInt(t || '0', 10))))}
            keyboardType="number-pad"
            maxLength={2}
            editable={!saving}
          />
          <Text style={{ color: colors.textPrimary }}>:</Text>
          <TextInput
            style={styles.timeInput}
            value={String(qhStartMinute).padStart(2, '0')}
            onChangeText={t => setQhStartMinute(Math.min(59, Math.max(0, parseInt(t || '0', 10))))}
            keyboardType="number-pad"
            maxLength={2}
            editable={!saving}
          />
          <Text style={[styles.timeLabel, { marginLeft: spacing.sm }]}>To</Text>
          <TextInput
            style={styles.timeInput}
            value={String(qhEndHour)}
            onChangeText={t => setQhEndHour(Math.min(23, Math.max(0, parseInt(t || '0', 10))))}
            keyboardType="number-pad"
            maxLength={2}
            editable={!saving}
          />
          <Text style={{ color: colors.textPrimary }}>:</Text>
          <TextInput
            style={styles.timeInput}
            value={String(qhEndMinute).padStart(2, '0')}
            onChangeText={t => setQhEndMinute(Math.min(59, Math.max(0, parseInt(t || '0', 10))))}
            keyboardType="number-pad"
            maxLength={2}
            editable={!saving}
          />
        </View>

        <View style={styles.daysActions}>
          <TouchableOpacity onPress={selectAllDays} disabled={saving}>
            <Text style={styles.daysActionText}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearAllDays} disabled={saving}>
            <Text style={styles.daysActionText}>None</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.daysContainer}>
          {DAYS.map((day, idx) => {
            const isActive = qhDays.includes(idx);
            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayChip,
                  isActive ? styles.dayChipActive : styles.dayChipInactive,
                ]}
                onPress={() => toggleDay(idx)}
                disabled={saving}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    isActive ? styles.dayChipTextActive : styles.dayChipTextInactive,
                  ]}
                >
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveQuietHours}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

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
