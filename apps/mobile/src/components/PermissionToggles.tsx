import React, { useMemo } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { useTheme } from '../lib/theme';

// Permission bit flags — mirrors the web app's permission system
const PERMISSIONS = [
  { bit: 0, label: 'Manage Server', key: 'MANAGE_GUILD' },
  { bit: 1, label: 'Manage Channels', key: 'MANAGE_CHANNELS' },
  { bit: 2, label: 'Manage Roles', key: 'MANAGE_ROLES' },
  { bit: 3, label: 'Kick Members', key: 'KICK_MEMBERS' },
  { bit: 4, label: 'Ban Members', key: 'BAN_MEMBERS' },
  { bit: 5, label: 'Manage Messages', key: 'MANAGE_MESSAGES' },
  { bit: 6, label: 'Send Messages', key: 'SEND_MESSAGES' },
  { bit: 7, label: 'Read Messages', key: 'READ_MESSAGES' },
  { bit: 8, label: 'Embed Links', key: 'EMBED_LINKS' },
  { bit: 9, label: 'Attach Files', key: 'ATTACH_FILES' },
  { bit: 10, label: 'Mention Everyone', key: 'MENTION_EVERYONE' },
  { bit: 11, label: 'Connect (Voice)', key: 'CONNECT' },
  { bit: 12, label: 'Speak (Voice)', key: 'SPEAK' },
  { bit: 13, label: 'Manage Webhooks', key: 'MANAGE_WEBHOOKS' },
  { bit: 14, label: 'View Audit Log', key: 'VIEW_AUDIT_LOG' },
  { bit: 15, label: 'Administrator', key: 'ADMINISTRATOR' },
];

interface PermissionTogglesProps {
  permissions: string;
  onChange: (permissions: string) => void;
}

export default function PermissionToggles({ permissions, onChange }: PermissionTogglesProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  let permBigInt: bigint;
  try {
    permBigInt = BigInt(permissions || '0');
  } catch {
    permBigInt = BigInt(0);
  }

  const isSet = (bit: number) => (permBigInt & (1n << BigInt(bit))) !== 0n;

  const toggle = (bit: number) => {
    const mask = 1n << BigInt(bit);
    const newPerms = isSet(bit) ? permBigInt & ~mask : permBigInt | mask;
    onChange(newPerms.toString());
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    permInfo: {
      flex: 1,
      marginRight: spacing.md,
    },
    label: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    key: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginTop: 2,
      fontFamily: 'monospace',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <View style={styles.container}>
      {PERMISSIONS.map((p) => (
        <View key={p.key} style={styles.row}>
          <View style={styles.permInfo}>
            <Text style={styles.label}>{p.label}</Text>
            <Text style={styles.key}>{p.key}</Text>
          </View>
          <Switch
            value={isSet(p.bit)}
            onValueChange={() => toggle(p.bit)}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
            thumbColor={colors.white}
          />
        </View>
      ))}
    </View>
  );
}
