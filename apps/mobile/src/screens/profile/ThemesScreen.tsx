import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, fontSize } from '../../theme';

type Nav = NativeStackNavigationProp<any>;

interface Theme {
  id: string;
  name: string;
  author: string;
  accentColor: string;
  isDark: boolean;
  isInstalled: boolean;
  installs: number;
}

export function ThemesScreen() {
  const navigation = useNavigation<Nav>();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    async function fetchThemes() {
      try {
        const res = await fetch('/api/v1/themes', { credentials: 'include' });
        const data = await res.json();
        setThemes(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchThemes();
  }, []);

  const installTheme = async (themeId: string) => {
    try {
      await fetch(`/api/v1/themes/${themeId}/install`, { method: 'POST', credentials: 'include' });
      setThemes(themes.map(t => t.id === themeId ? { ...t, isInstalled: true } : t));
    } catch (e) {
      console.error(e);
    }
  };

  const applyTheme = async (themeId: string) => {
    try {
      await fetch('/api/v1/user/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ themeId }),
        credentials: 'include',
      });
    } catch (e) {
      console.error(e);
    }
  };

  const renderTheme = ({ item }: { item: Theme }) => (
    <View style={styles.themeCard}>
      <View style={[styles.colorPreview, { backgroundColor: item.accentColor }]} />
      <View style={styles.themeInfo}>
        <View style={styles.themeHeader}>
          <Text style={styles.themeName}>{item.name}</Text>
          <Text style={styles.themeType}>{item.isDark ? '🌙 Dark' : '☀️ Light'}</Text>
        </View>
        <Text style={styles.themeAuthor}>by {item.author}</Text>
        <View style={styles.themeFooter}>
          <Text style={styles.installCount}>⬇️ {item.installs.toLocaleString()}</Text>
          {item.isInstalled ? (
            <TouchableOpacity style={styles.applyBtn} onPress={() => applyTheme(item.id)}>
              <Text style={styles.applyText}>Apply</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.installBtn} onPress={() => installTheme(item.id)}>
              <Text style={styles.installText}>Install</Text>
            </TouchableOpacity>
          )}
        </View>
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
        <Text style={styles.headerTitle}>Themes</Text>
      </View>
      <FlatList
        data={themes}
        renderItem={renderTheme}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>No themes available</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.stroke.primary },
  headerTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text.primary },
  list: { padding: spacing.md },
  themeCard: { backgroundColor: colors.bg.secondary, borderRadius: radius.lg, marginBottom: spacing.md, overflow: 'hidden' },
  colorPreview: { height: 60 },
  themeInfo: { padding: spacing.md },
  themeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  themeName: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text.primary },
  themeType: { fontSize: fontSize.xs, color: colors.text.muted },
  themeAuthor: { fontSize: fontSize.sm, color: colors.text.muted, marginTop: 2 },
  themeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  installCount: { fontSize: fontSize.sm, color: colors.text.muted },
  installBtn: { backgroundColor: colors.brand.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  installText: { color: colors.text.primary, fontWeight: '600' },
  applyBtn: { backgroundColor: colors.accent.success, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  applyText: { color: colors.text.primary, fontWeight: '600' },
  emptyText: { color: colors.text.muted, textAlign: 'center', marginTop: spacing.xl },
});
