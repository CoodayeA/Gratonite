import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { usersApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { Avatar } from '../../components/ui/Avatar';
import { colors, fontSize, spacing, radius } from '../../theme';

// ── Helpers ───────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ── Main Screen ───────────────────────────────────────────────────────────

export function ProfileEditScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState('');
  const [pronouns, setPronouns] = useState('');

  // ── Save Mutation ─────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: (data: { displayName?: string; bio?: string; pronouns?: string }) =>
      usersApi.updateProfile(data),
    onSuccess: (data) => {
      if (data?.displayName) {
        updateUser({ displayName: data.displayName });
      }
      Alert.alert('Saved', 'Your profile has been updated.');
      navigation.goBack();
    },
    onError: (err: Error) => {
      Alert.alert('Error', err.message || 'Could not save profile.');
    },
  });

  const handleSave = useCallback(() => {
    const updates: Record<string, string> = {};
    if (displayName.trim()) updates['displayName'] = displayName.trim();
    if (bio.trim()) updates['bio'] = bio.trim();
    if (pronouns.trim()) updates['pronouns'] = pronouns.trim();
    saveMutation.mutate(updates);
  }, [displayName, bio, pronouns, saveMutation]);

  const hasChanges =
    displayName.trim() !== (user?.displayName ?? '') ||
    bio.trim() !== '' ||
    pronouns.trim() !== '';

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <Avatar
              size={96}
              userId={user?.id}
              avatarHash={user?.avatar ?? undefined}
              displayName={displayName || user?.displayName || undefined}
              username={user?.username}
            />
            <TouchableOpacity style={styles.changeAvatarButton} activeOpacity={0.7}>
              <Text style={styles.changeAvatarText}>Change Avatar</Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            {/* Display Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>DISPLAY NAME</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter display name"
                placeholderTextColor={colors.text.muted}
                maxLength={32}
                autoCapitalize="words"
                autoCorrect={false}
              />
              <Text style={styles.fieldHint}>
                {displayName.length}/32
              </Text>
            </View>

            {/* Bio */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>BIO</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell us about yourself"
                placeholderTextColor={colors.text.muted}
                maxLength={190}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.fieldHint}>
                {bio.length}/190
              </Text>
            </View>

            {/* Pronouns */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>PRONOUNS</Text>
              <TextInput
                style={styles.input}
                value={pronouns}
                onChangeText={setPronouns}
                placeholder="e.g. they/them"
                placeholderTextColor={colors.text.muted}
                maxLength={40}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.bottomAction}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!hasChanges || saveMutation.isPending) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            activeOpacity={0.8}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing['3xl'],
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: fontSize['3xl'],
    fontWeight: '700',
    color: '#ffffff',
  },
  changeAvatarButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.stroke.secondary,
  },
  changeAvatarText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.brand.primary,
  },

  // Form
  formSection: {
    gap: spacing.xl,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  textArea: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  fieldHint: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    textAlign: 'right',
  },

  // Save button
  bottomAction: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.stroke.primary,
    backgroundColor: colors.bg.primary,
  },
  saveButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#ffffff',
  },
});
