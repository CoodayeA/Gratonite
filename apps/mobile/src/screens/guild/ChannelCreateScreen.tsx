import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { channels as channelsApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import type { Channel } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'ChannelCreate'>;

type ChannelType = 'text' | 'voice' | 'announcement';

const CHANNEL_TYPES: { value: ChannelType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'text', label: 'Text', icon: 'chatbubble-outline' },
  { value: 'voice', label: 'Voice', icon: 'volume-high-outline' },
  { value: 'announcement', label: 'Announcement', icon: 'megaphone-outline' },
];

const SLOW_MODE_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
  { value: 300, label: '5m' },
  { value: 900, label: '15m' },
  { value: 3600, label: '1h' },
];

export default function ChannelCreateScreen({ route, navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { guildId, parentId } = route.params;

  const [name, setName] = useState('');
  const [type, setType] = useState<ChannelType>('text');
  const [selectedParent, setSelectedParent] = useState<string | undefined>(parentId);
  const [nsfw, setNsfw] = useState(false);
  const [slowMode, setSlowMode] = useState(0);
  const [categories, setCategories] = useState<Channel[]>([]);
  const [creating, setCreating] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const allChannels = await channelsApi.getForGuild(guildId);
      setCategories(allChannels.filter((c) => c.type === 'category'));
    } catch {
      // Non-critical — category picker will be empty
    }
  }, [guildId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Channel name is required');
      return;
    }

    setCreating(true);
    try {
      await channelsApi.create(guildId, {
        name: trimmedName,
        type,
        parentId: selectedParent,
      });
      toast.success(`Channel #${trimmedName} created`);
      navigation.goBack();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create channel');
    } finally {
      setCreating(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === selectedParent);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    content: {
      paddingBottom: spacing.xxxl * 2,
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
    typeGrid: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    typeOption: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.lg,
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.md,
      borderWidth: 2,
      borderColor: colors.transparent,
      gap: spacing.xs,
    },
    typeOptionSelected: {
      borderColor: colors.accentPrimary,
      backgroundColor: colors.accentLight,
    },
    typeLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
    },
    typeLabelSelected: {
      color: colors.white,
    },
    pickerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    pickerBtnText: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
    },
    pickerDropdown: {
      marginTop: spacing.sm,
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
    },
    pickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pickerItemSelected: {
      backgroundColor: colors.accentLight,
    },
    pickerItemText: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
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
    slowModeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    slowModeBtn: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      backgroundColor: colors.bgSecondary,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.transparent,
    },
    slowModeBtnActive: {
      backgroundColor: colors.accentLight,
      borderColor: colors.accentPrimary,
    },
    slowModeBtnText: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '500',
    },
    slowModeBtnTextActive: {
      color: colors.white,
    },
    createBtn: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.xxl,
      backgroundColor: colors.accentPrimary,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.md,
      alignItems: 'center',
    },
    createBtnDisabled: {
      opacity: 0.5,
    },
    createBtnText: {
      color: colors.white,
      fontWeight: '700',
      fontSize: fontSize.md,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Name */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CHANNEL NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="new-channel"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
      </View>

      {/* Type */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CHANNEL TYPE</Text>
        <View style={styles.typeGrid}>
          {CHANNEL_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={[
                styles.typeOption,
                type === t.value && styles.typeOptionSelected,
              ]}
              onPress={() => setType(t.value)}
            >
              <Ionicons
                name={t.icon}
                size={24}
                color={type === t.value ? colors.white : colors.textSecondary}
              />
              <Text
                style={[
                  styles.typeLabel,
                  type === t.value && styles.typeLabelSelected,
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Category */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CATEGORY</Text>
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={() => setShowCategoryPicker(!showCategoryPicker)}
        >
          <Text style={styles.pickerBtnText}>
            {selectedCategory ? selectedCategory.name : 'No Category'}
          </Text>
          <Ionicons
            name={showCategoryPicker ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textMuted}
          />
        </TouchableOpacity>

        {showCategoryPicker && (
          <View style={styles.pickerDropdown}>
            <TouchableOpacity
              style={[
                styles.pickerItem,
                !selectedParent && styles.pickerItemSelected,
              ]}
              onPress={() => {
                setSelectedParent(undefined);
                setShowCategoryPicker(false);
              }}
            >
              <Text style={styles.pickerItemText}>No Category</Text>
              {!selectedParent && (
                <Ionicons name="checkmark" size={18} color={colors.accentPrimary} />
              )}
            </TouchableOpacity>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.pickerItem,
                  selectedParent === cat.id && styles.pickerItemSelected,
                ]}
                onPress={() => {
                  setSelectedParent(cat.id);
                  setShowCategoryPicker(false);
                }}
              >
                <Text style={styles.pickerItemText}>{cat.name}</Text>
                {selectedParent === cat.id && (
                  <Ionicons name="checkmark" size={18} color={colors.accentPrimary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* NSFW */}
      <View style={styles.section}>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>NSFW Channel</Text>
            <Text style={styles.switchDescription}>
              Users must confirm their age to view this channel
            </Text>
          </View>
          <Switch
            value={nsfw}
            onValueChange={setNsfw}
            trackColor={{ false: colors.bgElevated, true: colors.accentPrimary }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      {/* Slow Mode */}
      {type === 'text' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SLOW MODE</Text>
          <View style={styles.slowModeGrid}>
            {SLOW_MODE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.slowModeBtn,
                  slowMode === opt.value && styles.slowModeBtnActive,
                ]}
                onPress={() => setSlowMode(opt.value)}
              >
                <Text
                  style={[
                    styles.slowModeBtnText,
                    slowMode === opt.value && styles.slowModeBtnTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Create button */}
      <TouchableOpacity
        style={[styles.createBtn, !name.trim() && styles.createBtnDisabled]}
        onPress={handleCreate}
        disabled={creating || !name.trim()}
      >
        {creating ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Text style={styles.createBtnText}>Create Channel</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
