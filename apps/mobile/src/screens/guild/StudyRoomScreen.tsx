import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { studyRooms } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import { mediumImpact, notificationSuccess } from '../../lib/haptics';
import LoadingScreen from '../../components/LoadingScreen';
import LoadErrorCard from '../../components/LoadErrorCard';
import type { StudySession, StudyRoomSettings } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'StudyRoom'>;

const AMBIENT_SOUNDS = [
  { id: 'rain', name: 'Rain', icon: 'rainy-outline' },
  { id: 'lofi', name: 'Lo-Fi', icon: 'musical-notes-outline' },
  { id: 'library', name: 'Library', icon: 'library-outline' },
  { id: 'fire', name: 'Fireplace', icon: 'flame-outline' },
  { id: 'forest', name: 'Forest', icon: 'leaf-outline' },
  { id: 'ocean', name: 'Ocean', icon: 'water-outline' },
];

const WORK_PRESETS = [
  { label: '25/5', work: 25, break: 5 },
  { label: '50/10', work: 50, break: 10 },
  { label: '90/20', work: 90, break: 20 },
];

export default function StudyRoomScreen({ route, navigation }: Props) {
  const { channelId, channelName, guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [session, setSession] = useState<StudySession | null>(null);
  const [roomSettings, setRoomSettings] = useState<StudyRoomSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedAmbient, setSelectedAmbient] = useState<string | null>(null);
  const [timerDisplay, setTimerDisplay] = useState('25:00');
  const [selectedPreset, setSelectedPreset] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPhaseRef = useRef<string | null>(null);
  const hasDataRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      setLoadError(null);
      const settings = await studyRooms.getSettings(channelId);
      setRoomSettings(settings);
      hasDataRef.current = true;
      if (settings.pomodoroWork) {
        const presetIdx = WORK_PRESETS.findIndex(p => p.work === Math.round(settings.pomodoroWork / 60));
        if (presetIdx >= 0) setSelectedPreset(presetIdx);
      }
      if (settings.ambientSound) setSelectedAmbient(settings.ambientSound);
    } catch (err: any) {
      if (err.status !== 401) {
        const message = err?.message || 'Failed to load study room';
        if (hasDataRef.current) {
          toast.error(message);
        } else {
          setLoadError(message);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [channelId, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Timer tick
  useEffect(() => {
    if (session) {
      const tick = () => {
        const elapsed = Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
        const cycleDuration = session.workDuration + session.breakDuration;
        const positionInCycle = elapsed % cycleDuration;
        const isWork = positionInCycle < session.workDuration;
        const remaining = isWork ? session.workDuration - positionInCycle : cycleDuration - positionInCycle;
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        setTimerDisplay(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);

        // Haptic on phase change
        const currentPhase = isWork ? 'work' : 'break';
        if (lastPhaseRef.current && lastPhaseRef.current !== currentPhase) {
          notificationSuccess();
          toast.info(isWork ? 'Time to focus!' : 'Take a break!');
        }
        lastPhaseRef.current = currentPhase;
      };
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      setTimerDisplay(`${WORK_PRESETS[selectedPreset].work}:00`);
    }
  }, [session, selectedPreset]);

  const handleStart = async () => {
    mediumImpact();
    const preset = WORK_PRESETS[selectedPreset];
    try {
      const s = await studyRooms.start(channelId, { workDuration: preset.work * 60, breakDuration: preset.break * 60 });
      setSession(s);
      toast.success('Study session started!');
    } catch {
      toast.error('Failed to start session');
    }
  };

  const handleStop = async () => {
    mediumImpact();
    try {
      await studyRooms.end(channelId);
      setSession(null);
      toast.success('Session ended');
      fetchData();
    } catch {
      toast.error('Failed to stop session');
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    timerSection: { alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.lg },
    timerCircle: { width: 200, height: 200, borderRadius: 100, borderWidth: 4, borderColor: session ? colors.accentPrimary : colors.bgElevated, justifyContent: 'center', alignItems: 'center', ...(neo ? { borderRadius: 0, borderWidth: 4 } : {}) },
    timerText: { fontSize: 48, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
    phaseText: { fontSize: fontSize.sm, fontWeight: '600', color: session?.phase === 'work' ? colors.accentPrimary : colors.success, textTransform: 'uppercase' },
    presetRow: { flexDirection: 'row', gap: spacing.sm },
    presetBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: neo ? 0 : borderRadius.full, backgroundColor: colors.bgElevated, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    presetBtnActive: { backgroundColor: colors.accentPrimary },
    presetText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
    presetTextActive: { color: colors.white },
    actionBtn: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.md, borderRadius: neo ? 0 : borderRadius.full, backgroundColor: session ? colors.error : colors.accentPrimary, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    actionBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSize.md },
    ambientSection: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
    ambientLabel: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm, textTransform: 'uppercase' },
    ambientRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
    ambientBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: neo ? 0 : borderRadius.full, backgroundColor: colors.bgElevated, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    ambientBtnActive: { backgroundColor: colors.accentPrimary + '20', borderColor: colors.accentPrimary, borderWidth: 2 },
    ambientText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary },
    ambientTextActive: { color: colors.accentPrimary },
    leaderboardBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
    leaderboardText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.accentPrimary },
  }), [colors, spacing, fontSize, borderRadius, neo, session]);

  if (loading) return <LoadingScreen />;

  if (loadError && !roomSettings) {
    return <LoadErrorCard title="Failed to load study room" message={loadError} onRetry={() => { setLoading(true); fetchData(); }} />;
  }

  return (
    <PatternBackground>
      <View style={styles.timerSection}>
        <View style={styles.timerCircle}>
          <Text style={styles.timerText}>{timerDisplay}</Text>
          {session && <Text style={styles.phaseText}>{session.phase === 'work' ? 'Focus' : 'Break'}</Text>}
        </View>

        {!session && (
          <View style={styles.presetRow}>
            {WORK_PRESETS.map((p, i) => (
              <TouchableOpacity key={p.label} style={[styles.presetBtn, selectedPreset === i && styles.presetBtnActive]} onPress={() => setSelectedPreset(i)}>
                <Text style={[styles.presetText, selectedPreset === i && styles.presetTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.actionBtn} onPress={session ? handleStop : handleStart}>
          <Text style={styles.actionBtnText}>{session ? 'End Session' : 'Start Studying'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.ambientSection}>
        <Text style={styles.ambientLabel}>Ambient Sounds</Text>
        <View style={styles.ambientRow}>
          {AMBIENT_SOUNDS.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.ambientBtn, selectedAmbient === s.id && styles.ambientBtnActive]}
              onPress={() => { mediumImpact(); setSelectedAmbient(selectedAmbient === s.id ? null : s.id); }}
            >
              <Ionicons name={s.icon as any} size={16} color={selectedAmbient === s.id ? colors.accentPrimary : colors.textSecondary} />
              <Text style={[styles.ambientText, selectedAmbient === s.id && styles.ambientTextActive]}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.leaderboardBtn} onPress={() => navigation.navigate('StudyLeaderboard', { guildId })}>
        <Ionicons name="trophy-outline" size={18} color={colors.accentPrimary} />
        <Text style={styles.leaderboardText}>View Leaderboard</Text>
      </TouchableOpacity>
    </PatternBackground>
  );
}
