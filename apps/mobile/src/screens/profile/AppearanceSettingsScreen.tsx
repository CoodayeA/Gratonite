import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, spacing, radius } from '../../theme';

const FONT_SCALE_OPTIONS = [
  { value: 0.75, label: 'XS' },
  { value: 0.85, label: 'S' },
  { value: 1.0, label: 'M' },
  { value: 1.15, label: 'L' },
  { value: 1.3, label: 'XL' },
  { value: 1.5, label: '2XL' },
];

// ── Types ─────────────────────────────────────────────────────────────────

type ThemeOption = 'dark' | 'light' | 'oled' | 'system';
type MessageDisplay = 'cozy' | 'compact' | 'bubbles';

interface ThemeChoice {
  key: ThemeOption;
  label: string;
  description: string;
  previewBg: string;
  previewText: string;
}

interface DisplayChoice {
  key: MessageDisplay;
  label: string;
  description: string;
}

// ── Data ──────────────────────────────────────────────────────────────────

const THEME_OPTIONS: ThemeChoice[] = [
  {
    key: 'dark',
    label: 'Dark',
    description: 'Default dark theme',
    previewBg: '#111827',
    previewText: '#f1f5f9',
  },
  {
    key: 'light',
    label: 'Light',
    description: 'Light mode',
    previewBg: '#f8fafc',
    previewText: '#0f172a',
  },
  {
    key: 'oled',
    label: 'OLED Dark',
    description: 'True black for AMOLED',
    previewBg: '#000000',
    previewText: '#f1f5f9',
  },
  {
    key: 'system',
    label: 'System',
    description: 'Follow device setting',
    previewBg: '#374151',
    previewText: '#f1f5f9',
  },
];

const DISPLAY_OPTIONS: DisplayChoice[] = [
  {
    key: 'cozy',
    label: 'Cozy',
    description: 'More space between messages',
  },
  {
    key: 'compact',
    label: 'Compact',
    description: 'Fit more messages on screen',
  },
  {
    key: 'bubbles',
    label: 'Bubbles',
    description: 'Chat bubble style',
  },
];

// ── Main Screen ───────────────────────────────────────────────────────────

export function AppearanceSettingsScreen() {
  const [theme, setTheme] = useState<ThemeOption>('dark');
  const [fontScale, setFontScale] = useState(1.0);
  const [messageDisplay, setMessageDisplay] = useState<MessageDisplay>('cozy');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Theme Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>THEME</Text>
          <View style={styles.themeGrid}>
            {THEME_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.themeCard,
                  theme === option.key && styles.themeCardActive,
                ]}
                onPress={() => setTheme(option.key)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.themePreview,
                    { backgroundColor: option.previewBg },
                  ]}
                >
                  <View style={styles.themePreviewLines}>
                    <View
                      style={[
                        styles.themePreviewLine,
                        { backgroundColor: option.previewText, width: '80%' },
                      ]}
                    />
                    <View
                      style={[
                        styles.themePreviewLine,
                        { backgroundColor: option.previewText, width: '60%', opacity: 0.5 },
                      ]}
                    />
                    <View
                      style={[
                        styles.themePreviewLine,
                        { backgroundColor: option.previewText, width: '70%', opacity: 0.3 },
                      ]}
                    />
                  </View>
                </View>
                <Text
                  style={[
                    styles.themeLabel,
                    theme === option.key && styles.themeLabelActive,
                  ]}
                >
                  {option.label}
                </Text>
                <Text style={styles.themeDescription}>{option.description}</Text>
                {theme === option.key && (
                  <View style={styles.themeCheck}>
                    <Text style={styles.themeCheckText}>{'\u2713'}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Font Scale */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FONT SIZE</Text>
          <View style={styles.card}>
            <View style={styles.sliderHeader}>
              <Text style={styles.sliderLabel}>Font Scale</Text>
              <Text style={styles.sliderValue}>
                {Math.round(fontScale * 100)}%
              </Text>
            </View>
            <View style={styles.fontScaleRow}>
              {FONT_SCALE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.fontScaleButton,
                    fontScale === option.value && styles.fontScaleButtonActive,
                  ]}
                  onPress={() => setFontScale(option.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.fontScaleButtonText,
                      fontScale === option.value && styles.fontScaleButtonTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text
              style={[
                styles.previewText,
                { fontSize: fontSize.md * fontScale },
              ]}
            >
              Preview text at {Math.round(fontScale * 100)}%
            </Text>
          </View>
        </View>

        {/* Message Display */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MESSAGE DISPLAY</Text>
          <View style={styles.card}>
            {DISPLAY_OPTIONS.map((option, index) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.displayOption,
                  index < DISPLAY_OPTIONS.length - 1 && styles.displayOptionBorder,
                ]}
                onPress={() => setMessageDisplay(option.key)}
                activeOpacity={0.7}
              >
                <View style={styles.displayOptionContent}>
                  <Text style={styles.displayOptionLabel}>{option.label}</Text>
                  <Text style={styles.displayOptionDesc}>
                    {option.description}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radioOuter,
                    messageDisplay === option.key && styles.radioOuterActive,
                  ]}
                >
                  {messageDisplay === option.key && (
                    <View style={styles.radioInner} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Toggles */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCESSIBILITY</Text>
          <View style={styles.card}>
            <View style={[styles.toggleRow, styles.displayOptionBorder]}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>Reduced Motion</Text>
                <Text style={styles.toggleDesc}>
                  Minimize animations and transitions
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
            <View style={styles.toggleRow}>
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
          </View>
        </View>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing['5xl'],
  },

  // Section
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

  // Card
  card: {
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
    overflow: 'hidden',
  },

  // Theme grid
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  themeCard: {
    width: '47%',
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.stroke.primary,
    position: 'relative',
  },
  themeCardActive: {
    borderColor: colors.brand.primary,
  },
  themePreview: {
    height: 56,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    justifyContent: 'center',
  },
  themePreviewLines: {
    gap: 4,
  },
  themePreviewLine: {
    height: 4,
    borderRadius: 2,
  },
  themeLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  themeLabelActive: {
    color: colors.brand.primary,
  },
  themeDescription: {
    fontSize: fontSize.xs,
    color: colors.text.muted,
  },
  themeCheck: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeCheckText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '700',
  },

  // Slider
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sliderLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
  },
  sliderValue: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.brand.primary,
  },
  fontScaleRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  fontScaleButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fontScaleButtonActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primary + '15',
  },
  fontScaleButtonText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.muted,
  },
  fontScaleButtonTextActive: {
    color: colors.brand.primary,
  },
  previewText: {
    color: colors.text.secondary,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    textAlign: 'center',
  },

  // Display options
  displayOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  displayOptionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.primary,
  },
  displayOptionContent: {
    flex: 1,
  },
  displayOptionLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text.primary,
    marginBottom: 2,
  },
  displayOptionDesc: {
    fontSize: fontSize.sm,
    color: colors.text.muted,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.stroke.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: colors.brand.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.brand.primary,
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
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
