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

export function AccessibilitySettingsScreen() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [largerText, setLargerText] = useState(false);
  const [screenReader, setScreenReader] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Motion */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MOTION</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Reduced Motion</Text>
                <Text style={styles.toggleDesc}>
                  Minimize animations and transitions throughout the app
                </Text>
              </View>
              <Switch
                value={reducedMotion}
                onValueChange={setReducedMotion}
                trackColor={{
                  false: colors.stroke.secondary,
                  true: colors.brand.primary,
                }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </View>

        {/* Display */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DISPLAY</Text>
          <View style={styles.card}>
            <View style={[styles.toggleRow, styles.rowBorder]}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>High Contrast</Text>
                <Text style={styles.toggleDesc}>
                  Increase contrast for better visibility
                </Text>
              </View>
              <Switch
                value={highContrast}
                onValueChange={setHighContrast}
                trackColor={{
                  false: colors.stroke.secondary,
                  true: colors.brand.primary,
                }}
                thumbColor="#ffffff"
              />
            </View>
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Larger Text</Text>
                <Text style={styles.toggleDesc}>
                  Use larger text sizes throughout the app
                </Text>
              </View>
              <Switch
                value={largerText}
                onValueChange={setLargerText}
                trackColor={{
                  false: colors.stroke.secondary,
                  true: colors.brand.primary,
                }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        </View>

        {/* Screen Reader */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SCREEN READER</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Optimized for Screen Readers</Text>
                <Text style={styles.toggleDesc}>
                  Improve compatibility with VoiceOver and TalkBack
                </Text>
              </View>
              <Switch
                value={screenReader}
                onValueChange={setScreenReader}
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
