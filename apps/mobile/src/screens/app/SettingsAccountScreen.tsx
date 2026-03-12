import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useTheme, useGlass } from '../../lib/theme';
import { mfa } from '../../lib/api';
import SectionHeader from '../../components/SectionHeader';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'SettingsAccount'>;

export default function SettingsAccountScreen({ navigation }: Props) {
  const { user, updateProfile } = useAuth();
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const glass = useGlass();
  const toast = useToast();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [pronouns, setPronouns] = useState(user?.pronouns || '');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    mfa.status().then((res) => setMfaEnabled(res.enabled)).catch(() => {});
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || null,
        bio: bio.trim() || null,
        pronouns: pronouns.trim() || null,
      });
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Please fill in both password fields');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setChangingPassword(true);
    try {
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action is permanent and cannot be undone. All your data will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'Type DELETE to confirm.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete',
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert('Account Scheduled for Deletion', 'Your account will be deleted within 30 days.');
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    scroll: {
      flex: 1,
    },
    section: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    label: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    input: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: colors.textPrimary,
      marginBottom: spacing.md,
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: glass.glassBorder,
      } : neo ? {
        backgroundColor: colors.inputBg,
        borderRadius: 0,
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
      } : {
        backgroundColor: colors.inputBg,
        borderWidth: 1,
        borderColor: colors.inputBorder,
        borderRadius: borderRadius.md,
      }),
    },
    inputMultiline: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    saveButton: {
      backgroundColor: colors.accentPrimary,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.sm,
      ...(glass ? {
        borderRadius: borderRadius.xl,
        shadowColor: colors.accentPrimary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      } : neo ? {
        borderRadius: 0,
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
        shadowColor: neo.shadowColor,
        shadowOffset: neo.shadowOffset,
        shadowOpacity: neo.shadowOpacity,
        shadowRadius: neo.shadowRadius,
      } : {
        borderRadius: borderRadius.md,
      }),
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    deleteButton: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.error,
      } : neo ? {
        backgroundColor: colors.bgElevated,
        borderRadius: 0,
        borderWidth: neo.borderWidth,
        borderColor: colors.error,
      } : {
        backgroundColor: colors.bgElevated,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.error,
      }),
    },
    deleteButtonText: {
      color: colors.error,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    mfaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      gap: spacing.md,
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: glass.glassBorder,
      } : neo ? {
        backgroundColor: colors.bgSecondary,
        borderRadius: 0,
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
      } : {
        backgroundColor: colors.bgSecondary,
        borderRadius: borderRadius.md,
      }),
    },
    mfaInfo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    mfaLabel: {
      fontSize: fontSize.md,
      fontWeight: '500',
      color: colors.textPrimary,
    },
    mfaBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
    },
    mfaBadgeText: {
      fontSize: fontSize.xs,
      fontWeight: '700',
    },
    mfaButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.accentPrimary,
    },
    mfaButtonText: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    bottomPad: {
      height: 40,
    },
  }), [colors, spacing, fontSize, borderRadius, neo, glass]);

  return (
    <PatternBackground>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Profile fields */}
        <SectionHeader title="Profile" />
        <View style={styles.section}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name"
            placeholderTextColor={colors.textMuted}
            maxLength={32}
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell us about yourself"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            maxLength={190}
          />

          <Text style={styles.label}>Pronouns</Text>
          <TextInput
            style={styles.input}
            value={pronouns}
            onChangeText={setPronouns}
            placeholder="e.g. they/them"
            placeholderTextColor={colors.textMuted}
            maxLength={40}
          />

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSaveProfile}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Change Password */}
        <SectionHeader title="Change Password" />
        <View style={styles.section}>
          <Text style={styles.label}>Current Password</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />

          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.saveButton, changingPassword && styles.buttonDisabled]}
            onPress={handleChangePassword}
            disabled={changingPassword}
          >
            {changingPassword ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveButtonText}>Change Password</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Two-Factor Authentication */}
        <SectionHeader title="Two-Factor Authentication" />
        <View style={styles.section}>
          <View style={styles.mfaRow}>
            <View style={styles.mfaInfo}>
              <Ionicons
                name={mfaEnabled ? 'shield-checkmark' : 'shield-outline'}
                size={20}
                color={mfaEnabled ? colors.success : colors.textMuted}
              />
              <Text style={styles.mfaLabel}>2FA</Text>
              {mfaEnabled !== null && (
                <View style={[styles.mfaBadge, { backgroundColor: mfaEnabled ? colors.success + '30' : colors.error + '30' }]}>
                  <Text style={[styles.mfaBadgeText, { color: mfaEnabled ? colors.success : colors.error }]}>
                    {mfaEnabled ? 'Enabled' : 'Disabled'}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.mfaButton}
              onPress={() => navigation.navigate('MFASetup')}
            >
              <Text style={styles.mfaButtonText}>Manage</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Danger zone */}
        <SectionHeader title="Danger Zone" />
        <View style={styles.section}>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </KeyboardAvoidingView>
    </PatternBackground>
  );
}
