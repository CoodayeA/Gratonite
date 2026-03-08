import React, { useRef, useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../../lib/theme';

const { width: SCREEN_W } = Dimensions.get('window');

const ONBOARDING_KEY = 'gratonite_onboarding_complete';

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface Slide {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const SLIDES: Slide[] = [
  { title: 'Welcome to Gratonite', subtitle: 'Your next-gen chat experience', icon: 'planet', color: '#6C63FF' },
  { title: 'Stay Connected', subtitle: 'Chat with friends and communities in real-time', icon: 'chatbubbles', color: '#FF6584' },
  { title: 'Express Yourself', subtitle: 'React with emojis, stickers, and custom statuses', icon: 'happy', color: '#43E97B' },
  { title: 'Get Started', subtitle: 'Create an account or log in to begin', icon: 'rocket', color: '#F9A826' },
];

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleComplete = async () => {
    await SecureStore.setItemAsync(ONBOARDING_KEY, 'true');
    onComplete();
  };

  const handleNext = () => {
    if (activeIndex === SLIDES.length - 1) {
      handleComplete();
    } else {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    skipBtn: {
      position: 'absolute',
      top: 60,
      right: spacing.lg,
      zIndex: 10,
      padding: spacing.sm,
    },
    skipText: {
      color: colors.textMuted,
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    slide: {
      width: SCREEN_W,
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xxxl,
    },
    iconCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.xxxl,
      ...(neo ? { borderWidth: 3, borderColor: '#000' } : {}),
    },
    title: {
      fontSize: fontSize.xxl,
      fontWeight: neo ? '800' : '700',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.md,
      ...(neo ? { textTransform: 'uppercase' as const } : {}),
    },
    subtitle: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    footer: {
      paddingHorizontal: spacing.xxxl,
      paddingBottom: 60,
      alignItems: 'center',
      gap: spacing.lg,
    },
    dots: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.bgElevated,
    },
    dotActive: {
      backgroundColor: colors.accentPrimary,
      width: 24,
    },
    nextBtn: {
      backgroundColor: colors.accentPrimary,
      paddingHorizontal: spacing.xxxl * 2,
      paddingVertical: spacing.lg,
      borderRadius: borderRadius.md,
      ...(neo ? { borderWidth: neo.borderWidth, borderColor: colors.border, shadowColor: neo.shadowColor, shadowOffset: neo.shadowOffset, shadowOpacity: neo.shadowOpacity, shadowRadius: neo.shadowRadius } : {}),
    },
    nextText: {
      color: colors.white,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={styles.slide}>
      <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
        <Ionicons name={item.icon} size={56} color={item.color} />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipBtn} onPress={handleComplete}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(_, i) => i.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          setActiveIndex(idx);
        }}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
          <Text style={styles.nextText}>
            {activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
