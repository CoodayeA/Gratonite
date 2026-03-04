import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { guilds as guildsApi } from '../../lib/api';
import { colors, spacing, fontSize, borderRadius } from '../../lib/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateGuild'>;

export default function CreateGuildScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Server name is required');
      return;
    }

    setLoading(true);
    try {
      const guild = await guildsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      navigation.replace('GuildChannels', { guildId: guild.id, guildName: guild.name });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Create a Server</Text>
        <Text style={styles.subtitle}>
          Your server is where you and your friends hang out. Make yours and start talking.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Server Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="My Awesome Server"
            placeholderTextColor={colors.textMuted}
            maxLength={100}
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="What's your server about?"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            maxLength={1000}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Create Server</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.xxxl,
    paddingTop: spacing.xxxl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
    lineHeight: 22,
  },
  form: {
    gap: spacing.md,
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
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: colors.accentPrimary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
