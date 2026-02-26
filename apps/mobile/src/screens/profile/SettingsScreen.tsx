import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/auth.store';
import { getFileUrl } from '../../lib/api';
import { Avatar } from '../../components/ui/Avatar';
import { colors, fontSize, spacing, radius } from '../../theme';

// ── Types ─────────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'Settings'>;

interface MenuItem {
  icon: string;
  label: string;
  value?: string;
  screen?: keyof ProfileStackParamList;
  onPress?: () => void;
  danger?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getTierBadge(tier: string): { label: string; color: string } | null {
  switch (tier) {
    case 'premium':
      return { label: 'Premium', color: '#818cf8' };
    case 'pro':
      return { label: 'Pro', color: '#a78bfa' };
    case 'nitro':
      return { label: 'Nitro', color: '#f472b6' };
    default:
      return null;
  }
}

// ── App version ───────────────────────────────────────────────────────────

const APP_VERSION = '1.0.0';

// ── Main Screen ───────────────────────────────────────────────────────────

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = useCallback(() => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  }, [logout]);

  const tierBadge = getTierBadge(user?.tier ?? '');
  const bannerUri = user?.banner ? getFileUrl(user.banner) : null;

  // ── Menu Sections ─────────────────────────────────────────────────────

  const sections: MenuSection[] = [
    {
      title: 'Account',
      items: [
        {
          icon: '\uD83D\uDCE7',
          label: 'Account',
          value: user?.email,
          screen: 'AccountSettings',
        },
        {
          icon: '\uD83D\uDC64',
          label: 'Edit Profile',
          value: user?.displayName ?? user?.username,
          screen: 'ProfileEdit',
        },
      ],
    },
    {
      title: 'App Settings',
      items: [
        {
          icon: '\uD83C\uDFA8',
          label: 'Appearance',
          value: 'Dark',
          screen: 'AppearanceSettings',
        },
        {
          icon: '\uD83D\uDD14',
          label: 'Notifications',
          screen: 'NotificationSettings',
        },
        {
          icon: '\uD83D\uDD12',
          label: 'Privacy & Security',
          screen: 'SecuritySettings',
        },
        {
          icon: '\u267F',
          label: 'Accessibility',
          screen: 'AccessibilitySettings',
        },
      ],
    },
    {
      title: 'Fun',
      items: [
        {
          icon: '\uD83D\uDED2',
          label: 'Shop',
          screen: 'Shop',
        },
        {
          icon: '\uD83D\uDCB0',
          label: 'Wallet',
          screen: 'Wallet',
        },
        {
          icon: '\uD83C\uDFC6',
          label: 'Leaderboard',
          screen: 'Leaderboard',
        },
      ],
    },
  ];

  // ── Render Menu Item ──────────────────────────────────────────────────

  const renderMenuItem = useCallback(
    (item: MenuItem, index: number, isLast: boolean) => {
      const handlePress = () => {
        if (item.onPress) {
          item.onPress();
        } else if (item.screen) {
          navigation.navigate(item.screen as any);
        }
      };

      return (
        <TouchableOpacity
          key={`${item.label}-${index}`}
          style={[
            styles.menuItem,
            !isLast && styles.menuItemBorder,
            item.danger && styles.menuItemDanger,
          ]}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <Text style={styles.menuItemIcon}>{item.icon}</Text>
          <View style={styles.menuItemContent}>
            <Text
              style={[
                styles.menuItemLabel,
                item.danger && styles.menuItemLabelDanger,
              ]}
            >
              {item.label}
            </Text>
            {item.value && (
              <Text style={styles.menuItemValue} numberOfLines={1}>
                {item.value}
              </Text>
            )}
          </View>
          <Text style={styles.menuItemChevron}>{'\u203A'}</Text>
        </TouchableOpacity>
      );
    },
    [navigation],
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>You</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card with Banner */}
        <View style={styles.profileCard}>
          {/* Banner */}
          {bannerUri ? (
            <Image
              source={{ uri: bannerUri }}
              style={styles.banner}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.banner, styles.bannerFallback]} />
          )}

          {/* Avatar - overlaps banner */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatarRing}>
              <Avatar
                size={72}
                userId={user?.id}
                avatarHash={user?.avatar ?? undefined}
                displayName={user?.displayName ?? undefined}
                username={user?.username}
              />
            </View>
          </View>

          {/* Name & Badge */}
          <Text style={styles.displayName}>
            {user?.displayName ?? user?.username ?? 'User'}
          </Text>
          <View style={styles.handleRow}>
            <Text style={styles.handle}>@{user?.username ?? 'unknown'}</Text>
            {tierBadge && (
              <View
                style={[
                  styles.tierBadge,
                  { backgroundColor: tierBadge.color + '20' },
                ]}
              >
                <Text style={[styles.tierBadgeText, { color: tierBadge.color }]}>
                  {tierBadge.label}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Menu Sections */}
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, index) =>
                renderMenuItem(
                  item,
                  index,
                  index === section.items.length - 1,
                ),
              )}
            </View>
          </View>
        ))}

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.8}
            >
              <Text style={styles.logoutIcon}>{'\uD83D\uDEAA'}</Text>
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* App Version */}
        <Text style={styles.version}>Gratonite v{APP_VERSION}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.primary,
  },
  headerTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: '700',
    color: colors.text.primary,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing['5xl'],
  },

  // Profile Card
  profileCard: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    overflow: 'hidden',
  },
  banner: {
    height: 100,
    width: '100%',
  },
  bannerFallback: {
    backgroundColor: colors.brand.primary,
  },
  avatarContainer: {
    alignItems: 'center',
    marginTop: -40,
  },
  avatarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  displayName: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  handle: {
    fontSize: fontSize.md,
    color: colors.text.secondary,
  },
  tierBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tierBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    overflow: 'hidden',
  },

  // Menu Item
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.primary,
  },
  menuItemDanger: {},
  menuItemIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
  },
  menuItemLabelDanger: {
    color: colors.accent.error,
  },
  menuItemValue: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
    marginTop: 1,
  },
  menuItemChevron: {
    fontSize: 22,
    color: colors.text.muted,
    fontWeight: '300',
  },

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    gap: spacing.sm,
  },
  logoutIcon: {
    fontSize: 16,
  },
  logoutText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.accent.error,
  },

  // Version
  version: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
