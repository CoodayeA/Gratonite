import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, spacing, radius } from '../../theme';

export function SecuritySettingsScreen() {
  const [blockedDMs, setBlockedDMs] = useState(false);
  const [friendRequests, setFriendRequests] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [activityStatus, setActivityStatus] = useState(true);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Direct Messages */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DIRECT MESSAGES</Text>
          <View style={styles.card}>
            <View style={[styles.toggleRow, styles.rowBorder]}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Block DMs from Strangers</Text>
                <Text style={styles.toggleDesc}>
                  Only receive DMs from friends and portal members
                </Text>
              </View>
              <Switch
                value={blockedDMs}
                onValueChange={setBlockedDMs}
                trackColor={{
                  false: colors.stroke.secondary,
                  true: colors.brand.primary,
                }}
                thumbColor="#ffffff"
              />
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Allow Friend Requests</Text>
                <Text style={styles.toggleDesc}>
                  Let others send you friend requests
                </Text>
              </View>
              <Switch
                value={friendRequests}
                onValueChange={setFriendRequests}
                trackColor={{
                  false: colors.stroke.secondary,
                  true: colors.brand.primary,
                }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRIVACY</Text>
          <View style={styles.card}>
            <View style={[styles.toggleRow, styles.rowBorder]}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Read Receipts</Text>
                <Text style={styles.toggleDesc}>
                  Let others see when you have read their messages
                </Text>
              </View>
              <Switch
                value={readReceipts}
                onValueChange={setReadReceipts}
                trackColor={{
                  false: colors.stroke.secondary,
                  true: colors.brand.primary,
                }}
                thumbColor="#ffffff"
              />
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Activity Status</Text>
                <Text style={styles.toggleDesc}>
                  Show when you are online or active
                </Text>
              </View>
              <Switch
                value={activityStatus}
                onValueChange={setActivityStatus}
                trackColor={{
                  false: colors.stroke.secondary,
                  true: colors.brand.primary,
                }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing['5xl'],
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  card: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.primary,
  },
  toggleContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  toggleLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 2,
  },
  toggleDesc: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },
});
