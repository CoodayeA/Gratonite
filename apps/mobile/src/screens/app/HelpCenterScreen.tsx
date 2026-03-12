import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import type { HelpCategory } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'HelpCenter'>;

interface Article {
  id: string;
  title: string;
  description: string;
  category: string;
}

const ARTICLES: Article[] = [
  { id: 'getting-started', title: 'Getting Started with Gratonite', description: 'Learn the basics of navigating and using Gratonite.', category: 'Getting Started' },
  { id: 'creating-server', title: 'Creating Your First Portal', description: 'Step-by-step guide to setting up a new portal.', category: 'Getting Started' },
  { id: 'invite-friends', title: 'Inviting Friends', description: 'How to invite friends and share invite links.', category: 'Getting Started' },
  { id: 'account-security', title: 'Account Security', description: 'Set up 2FA, manage sessions, and keep your account safe.', category: 'Account & Security' },
  { id: 'password-reset', title: 'Resetting Your Password', description: 'How to reset your password if you forgot it.', category: 'Account & Security' },
  { id: 'roles-permissions', title: 'Roles & Permissions', description: 'Understanding roles, permissions, and access control.', category: 'Portals & Channels' },
  { id: 'channel-types', title: 'Channel Types', description: 'Text, voice, forum, wiki, announcement, and more.', category: 'Portals & Channels' },
  { id: 'moderation-tools', title: 'Moderation Tools', description: 'Bans, timeouts, word filters, and automod setup.', category: 'Portals & Channels' },
  { id: 'shop-cosmetics', title: 'Shop & Cosmetics', description: 'Browse and purchase cosmetic items.', category: 'Cosmetics & Shop' },
  { id: 'connections', title: 'Social Connections', description: 'Link your GitHub, Twitch, and other accounts.', category: 'Cosmetics & Shop' },
  { id: 'economy', title: 'Economy & Wallet', description: 'Earning and spending coins in Gratonite.', category: 'Cosmetics & Shop' },
  { id: 'marketplace', title: 'Marketplace Guide', description: 'Buying and selling items in the marketplace.', category: 'Marketplace & Auctions' },
  { id: 'auctions', title: 'Auctions', description: 'How to create and bid on auctions.', category: 'Marketplace & Auctions' },
  { id: 'messaging', title: 'Messaging Features', description: 'Threads, reactions, pins, bookmarks, and more.', category: 'Messaging & Chat' },
  { id: 'voice-features', title: 'Voice Features', description: 'Voice channels, effects, soundboard, and music rooms.', category: 'Messaging & Chat' },
  { id: 'privacy', title: 'Privacy Settings', description: 'Control who can message you and see your status.', category: 'Privacy & Safety' },
  { id: 'blocking', title: 'Blocking & Muting', description: 'How to block or mute other users.', category: 'Privacy & Safety' },
  { id: 'bots', title: 'Adding Bots', description: 'How to find and add bots to your portal.', category: 'Bots & Integrations' },
  { id: 'webhooks', title: 'Webhooks', description: 'Setting up webhooks for integrations.', category: 'Bots & Integrations' },
  { id: 'premium', title: 'Premium Features', description: 'What you get with Gratonite Premium.', category: 'Billing & Premium' },
];

const CATEGORIES: HelpCategory[] = ['All', 'Getting Started', 'Account & Security', 'Portals & Channels', 'Cosmetics & Shop', 'Marketplace & Auctions', 'Messaging & Chat', 'Privacy & Safety', 'Bots & Integrations', 'Billing & Premium'];

export default function HelpCenterScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory>('All');

  const filtered = useMemo(() => {
    let list = ARTICLES;
    if (selectedCategory !== 'All') list = list.filter(a => a.category === selectedCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
    }
    return list;
  }, [search, selectedCategory]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    searchBar: { margin: spacing.lg, backgroundColor: colors.bgElevated, borderRadius: neo ? 0 : borderRadius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    searchInput: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md },
    categoryScroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    categoryBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: neo ? 0 : borderRadius.full, backgroundColor: colors.bgElevated, marginRight: spacing.sm, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    categoryBtnActive: { backgroundColor: colors.accentPrimary },
    categoryText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary },
    categoryTextActive: { color: colors.white },
    card: { marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.bgElevated, borderRadius: neo ? 0 : borderRadius.lg, padding: spacing.lg, ...(neo ? { borderWidth: 2, borderColor: colors.border } : {}) },
    cardTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
    cardDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
    cardCategory: { fontSize: fontSize.xs, color: colors.accentPrimary, fontWeight: '600', marginTop: spacing.sm },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <PatternBackground>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput style={styles.searchInput} placeholder="Search articles..." placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
        {search.length > 0 && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={colors.textMuted} /></TouchableOpacity>}
      </View>

      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.categoryBtn, selectedCategory === item && styles.categoryBtnActive]} onPress={() => setSelectedCategory(item)}>
            <Text style={[styles.categoryText, selectedCategory === item && styles.categoryTextActive]}>{item}</Text>
          </TouchableOpacity>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('HelpArticle', { articleId: item.id })}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDesc}>{item.description}</Text>
            <Text style={styles.cardCategory}>{item.category}</Text>
          </TouchableOpacity>
        )}
      />
    </PatternBackground>
  );
}
