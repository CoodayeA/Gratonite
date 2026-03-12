import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auctions as auctionsApi } from '../../lib/api';
import { useTheme } from '../../lib/theme';
import { useToast } from '../../contexts/ToastContext';
import { mediumImpact } from '../../lib/haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateAuction'>;

const DURATIONS = [
  { label: '1 Hour', value: 1 },
  { label: '6 Hours', value: 6 },
  { label: '24 Hours', value: 24 },
  { label: '3 Days', value: 72 },
  { label: '7 Days', value: 168 },
];

export default function CreateAuctionScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [cosmeticId, setCosmeticId] = useState('');
  const [startingPrice, setStartingPrice] = useState('100');
  const [selectedDuration, setSelectedDuration] = useState(24);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!cosmeticId.trim()) { toast.error('Please enter a cosmetic ID'); return; }
    const price = parseInt(startingPrice);
    if (!price || price < 1) { toast.error('Invalid starting price'); return; }
    setCreating(true);
    mediumImpact();
    try {
      await auctionsApi.create({ cosmeticId: cosmeticId.trim(), startingPrice: price, durationHours: selectedDuration });
      toast.success('Auction created!');
      navigation.goBack();
    } catch {
      toast.error('Failed to create auction');
    } finally {
      setCreating(false);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    scroll: { padding: spacing.xl },
    label: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm, marginTop: spacing.lg, textTransform: 'uppercase' },
    input: { backgroundColor: colors.bgElevated, borderRadius: neo ? 0 : borderRadius.md, padding: spacing.md, color: colors.textPrimary, fontSize: fontSize.md, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    durationBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: neo ? 0 : borderRadius.full, backgroundColor: colors.bgElevated, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    durationBtnActive: { backgroundColor: colors.accentPrimary },
    durationText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
    durationTextActive: { color: colors.white },
    createBtn: { marginTop: spacing.xxxl, backgroundColor: colors.accentPrimary, borderRadius: neo ? 0 : borderRadius.md, padding: spacing.lg, alignItems: 'center', ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    createBtnText: { color: colors.white, fontWeight: '700', fontSize: fontSize.md },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={[styles.label, { marginTop: 0 }]}>Cosmetic ID</Text>
        <TextInput style={styles.input} placeholder="Enter cosmetic ID" placeholderTextColor={colors.textMuted} value={cosmeticId} onChangeText={setCosmeticId} />

        <Text style={styles.label}>Starting Price</Text>
        <TextInput style={styles.input} placeholder="100" placeholderTextColor={colors.textMuted} value={startingPrice} onChangeText={setStartingPrice} keyboardType="number-pad" />

        <Text style={styles.label}>Duration</Text>
        <View style={styles.durationRow}>
          {DURATIONS.map(d => (
            <TouchableOpacity key={d.value} style={[styles.durationBtn, selectedDuration === d.value && styles.durationBtnActive]} onPress={() => setSelectedDuration(d.value)}>
              <Text style={[styles.durationText, selectedDuration === d.value && styles.durationTextActive]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={creating}>
          <Text style={styles.createBtnText}>{creating ? 'Creating...' : 'Create Auction'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}