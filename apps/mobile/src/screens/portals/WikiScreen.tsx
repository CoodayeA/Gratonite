import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, fontSize } from '../../theme';

type Nav = NativeStackNavigationProp<any>;
type RouteProps = RouteProp<{ params: { guildId: string; channelId: string } }, 'params'>;

interface WikiPage {
  id: string;
  title: string;
  content: string;
  parentId: string | null;
  isPinned: boolean;
  updatedAt: string;
}

export function WikiScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const { guildId, channelId } = route.params;
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null);

  React.useEffect(() => {
    async function fetchPages() {
      if (!channelId) return;
      try {
        const res = await fetch(`/api/v1/channels/${channelId}/wiki`, {
          credentials: 'include',
        });
        const data = await res.json();
        setPages(data);
        if (data.length > 0) setSelectedPage(data[0]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchPages();
  }, [channelId]);

  const renderPage = ({ item }: { item: WikiPage }) => (
    <TouchableOpacity
      style={[styles.pageItem, selectedPage?.id === item.id && styles.pageItemSelected]}
      onPress={() => setSelectedPage(item)}
    >
      <Text style={styles.pageIcon}>{item.isPinned ? '📌' : '📄'}</Text>
      <View style={styles.pageInfo}>
        <Text style={styles.pageTitle}>{item.title}</Text>
        <Text style={styles.pageDate}>
          {new Date(item.updatedAt).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Wiki</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.sidebar}>
          <FlatList
            data={pages}
            renderItem={renderPage}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<Text style={styles.emptyText}>No pages yet</Text>}
          />
        </View>
        <View style={styles.pageContent}>
          {selectedPage ? (
            <>
              <Text style={styles.contentTitle}>{selectedPage.title}</Text>
              <Text style={styles.contentText}>{selectedPage.content}</Text>
            </>
          ) : (
            <Text style={styles.emptyText}>Select a page to view</Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.stroke.primary },
  headerTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text.primary },
  content: { flex: 1, flexDirection: 'row' },
  sidebar: { width: '35%', borderRightWidth: 1, borderRightColor: colors.stroke.primary },
  pageItem: { flexDirection: 'row', padding: spacing.sm, alignItems: 'center' },
  pageItemSelected: { backgroundColor: colors.bg.secondary },
  pageIcon: { fontSize: 18, marginRight: spacing.sm },
  pageInfo: { flex: 1 },
  pageTitle: { fontSize: fontSize.sm, color: colors.text.primary, fontWeight: '500' },
  pageDate: { fontSize: fontSize.xs, color: colors.text.muted },
  pageContent: { flex: 1, padding: spacing.md },
  contentTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text.primary, marginBottom: spacing.md },
  contentText: { fontSize: fontSize.md, color: colors.text.secondary, lineHeight: 22 },
  emptyText: { color: colors.text.muted, textAlign: 'center', marginTop: spacing.xl },
});
