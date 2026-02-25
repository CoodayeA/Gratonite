import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { usersApi, filesApi } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { colors, spacing, radius, fontSize } from '../../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const INTEREST_TAGS = ['Gaming', 'Music', 'Tech', 'Art', 'Sports', 'Anime', 'Movies', 'Books'];

export function CompleteSetupScreen() {
  const navigation = useNavigation<Nav>();
  const updateUser = useAuthStore((s) => s.updateUser);

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // ── Avatar picker ─────────────────────────────────────
  const handlePickAvatar = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant photo library access to upload an avatar.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  }, []);

  // ── Interest toggle ───────────────────────────────────
  const toggleInterest = useCallback((tag: string) => {
    setSelectedInterests((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }, []);

  // ── Submit handler ────────────────────────────────────
  const handleComplete = useCallback(async () => {
    setLoading(true);
    try {
      // Upload avatar if selected
      let avatarHash: string | undefined;
      if (avatarUri) {
        try {
          const uploadResult = await filesApi.upload(avatarUri, 'avatar');
          avatarHash = uploadResult.hash ?? uploadResult.id;
        } catch {
          // Non-blocking — continue even if avatar upload fails
        }
      }

      // Build profile update payload
      const profileData: Record<string, any> = {};
      if (displayName.trim()) {
        profileData.displayName = displayName.trim();
      }
      if (avatarHash) {
        profileData.avatarHash = avatarHash;
      }
      if (selectedInterests.size > 0) {
        profileData.interests = Array.from(selectedInterests);
      }

      // Update profile if there's anything to save
      if (Object.keys(profileData).length > 0) {
        await usersApi.updateProfile(profileData);

        // Update local auth store
        if (profileData.displayName) {
          updateUser({ displayName: profileData.displayName });
        }
        if (avatarHash) {
          updateUser({ avatar: avatarHash });
        }
      }

      // Navigate to main app
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [avatarUri, displayName, selectedInterests, navigation, updateUser]);

  // ── Skip handler ──────────────────────────────────────
  const handleSkip = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  }, [navigation]);

  return (
    <LinearGradient colors={['#5a4a7a', '#3e3a5a']} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Step indicator */}
            <View style={styles.stepRow}>
              <View style={[styles.stepBar, styles.stepBarActive]} />
              <View style={[styles.stepBar, styles.stepBarActive]} />
              <View style={styles.stepBar} />
            </View>

            {/* Avatar upload */}
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handlePickAvatar}
              activeOpacity={0.7}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.cameraIcon}>{'\u{1F4F7}'}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.7}>
              <Text style={styles.uploadLabel}>Upload Avatar</Text>
            </TouchableOpacity>

            {/* Heading */}
            <View style={styles.headingSection}>
              <Text style={styles.heading}>Complete Your Profile</Text>
              <Text style={styles.subheading}>Let others know who you are</Text>
            </View>

            {/* Display Name field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                autoCorrect={false}
                placeholderTextColor={colors.text.muted}
                placeholder="Enter your display name"
                returnKeyType="done"
              />
            </View>

            {/* Interest section */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Interests</Text>
              <View style={styles.tagsContainer}>
                {INTEREST_TAGS.map((tag) => {
                  const selected = selectedInterests.has(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.tag,
                        selected && styles.tagSelected,
                      ]}
                      onPress={() => toggleInterest(tag)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.tagText,
                          selected && styles.tagTextSelected,
                        ]}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Complete Setup button */}
            <TouchableOpacity
              style={[styles.completeButton, loading && styles.buttonDisabled]}
              onPress={handleComplete}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.text.inverse} />
              ) : (
                <Text style={styles.completeButtonText}>Complete Setup</Text>
              )}
            </TouchableOpacity>

            {/* Skip for now */}
            <TouchableOpacity
              onPress={handleSkip}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: 'center',
    gap: 24,
  },

  // ── Step indicator ────────────────────────
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBar: {
    width: 60,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.text.muted,
  },
  stepBarActive: {
    backgroundColor: colors.brand.primary,
  },

  // ── Avatar ────────────────────────────────
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#25243a',
    borderWidth: 2,
    borderColor: '#d4af3740',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraIcon: {
    fontSize: 28,
    color: colors.text.muted,
    opacity: 0.7,
  },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  uploadLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.brand.primary,
  },

  // ── Heading ───────────────────────────────
  headingSection: {
    alignItems: 'center',
    gap: 6,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text.primary,
  },
  subheading: {
    fontSize: 14,
    color: colors.text.secondary,
  },

  // ── Fields ────────────────────────────────
  fieldGroup: {
    width: '100%',
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: '#25243a',
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    borderRadius: radius.sm,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text.primary,
  },

  // ── Interest tags ─────────────────────────
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    backgroundColor: 'transparent',
  },
  tagSelected: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  tagText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  tagTextSelected: {
    color: colors.text.inverse,
  },

  // ── Complete button ───────────────────────
  completeButton: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.sm,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    color: colors.text.inverse,
    fontSize: fontSize.md,
    fontWeight: '600',
  },

  // ── Skip ──────────────────────────────────
  skipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.muted,
  },
});
