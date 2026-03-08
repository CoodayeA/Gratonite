import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { roles as rolesApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import type { Role } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'RoleEdit'>;

const COLOR_PRESETS = [
  '#f04747', '#faa61a', '#43b581', '#1abc9c',
  '#3498db', '#5865f2', '#9b59b6', '#e91e63',
  '#e67e22', '#2ecc71', '#00bcd4', '#607d8b',
];

export default function RoleEditScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId, roleId } = route.params;
  const isEditing = !!roleId;

  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [hoist, setHoist] = useState(false);
  const [mentionable, setMentionable] = useState(false);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  const fetchRole = useCallback(async () => {
    if (!roleId) return;
    try {
      const allRoles = await rolesApi.list(guildId);
      const role = allRoles.find((r) => r.id === roleId);
      if (role) {
        setName(role.name);
        setSelectedColor(role.color);
        setHoist(role.hoist);
        setMentionable(role.mentionable);
      } else {
        toast.error('Role not found');
        navigation.goBack();
      }
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Failed to load role');
      }
    } finally {
      setLoading(false);
    }
  }, [guildId, roleId, navigation]);

  useEffect(() => {
    if (isEditing) {
      fetchRole();
    }
  }, [isEditing, fetchRole]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Role name is required');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: trimmedName,
        color: selectedColor || undefined,
        hoist,
        mentionable,
      };

      if (isEditing && roleId) {
        await rolesApi.update(guildId, roleId, data);
        toast.success('Role updated');
      } else {
        await rolesApi.create(guildId, data);
        toast.success('Role created');
      }
      navigation.goBack();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!roleId) return;
    Alert.alert(
      'Delete Role',
      `Are you sure you want to delete "${name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await rolesApi.delete(guildId, roleId);
              toast.success('Role deleted');
              navigation.goBack();
            } catch (err: any) {
              toast.error(err.message || 'Failed to delete role');
            }
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
    content: {
      paddingBottom: spacing.xxxl * 2,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    section: {
      marginTop: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    sectionTitle: {
      fontSize: fontSize.xs,
      fontWeight: '700',
      color: colors.textMuted,
      letterSpacing: 1,
      marginBottom: spacing.sm,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      color: colors.textPrimary,
      fontSize: fontSize.md,
    },
    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    colorCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    colorCircleSelected: {
      borderWidth: 3,
      borderColor: colors.white,
    },
    colorPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    previewDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    previewText: {
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
    },
    switchInfo: {
      flex: 1,
      marginRight: spacing.md,
    },
    switchLabel: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    switchDescription: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      marginTop: spacing.xs,
    },
    saveBtn: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.xxl,
      backgroundColor: colors.accentPrimary,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    saveBtnDisabled: {
      opacity: 0.5,
    },
    saveBtnText: {
      color: colors.white,
      fontWeight: '700',
      fontSize: fontSize.md,
    },
    dangerSection: {
      marginTop: spacing.xxxl,
      paddingHorizontal: spacing.lg,
    },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.bgSecondary,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      gap: spacing.md,
    },
    deleteBtnText: {
      color: colors.error,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Name */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ROLE NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter role name..."
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />
      </View>

      {/* Color */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>COLOR</Text>
        <View style={styles.colorGrid}>
          {/* No color option */}
          <TouchableOpacity
            style={[
              styles.colorCircle,
              { backgroundColor: colors.bgElevated },
              !selectedColor && styles.colorCircleSelected,
            ]}
            onPress={() => setSelectedColor(null)}
          >
            {!selectedColor && (
              <Ionicons name="close" size={16} color={colors.textMuted} />
            )}
          </TouchableOpacity>
          {COLOR_PRESETS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[
                styles.colorCircle,
                { backgroundColor: c },
                selectedColor === c && styles.colorCircleSelected,
              ]}
              onPress={() => setSelectedColor(c)}
            >
              {selectedColor === c && (
                <Ionicons name="checkmark" size={16} color={colors.white} />
              )}
            </TouchableOpacity>
          ))}
        </View>
        {selectedColor && (
          <View style={styles.colorPreview}>
            <View style={[styles.previewDot, { backgroundColor: selectedColor }]} />
            <Text style={[styles.previewText, { color: selectedColor }]}>{name || 'Role Preview'}</Text>
          </View>
        )}
      </View>

      {/* Hoist */}
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Display separately</Text>
            <Text style={styles.switchDescription}>
              Show members with this role separately in the member list
            </Text>
          </View>
          <Switch
            value={hoist}
            onValueChange={setHoist}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      {/* Mentionable */}
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Allow mentioning</Text>
            <Text style={styles.switchDescription}>
              Anyone can @mention this role
            </Text>
          </View>
          <Switch
            value={mentionable}
            onValueChange={setMentionable}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving || !name.trim()}
      >
        {saving ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Text style={styles.saveBtnText}>
            {isEditing ? 'Save Changes' : 'Create Role'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Delete button (only for existing roles) */}
      {isEditing && (
        <View style={styles.dangerSection}>
          <Text style={styles.sectionTitle}>DANGER ZONE</Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={styles.deleteBtnText}>Delete Role</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
