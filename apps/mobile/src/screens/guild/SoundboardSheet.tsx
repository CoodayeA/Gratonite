import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import { mediumImpact } from '../../lib/haptics';

/** Visual category colors for soundboard items — intentionally not theme-dependent */
const SOUND_CATEGORY_COLORS = {
  gold: '#f59e0b',
  green: '#10b981',
  blue: '#3b82f6',
  pink: '#ec4899',
  purple: '#8b5cf6',
  red: '#f43f5e',
  slate: '#64748b',
  crimson: '#ef4444',
} as const;

const SOUNDS = [
  { id: 1, name: 'Airhorn', emoji: '📢', color: SOUND_CATEGORY_COLORS.gold },
  { id: 2, name: 'Crickets', emoji: '🦗', color: SOUND_CATEGORY_COLORS.green },
  { id: 3, name: 'Drum Roll', emoji: '🥁', color: SOUND_CATEGORY_COLORS.blue },
  { id: 4, name: 'Tada', emoji: '🎉', color: SOUND_CATEGORY_COLORS.pink },
  { id: 5, name: 'Sad Trombone', emoji: '🎺', color: SOUND_CATEGORY_COLORS.purple },
  { id: 6, name: 'Applause', emoji: '👏', color: SOUND_CATEGORY_COLORS.red },
  { id: 7, name: 'Swoosh', emoji: '💨', color: SOUND_CATEGORY_COLORS.slate },
  { id: 8, name: 'Buzzer', emoji: '🚨', color: SOUND_CATEGORY_COLORS.crimson },
];

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000;

interface SoundboardSheetProps {
  visible: boolean;
  onClose: () => void;
  onPlaySound: (sound: { name: string; emoji: string }) => void;
}

export default function SoundboardSheet({ visible, onClose, onPlaySound }: SoundboardSheetProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [pressTimestamps, setPressTimestamps] = useState<number[]>([]);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRateLimited = cooldownRemaining > 0;

  useEffect(() => {
    return () => {
      if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    };
  }, []);

  const startCooldownTimer = useCallback((oldestTimestamp: number) => {
    if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    const updateRemaining = () => {
      const elapsed = Date.now() - oldestTimestamp;
      const remaining = Math.ceil((RATE_LIMIT_WINDOW_MS - elapsed) / 1000);
      if (remaining <= 0) {
        setCooldownRemaining(0);
        if (cooldownInterval.current) { clearInterval(cooldownInterval.current); cooldownInterval.current = null; }
      } else {
        setCooldownRemaining(remaining);
      }
    };
    updateRemaining();
    cooldownInterval.current = setInterval(updateRemaining, 1000);
  }, []);

  const handlePlay = useCallback((sound: { name: string; emoji: string }) => {
    const now = Date.now();
    const recentPresses = pressTimestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    if (recentPresses.length >= RATE_LIMIT_MAX) {
      startCooldownTimer(recentPresses[0]);
      return;
    }
    mediumImpact();
    const updatedTimestamps = [...recentPresses, now];
    setPressTimestamps(updatedTimestamps);
    onPlaySound(sound);
    if (updatedTimestamps.length >= RATE_LIMIT_MAX) {
      startCooldownTimer(updatedTimestamps[0]);
    }
  }, [pressTimestamps, onPlaySound, startCooldownTimer]);

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: { backgroundColor: colors.bgSecondary, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, ...(neo ? { borderWidth: 3, borderColor: colors.border, borderBottomWidth: 0 } : {}) },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    title: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, ...(neo ? { textTransform: 'uppercase' } : {}) },
    grid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.lg, gap: spacing.md },
    soundBtn: { width: '47%', borderRadius: neo ? 0 : borderRadius.lg, backgroundColor: colors.bgElevated, padding: spacing.lg, alignItems: 'center', gap: spacing.sm, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    soundBtnDisabled: { opacity: 0.4 },
    soundEmoji: { fontSize: 28 },
    soundName: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textPrimary },
    colorBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, borderTopLeftRadius: neo ? 0 : borderRadius.lg, borderTopRightRadius: neo ? 0 : borderRadius.lg },
    cooldownBar: { padding: spacing.sm, backgroundColor: colors.warning + '14', alignItems: 'center' },
    cooldownText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.warning },
    footer: { padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
    footerText: { fontSize: fontSize.xs, color: colors.textMuted },
    safeBottom: { height: 34 },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Soundboard</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
          </View>
          <View style={styles.grid}>
            {SOUNDS.map((sound) => (
              <TouchableOpacity
                key={sound.id}
                style={[styles.soundBtn, isRateLimited && styles.soundBtnDisabled]}
                onPress={() => handlePlay(sound)}
                disabled={isRateLimited}
              >
                <View style={[styles.colorBar, { backgroundColor: sound.color }]} />
                <Text style={styles.soundEmoji}>{sound.emoji}</Text>
                <Text style={styles.soundName}>{sound.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {isRateLimited && (
            <View style={styles.cooldownBar}>
              <Text style={styles.cooldownText}>Cooldown: {cooldownRemaining}s remaining</Text>
            </View>
          )}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Sounds are audible to everyone in the channel</Text>
          </View>
          <View style={styles.safeBottom} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
