import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { stage } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { mediumImpact } from '../../lib/haptics';
import LoadingScreen from '../../components/LoadingScreen';
import Avatar from '../../components/Avatar';
import type { StageSession, StageSpeaker } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'StageChannel'>;

export default function StageChannelScreen({ route, navigation }: Props) {
  const { channelId, channelName, guildId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const { user } = useAuth();
  const [session, setSession] = useState<StageSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStartModal, setShowStartModal] = useState(false);
  const [topic, setTopic] = useState('');
  const [showManage, setShowManage] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const data = await stage.getSession(channelId);
      setSession(data);
    } catch {
      toast.error('Failed to load stage');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  const isHost = session?.hostId === user?.id;
  const isSpeaker = session?.speakers.some(s => s.userId === user?.id && (s.role === 'speaker' || s.role === 'host'));

  const handleStart = async () => {
    if (!topic.trim()) return;
    mediumImpact();
    try {
      const s = await stage.start(channelId, { topic: topic.trim() });
      setSession(s);
      setShowStartModal(false);
      setTopic('');
      toast.success('Stage started!');
    } catch {
      toast.error('Failed to start stage');
    }
  };

  const handleEnd = async () => {
    mediumImpact();
    try {
      await stage.end(channelId);
      setSession(null);
      toast.success('Stage ended');
    } catch {
      toast.error('Failed to end stage');
    }
  };

  const handleRaiseHand = async () => {
    mediumImpact();
    try {
      await stage.requestSpeak(channelId);
      toast.success('Hand raised!');
    } catch {
      toast.error('Failed to raise hand');
    }
  };

  const handlePromote = async (userId: string) => {
    try {
      await stage.addSpeaker(channelId, userId);
      toast.success('Promoted to speaker');
      fetchSession();
    } catch {
      toast.error('Failed to promote');
    }
  };

  const handleDemote = async (userId: string) => {
    try {
      await stage.removeSpeaker(channelId, userId);
      toast.success('Moved to audience');
      fetchSession();
    } catch {
      toast.error('Failed to demote');
    }
  };

  const speakers = session?.speakers.filter(s => s.role === 'host' || s.role === 'speaker') ?? [];
  const audience = session?.speakers.filter(s => s.role === 'audience') ?? [];

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    topicBar: { padding: spacing.lg, backgroundColor: colors.bgSecondary, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
    topicText: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
    topicLabel: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.xs, textTransform: 'uppercase' },
    speakerSection: { padding: spacing.lg },
    sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.md },
    speakerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, justifyContent: 'center' },
    speakerCard: { alignItems: 'center', width: 80, gap: spacing.xs },
    speakerRing: { borderWidth: 3, borderRadius: 40, padding: 3 },
    speakerName: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
    speakerRole: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
    audienceSection: { flex: 1, borderTopWidth: 1, borderTopColor: colors.border },
    audienceRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
    audienceName: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '600' },
    controls: { flexDirection: 'row', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: spacing.xxxl },
    controlBtn: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', ...(neo ? { borderRadius: 0, borderWidth: 2, borderColor: colors.border } : {}) },
    noSession: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
    noSessionText: { fontSize: fontSize.lg, color: colors.textMuted },
    startBtn: { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.md, borderRadius: neo ? 0 : borderRadius.full, backgroundColor: colors.accentPrimary },
    startBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSize.md },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    modalCard: { backgroundColor: colors.bgSecondary, borderRadius: neo ? 0 : borderRadius.xl, padding: spacing.xl, width: '100%', maxWidth: 360, ...(neo ? { borderWidth: 3, borderColor: colors.border } : {}) },
    modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.lg },
    modalInput: { backgroundColor: colors.bgElevated, borderRadius: neo ? 0 : borderRadius.md, padding: spacing.md, color: colors.textPrimary, fontSize: fontSize.md, marginBottom: spacing.lg, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    modalBtnRow: { flexDirection: 'row', gap: spacing.md },
    modalBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: neo ? 0 : borderRadius.md, alignItems: 'center' },
    manageBtn: { padding: spacing.xs },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  if (loading) return <LoadingScreen />;

  if (!session) {
    return (
      <View style={[styles.container, styles.noSession]}>
        <Ionicons name="mic-outline" size={64} color={colors.textMuted} />
        <Text style={styles.noSessionText}>No active stage</Text>
        <TouchableOpacity style={styles.startBtn} onPress={() => setShowStartModal(true)}>
          <Text style={styles.startBtnText}>Start Stage</Text>
        </TouchableOpacity>

        <Modal visible={showStartModal} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setShowStartModal(false)}>
            <Pressable style={styles.modalCard} onPress={e => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Start a Stage</Text>
              <TextInput style={styles.modalInput} placeholder="What's the topic?" placeholderTextColor={colors.textMuted} value={topic} onChangeText={setTopic} />
              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.bgElevated }]} onPress={() => setShowStartModal(false)}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.accentPrimary }]} onPress={handleStart}>
                  <Text style={{ color: colors.white, fontWeight: '700' }}>Start</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }

  return (
    <PatternBackground>
      <View style={styles.topicBar}>
        <Text style={styles.topicLabel}>Stage Topic</Text>
        <Text style={styles.topicText}>{session.topic}</Text>
      </View>

      <View style={styles.speakerSection}>
        <Text style={styles.sectionTitle}>Speakers ({speakers.length})</Text>
        <View style={styles.speakerGrid}>
          {speakers.map((s) => (
            <TouchableOpacity key={s.userId} style={styles.speakerCard} onPress={isHost && s.role !== 'host' ? () => handleDemote(s.userId) : undefined}>
              <View style={[styles.speakerRing, { borderColor: s.isSpeaking ? colors.success : 'transparent' }]}>
                <Avatar userId={s.userId} avatarHash={s.avatarHash} name={s.displayName || s.username} size={52} />
              </View>
              <Text style={styles.speakerName} numberOfLines={1}>{s.displayName || s.username}</Text>
              <Text style={[styles.speakerRole, { color: s.role === 'host' ? colors.accentPrimary : colors.success }]}>{s.role}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.audienceSection}>
        <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
          <Text style={styles.sectionTitle}>Audience ({audience.length})</Text>
        </View>
        <FlatList
          data={audience}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => (
            <View style={styles.audienceRow}>
              <Avatar userId={item.userId} avatarHash={item.avatarHash} name={item.displayName || item.username} size={32} />
              <Text style={styles.audienceName}>{item.displayName || item.username}</Text>
              {isHost && (
                <TouchableOpacity style={styles.manageBtn} onPress={() => handlePromote(item.userId)}>
                  <Ionicons name="mic-outline" size={20} color={colors.accentPrimary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      </View>

      <View style={styles.controls}>
        {!isSpeaker && (
          <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.accentPrimary }]} onPress={handleRaiseHand}>
            <Ionicons name="hand-left" size={24} color={colors.white} />
          </TouchableOpacity>
        )}
        {isHost && (
          <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.error }]} onPress={handleEnd}>
            <Ionicons name="close" size={24} color={colors.white} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.error }]} onPress={() => navigation.goBack()}>
          <Ionicons name="exit-outline" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>
    </PatternBackground>
  );
}