import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { voiceEffects } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import { selectionFeedback } from '../../lib/haptics';
import type { VoiceEffect } from '../../types';

const EFFECTS: Array<{ id: string; name: string; icon: string }> = [
  { id: 'robot', name: 'Robot', icon: 'hardware-chip-outline' },
  { id: 'deep', name: 'Deep', icon: 'arrow-down-outline' },
  { id: 'helium', name: 'Helium', icon: 'arrow-up-outline' },
  { id: 'echo', name: 'Echo', icon: 'volume-high-outline' },
  { id: 'reverb', name: 'Reverb', icon: 'water-outline' },
  { id: 'whisper', name: 'Whisper', icon: 'chatbubble-ellipses-outline' },
  { id: 'radio', name: 'Radio', icon: 'radio-outline' },
];

interface VoiceEffectSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function VoiceEffectSheet({ visible, onClose }: VoiceEffectSheetProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const [volume, setVolume] = useState(100);

  useEffect(() => {
    if (visible) {
      voiceEffects.getSettings().then((s) => {
        setActiveEffect(s.activeEffect);
        setVolume(s.effectVolume);
      }).catch(() => {});
    }
  }, [visible]);

  const handleSelectEffect = async (effectId: string) => {
    selectionFeedback();
    const newId = activeEffect === effectId ? null : effectId;
    setActiveEffect(newId);
    try {
      await voiceEffects.updateSettings({ activeEffect: newId });
      toast.success(newId ? `${EFFECTS.find(e => e.id === effectId)?.name} effect enabled` : 'Effect disabled');
    } catch {
      toast.error('Failed to update voice effect');
    }
  };

  const handleVolumeChange = async (val: number) => {
    setVolume(val);
    try {
      await voiceEffects.updateSettings({ effectVolume: val });
    } catch {}
  };

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: { backgroundColor: colors.bgSecondary, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, maxHeight: '70%', ...(neo ? { borderWidth: 3, borderColor: colors.border, borderBottomWidth: 0 } : {}) },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    title: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, ...(neo ? { textTransform: 'uppercase' } : {}) },
    grid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.lg, gap: spacing.md },
    effectCard: { width: '30%', aspectRatio: 1, borderRadius: neo ? 0 : borderRadius.lg, backgroundColor: colors.bgElevated, justifyContent: 'center', alignItems: 'center', gap: spacing.xs, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    effectCardActive: { backgroundColor: colors.accentPrimary + '20', borderColor: colors.accentPrimary, borderWidth: 2 },
    effectName: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textPrimary },
    sliderSection: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    sliderLabel: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },
    safeBottom: { height: 34 },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Voice Effects</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView>
            <View style={styles.grid}>
              {EFFECTS.map((effect) => (
                <TouchableOpacity
                  key={effect.id}
                  style={[styles.effectCard, activeEffect === effect.id && styles.effectCardActive]}
                  onPress={() => handleSelectEffect(effect.id)}
                >
                  <Ionicons name={effect.icon as any} size={28} color={activeEffect === effect.id ? colors.accentPrimary : colors.textSecondary} />
                  <Text style={styles.effectName}>{effect.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.sliderSection}>
              <Text style={styles.sliderLabel}>Effect Volume: {Math.round(volume)}%</Text>
              <Slider
                minimumValue={0}
                maximumValue={100}
                value={volume}
                onSlidingComplete={handleVolumeChange}
                minimumTrackTintColor={colors.accentPrimary}
                maximumTrackTintColor={colors.bgElevated}
                thumbTintColor={colors.accentPrimary}
              />
            </View>
          </ScrollView>
          <View style={styles.safeBottom} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
