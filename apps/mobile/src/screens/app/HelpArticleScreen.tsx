import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../lib/theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'HelpArticle'>;

// Inline article data (same as HelpCenterScreen — in production this would be shared)
const ARTICLES_FULL: Record<string, { title: string; body: string[] }> = {
  'getting-started': { title: 'Getting Started with Gratonite', body: ['Download and install Gratonite from the official website or use the web app.', 'Create your account by providing a username, email, and password.', 'Explore the sidebar to find your servers, direct messages, and notifications.', 'Join an existing server using an invite link, or create your own.', 'Customize your experience in Settings.'] },
  'creating-server': { title: 'Creating Your First Server', body: ['Click the "+" button at the bottom of the server sidebar.', 'Choose a template or start from scratch.', 'Name your server and optionally add an icon.', 'Create channels for different topics or activities.', 'Invite friends using the invite link.'] },
  'account-security': { title: 'Account Security', body: ['Enable Two-Factor Authentication (2FA) in Settings > Security.', 'Use a strong, unique password for your account.', 'Review active sessions regularly in Settings > Sessions.', 'Never share your password or account tokens with anyone.'] },
  'roles-permissions': { title: 'Roles & Permissions', body: ['Roles define what members can do in your server.', 'Create roles in Server Settings > Roles.', 'Assign permissions like Manage Channels, Kick Members, etc.', 'Use channel-specific permission overrides for fine-grained control.'] },
  'channel-types': { title: 'Channel Types', body: ['Text channels for written conversations.', 'Voice channels for real-time audio.', 'Forum channels for organized discussions.', 'Wiki channels for knowledge bases.', 'Announcement channels for important updates.'] },
  'shop-cosmetics': { title: 'Shop & Cosmetics', body: ['Visit the Shop to browse available cosmetic items.', 'Use coins earned from daily claims and activity.', 'Equip items from your Inventory.', 'Items include avatar frames, nameplates, and badges.'] },
  'voice-features': { title: 'Voice Features', body: ['Join voice channels to talk with others.', 'Use voice effects to modify your voice in real-time.', 'Play sounds from the soundboard.', 'Listen to music together in music rooms.', 'Study together with Pomodoro timers in study rooms.'] },
};

export default function HelpArticleScreen({ route }: Props) {
  const { articleId } = route.params;
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();

  const article = ARTICLES_FULL[articleId] || { title: 'Article Not Found', body: ['This article could not be found.'] };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPrimary },
    scroll: { padding: spacing.xl },
    title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xl },
    paragraph: { fontSize: fontSize.md, color: colors.textSecondary, lineHeight: fontSize.md * 1.6, marginBottom: spacing.lg },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll}>
        <Text style={styles.title}>{article.title}</Text>
        {article.body.map((para, i) => (
          <Text key={i} style={styles.paragraph}>{para}</Text>
        ))}
      </ScrollView>
    </View>
  );
}
