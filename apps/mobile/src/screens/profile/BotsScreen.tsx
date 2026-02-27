import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, fontSize } from '../../theme';

type Nav = NativeStackNavigationProp<any>;

interface Bot {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  tags: string[];
  isInstalled: boolean;
  rating: number;
  installs: number;
}

export function BotsScreen() {
  const navigation = useNavigation<Nav>();
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  React.useEffect(() => {
    async function fetchBots() {
      try {
        const res = await fetch('/api/v1/bots', { credentials: 'include' });
        const data = await res.json();
        setBots(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchBots();
  }, []);

  const installBot = async (botId: string) => {
    try {
      await fetch(`/api/v1/bots/${botId}/install`, { method: 'POST', credentials: 'include' });
      setBots(bots.map(b => b.id === botId ? { ...b, isInstalled: true } : b));
    } catch (e) {
      console.error(e);
    }
  };

  const filteredBots = bots.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const renderBot = ({ item }: { item: Bot }) => (
    <View style={styles.botCard}>
      <View style={styles.botHeader}>
        <View style={[styles.botAvatar, { backgroundColor: colors.brand.primary + '30' }]}>
          <Text style={styles.botInitial}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.botInfo}>
          <Text style={styles.botName}>{item.name}</Text>
          <View style={styles.ratingRow}>
            <Text style={styles.rating}>⭐ {item.rating.toFixed(1)}</Text>
            <Text style={styles.installs}>⬇️ {item.installs.toLocaleString()}</Text>
          </View>
        </View>
        {item.isInstalled ? (
          <View style={styles.installedBadge}><Text style={styles.installedText}>Installed</Text></View>
        ) : (
          <TouchableOpacity style={styles.installBtn} onPress={() => installBot(item.id)}>
            <Text style={styles.installText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.botDesc} numberOfLines={2}>{item.description}</Text>
      <View style={styles.tagsRow}>
        {item.tags.slice(0, 3).map((tag) => (
          <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bots</Text>
      </View>
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search bots..."
          placeholderTextColor={colors.text.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>
      <FlatList
        data={filteredBots}
        renderItem={renderBot}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No bots found</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.stroke.primary },
  headerTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text.primary },
  searchBox: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.stroke.primary },
  searchInput: { backgroundColor: colors.bg.secondary, borderRadius: radius.md, padding: spacing.sm, color: colors.text.primary },
  list: { padding: spacing.md },
  botCard: { backgroundColor: colors.bg.secondary, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  botHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  botAvatar: { width: 48, height: 48, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  botInitial: { fontSize: fontSize.xl, fontWeight: '700', color: colors.brand.primary },
  botInfo: { flex: 1, marginLeft: spacing.md },
  botName: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text.primary },
  ratingRow: { flexDirection: 'row', gap: spacing.md },
  rating: { fontSize: fontSize.sm, color: colors.text.muted },
  installs: { fontSize: fontSize.sm, color: colors.text.muted },
  installBtn: { backgroundColor: colors.brand.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  installText: { color: colors.text.primary, fontWeight: '600' },
  installedBadge: { backgroundColor: colors.accent.success + '30', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  installedText: { color: colors.accent.success, fontWeight: '600', fontSize: fontSize.sm },
  botDesc: { fontSize: fontSize.sm, color: colors.text.secondary, marginBottom: spacing.sm },
  tagsRow: { flexDirection: 'row', gap: spacing.xs },
  tag: { backgroundColor: colors.bg.primary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  tagText: { fontSize: fontSize.xs, color: colors.text.muted },
  emptyText: { color: colors.text.muted, textAlign: 'center', marginTop: spacing.xl },
});
