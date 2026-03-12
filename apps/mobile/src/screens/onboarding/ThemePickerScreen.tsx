import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { themeStore } from '../../lib/themeStore';
import { themes, type ThemeName } from '../../lib/themes';
import { StarField, RainbowStrip } from '../../components/decorative';
import PatternBackground from '../../components/PatternBackground';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 56) / 2;

type StyleFamily = 'neobrutalism' | 'glassmorphism';

interface PreviewCardProps {
  family: StyleFamily;
  selected: boolean;
  isDark: boolean;
  onSelect: () => void;
  onToggleDark: () => void;
}

function PreviewCard({ family, selected, isDark, onSelect, onToggleDark }: PreviewCardProps) {
  const themeName: ThemeName = isDark ? `${family}-dark` : family;
  const t = themes[themeName];
  const isNeo = family === 'neobrutalism';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onSelect}
      style={[
        previewStyles.card,
        {
          width: CARD_W,
          backgroundColor: t.colors.bgSecondary,
          borderColor: selected ? t.colors.accentPrimary : t.colors.border,
          borderWidth: selected ? 3 : 1.5,
          borderRadius: isNeo ? 0 : 20,
        },
        isNeo && {
          shadowColor: '#000',
          shadowOffset: { width: 4, height: 4 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 8,
        },
        !isNeo && {
          shadowColor: t.colors.accentPrimary,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.15,
          shadowRadius: 24,
          elevation: 6,
        },
      ]}
    >
      {/* Mini app preview */}
      <View style={[previewStyles.previewArea, { backgroundColor: t.colors.bgPrimary, borderRadius: isNeo ? 0 : 12 }]}>
        {/* Mock header */}
        <View style={[previewStyles.mockHeader, { backgroundColor: t.colors.bgElevated, borderRadius: isNeo ? 0 : 8 }]}>
          <View style={[previewStyles.mockAvatar, { backgroundColor: t.colors.accentPrimary, borderRadius: isNeo ? 0 : 10 }]} />
          <View style={{ flex: 1, gap: 3 }}>
            <View style={[previewStyles.mockLine, { backgroundColor: t.colors.textPrimary, width: '60%', borderRadius: isNeo ? 0 : 3 }]} />
            <View style={[previewStyles.mockLine, { backgroundColor: t.colors.textMuted, width: '40%', borderRadius: isNeo ? 0 : 3 }]} />
          </View>
        </View>
        {/* Mock message rows */}
        {[0.7, 0.5, 0.85].map((w, i) => (
          <View key={i} style={[previewStyles.mockMsg, { borderRadius: isNeo ? 0 : 6 }]}>
            <View style={[previewStyles.mockDot, { backgroundColor: t.colors.accentPrimary, borderRadius: isNeo ? 0 : 5 }]} />
            <View style={[previewStyles.mockLine, { backgroundColor: t.colors.textSecondary, width: `${w * 100}%`, borderRadius: isNeo ? 0 : 3 }]} />
          </View>
        ))}
        {/* Accent bar */}
        <View style={[previewStyles.accentBar, { backgroundColor: t.colors.accentPrimary, borderRadius: isNeo ? 0 : 4 }]} />
      </View>

      {/* Label */}
      <Text style={[
        previewStyles.label,
        {
          color: t.colors.textPrimary,
          fontWeight: isNeo ? '900' : '600',
          textTransform: isNeo ? 'uppercase' : 'none',
          letterSpacing: isNeo ? 1 : 0,
        },
      ]}>
        {isNeo ? 'NEOBRUTALISM' : 'Glassmorphism'}
      </Text>
      <Text style={[previewStyles.subtitle, { color: t.colors.textSecondary }]}>
        {isNeo ? 'Bold & playful' : 'Sleek & modern'}
      </Text>

      {/* Light/Dark toggle */}
      <TouchableOpacity
        style={[
          previewStyles.toggleRow,
          {
            backgroundColor: t.colors.bgElevated,
            borderRadius: isNeo ? 0 : 20,
            borderWidth: isNeo ? 2 : 0,
            borderColor: isNeo ? t.colors.border : 'transparent',
          },
        ]}
        onPress={onToggleDark}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isDark ? 'moon' : 'sunny'}
          size={14}
          color={t.colors.accentPrimary}
        />
        <Text style={[previewStyles.toggleText, { color: t.colors.textPrimary }]}>
          {isDark ? 'Dark' : 'Light'}
        </Text>
      </TouchableOpacity>

      {/* Selection indicator */}
      {selected && (
        <View style={[previewStyles.checkBadge, { backgroundColor: t.colors.accentPrimary, borderRadius: isNeo ? 0 : 12 }]}>
          <Ionicons name="checkmark" size={14} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const previewStyles = StyleSheet.create({
  card: {
    padding: 12,
    gap: 10,
  },
  previewArea: {
    padding: 8,
    gap: 6,
    height: 140,
  },
  mockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    gap: 6,
  },
  mockAvatar: {
    width: 20,
    height: 20,
  },
  mockLine: {
    height: 6,
    opacity: 0.6,
  },
  mockMsg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  mockDot: {
    width: 10,
    height: 10,
  },
  accentBar: {
    height: 6,
    marginTop: 'auto',
  },
  label: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 2,
  },
  subtitle: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: -6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'center',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

interface ThemePickerScreenProps {
  onComplete: () => void;
}

export default function ThemePickerScreen({ onComplete }: ThemePickerScreenProps) {
  const [selectedFamily, setSelectedFamily] = useState<StyleFamily>('neobrutalism');
  const [neoDark, setNeoDark] = useState(false);
  const [glassDark, setGlassDark] = useState(true);

  const handleContinue = useCallback(async () => {
    const isDark = selectedFamily === 'neobrutalism' ? neoDark : glassDark;
    const themeName: ThemeName = isDark ? `${selectedFamily}-dark` : selectedFamily;
    themeStore.setTheme(themeName);
    try {
      await SecureStore.setItemAsync('gratonite_theme', themeName);
    } catch {}
    onComplete();
  }, [selectedFamily, neoDark, glassDark, onComplete]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0d0d1a',
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 40,
    },
    mascotWrap: {
      alignItems: 'center',
      marginBottom: 16,
    },
    mascotGlow: {
      position: 'absolute',
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: '#6c63ff',
      opacity: 0.2,
      top: -5,
    },
    mascot: {
      width: 70,
      height: 70,
      borderRadius: 18,
    },
    heading: {
      fontSize: 26,
      fontWeight: '900',
      color: '#fff',
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      lineHeight: 32,
    },
    headingAccent: {
      color: '#6c63ff',
    },
    subtitle: {
      fontSize: 14,
      color: '#9898b8',
      textAlign: 'center',
      marginTop: 6,
      marginBottom: 24,
    },
    cardRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 16,
    },
    stripWrap: {
      marginTop: 28,
      marginHorizontal: 40,
    },
    continueBtn: {
      marginTop: 24,
      backgroundColor: '#6c63ff',
      paddingVertical: 16,
      borderRadius: 14,
      alignItems: 'center',
      marginHorizontal: 20,
      shadowColor: '#6c63ff',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 10,
    },
    continueBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    switchLater: {
      color: '#6a6a8e',
      fontSize: 12,
      textAlign: 'center',
      marginTop: 12,
    },
  }), []);

  return (
    <PatternBackground>
      <StarField />

      <View style={styles.content}>
        {/* Mascot */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.mascotWrap}>
          <View style={styles.mascotGlow} />
          <Image
            source={require('../../../assets/splash-icon.png')}
            style={styles.mascot}
          />
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInDown.duration(500).delay(100)}>
          <Text style={styles.heading}>
            PICK YOUR{'\n'}
            <Text style={styles.headingAccent}>STYLE.</Text>
          </Text>
          <Text style={styles.subtitle}>Choose how Gratonite looks and feels</Text>
        </Animated.View>

        {/* Theme cards */}
        <Animated.View entering={FadeInDown.duration(600).delay(250)} style={styles.cardRow}>
          <PreviewCard
            family="neobrutalism"
            selected={selectedFamily === 'neobrutalism'}
            isDark={neoDark}
            onSelect={() => setSelectedFamily('neobrutalism')}
            onToggleDark={() => setNeoDark(!neoDark)}
          />
          <PreviewCard
            family="glassmorphism"
            selected={selectedFamily === 'glassmorphism'}
            isDark={glassDark}
            onSelect={() => setSelectedFamily('glassmorphism')}
            onToggleDark={() => setGlassDark(!glassDark)}
          />
        </Animated.View>

        {/* Rainbow strip */}
        <Animated.View entering={FadeInUp.duration(500).delay(400)} style={styles.stripWrap}>
          <RainbowStrip />
        </Animated.View>

        {/* Continue */}
        <Animated.View entering={FadeInUp.duration(500).delay(500)}>
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </TouchableOpacity>
          <Text style={styles.switchLater}>You can change this anytime in Settings</Text>
        </Animated.View>
      </View>
    </PatternBackground>
  );
}
