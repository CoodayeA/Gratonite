import React, { useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../../lib/theme';
import { StarField, RainbowStrip } from '../../components/decorative';
import PatternBackground from '../../components/PatternBackground';

const { width: SCREEN_W } = Dimensions.get('window');

const ONBOARDING_KEY = 'gratonite_onboarding_complete';

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface Slide {
  title: string;
  titleAccent: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  pills: { text: string; color: string; rotate: string }[];
}

const SLIDES: Slide[] = [
  {
    title: 'WELCOME TO',
    titleAccent: 'GRATONITE.',
    subtitle: 'Your next-gen chat experience',
    icon: 'planet',
    color: '#6c63ff',
    pills: [
      { text: 'Free Forever', color: '#6c63ff', rotate: '-2deg' },
      { text: 'Open Source', color: '#f59e0b', rotate: '1.5deg' },
    ],
  },
  {
    title: 'STAY',
    titleAccent: 'CONNECTED.',
    subtitle: 'Chat with friends and communities in real-time',
    icon: 'chatbubbles',
    color: '#ef4444',
    pills: [
      { text: 'Real-Time', color: '#ef4444', rotate: '-1deg' },
      { text: 'Voice Chat', color: '#22c55e', rotate: '2deg' },
    ],
  },
  {
    title: 'EXPRESS',
    titleAccent: 'YOURSELF.',
    subtitle: 'React with emojis, stickers, and custom statuses',
    icon: 'happy',
    color: '#22c55e',
    pills: [
      { text: 'Stickers', color: '#8b5cf6', rotate: '1deg' },
      { text: 'Reactions', color: '#3b82f6', rotate: '-1.5deg' },
      { text: 'Themes', color: '#f59e0b', rotate: '2deg' },
    ],
  },
  {
    title: "LET'S",
    titleAccent: 'GO.',
    subtitle: 'Create an account or log in to begin',
    icon: 'rocket',
    color: '#f59e0b',
    pills: [
      { text: 'No Ads', color: '#6c63ff', rotate: '-2deg' },
      { text: 'Your Rules', color: '#ef4444', rotate: '1.5deg' },
    ],
  },
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
      backgroundColor: '#0d0d1a',
    },
    skipBtn: {
      position: 'absolute',
      top: 60,
      right: spacing.lg,
      zIndex: 10,
      padding: spacing.sm,
    },
    skipText: {
      color: '#6a6a8e',
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
      width: 110,
      height: 110,
      borderRadius: 55,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    title: {
      fontSize: 30,
      fontWeight: '900',
      color: '#fff',
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      lineHeight: 36,
    },
    titleAccent: {
      color: '#6c63ff',
    },
    subtitle: {
      fontSize: fontSize.md,
      color: '#9898b8',
      textAlign: 'center',
      marginTop: spacing.sm,
      lineHeight: 22,
    },
    pillRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    pill: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 9999,
      borderWidth: 1.5,
    },
    pillText: {
      fontSize: fontSize.xs,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
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
      backgroundColor: '#2a2a4e',
    },
    dotActive: {
      backgroundColor: '#6c63ff',
      width: 24,
    },
    stripWrap: {
      width: 120,
      marginBottom: spacing.sm,
    },
    nextBtn: {
      backgroundColor: '#6c63ff',
      paddingHorizontal: spacing.xxxl * 2,
      paddingVertical: spacing.lg,
      borderRadius: 14,
      shadowColor: '#6c63ff',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    nextText: {
      color: '#fff',
      fontSize: fontSize.md,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
  }), [spacing, fontSize]);

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={styles.slide}>
      <Animated.View entering={FadeInDown.duration(500)}>
        <View style={[styles.iconCircle, { backgroundColor: item.color + '18' }]}>
          <Ionicons name={item.icon} size={52} color={item.color} />
        </View>
      </Animated.View>

      <Text style={styles.title}>
        {item.title}{'\n'}
        <Text style={[styles.titleAccent, { color: item.color }]}>{item.titleAccent}</Text>
      </Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>

      <View style={styles.pillRow}>
        {item.pills.map((p) => (
          <View
            key={p.text}
            style={[
              styles.pill,
              { borderColor: p.color, transform: [{ rotate: p.rotate }] },
            ]}
          >
            <Text style={[styles.pillText, { color: p.color }]}>{p.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <PatternBackground>
      <StarField />

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
        <View style={styles.stripWrap}>
          <RainbowStrip />
        </View>
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
    </PatternBackground>
  );
}
