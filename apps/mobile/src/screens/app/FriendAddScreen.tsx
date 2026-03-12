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
import { Ionicons } from '@expo/vector-icons';
import { relationships as relApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme, useGlass } from '../../lib/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'FriendAdd'>;

export default function FriendAddScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const glass = useGlass();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      toast.error('Please enter a username');
      return;
    }

    setSending(true);
    try {
      await relApi.sendFriendRequest(trimmed);
      toast.success(`Friend request sent to ${trimmed}`);
      navigation.goBack();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send friend request');
    } finally {
      setSending(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.xl,
      paddingTop: 60,
      alignItems: 'center',
    },
    iconContainer: {
      width: 96,
      height: 96,
      borderRadius: neo ? 0 : glass ? borderRadius.xl : 48,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.xl,
      ...(glass ? {
        backgroundColor: glass.glassBackground,
        borderWidth: 1,
        borderColor: glass.glassBorder,
      } : neo ? {
        backgroundColor: neo.palette.sky,
        borderWidth: neo.borderWidth,
        borderColor: colors.border,
      } : {
        backgroundColor: colors.accentLight,
      }),
    },
    title: {
      fontSize: fontSize.xxl,
      fontWeight: neo ? '800' : '700',
      color: colors.textPrimary,
      marginBottom: spacing.sm,
      ...(neo ? { textTransform: 'uppercase' as const } : {}),
    },
    subtitle: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.xxxl,
    },
    inputContainer: {
      width: '100%',
      marginBottom: spacing.xl,
    },
    label: {
      fontSize: fontSize.xs,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    input: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      color: colors.textPrimary,
      fontSize: fontSize.md,
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
    sendBtn: {
      width: '100%',
      backgroundColor: colors.accentPrimary,
      paddingVertical: spacing.lg,
      alignItems: 'center',
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
    sendBtnDisabled: {
      opacity: 0.5,
    },
    sendBtnText: {
      color: colors.white,
      fontWeight: '700',
      fontSize: fontSize.md,
    },
  }), [colors, spacing, fontSize, borderRadius, neo, glass]);

  return (
    <PatternBackground>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="person-add" size={56} color={colors.accentPrimary} />
        </View>

        <Text style={styles.title}>Add Friend</Text>
        <Text style={styles.subtitle}>
          Enter a username to send a friend request.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>USERNAME</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
        </View>

        <TouchableOpacity
          style={[styles.sendBtn, !username.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={sending || !username.trim()}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.sendBtnText}>Send Friend Request</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </PatternBackground>
  );
}
