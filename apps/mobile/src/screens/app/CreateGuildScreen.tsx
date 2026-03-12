import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { guilds as guildsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme, useGlass } from '../../lib/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateGuild'>;

export default function CreateGuildScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const glass = useGlass();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Portal name is required');
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
      toast.error(err.message || 'Failed to create portal');
    } finally {
      setLoading(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
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
      fontWeight: neo ? '800' : '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.sm,
      ...(neo ? { textTransform: 'uppercase' as const } : {}),
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
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: glass.glassBorder,
        padding: spacing.lg,
      } : {}),
    },
    label: {
      fontSize: fontSize.sm,
      fontWeight: neo ? '800' : '600',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: neo ? 1.2 : 0.5,
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
    button: {
      backgroundColor: colors.accentPrimary,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.md,
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
    buttonText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo, glass]);

  return (
    <PatternBackground>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Create a Portal</Text>
        <Text style={styles.subtitle}>
          Your portal is where you and your friends hang out. Make yours and start talking.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Portal Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="My Awesome Portal"
            placeholderTextColor={colors.textMuted}
            maxLength={100}
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="What's your portal about?"
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
              <Text style={styles.buttonText}>Create Portal</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
    </PatternBackground>
  );
}
