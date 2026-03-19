import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Modal, useWindowDimensions } from 'react-native';
import SearchBar from './SearchBar';
import { useTheme } from '../lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lightImpact } from '../lib/haptics';

const EMOJI_CATEGORIES: Record<string, string[]> = {
  'Smileys': ['\u{1F600}','\u{1F603}','\u{1F604}','\u{1F601}','\u{1F606}','\u{1F605}','\u{1F602}','\u{1F923}','\u{1F60A}','\u{1F607}','\u{1F642}','\u{1F643}','\u{1F609}','\u{1F60C}','\u{1F60D}','\u{1F970}','\u{1F618}','\u{1F617}','\u{1F619}','\u{1F61A}','\u{1F60B}','\u{1F61B}','\u{1F61C}','\u{1F92A}','\u{1F61D}','\u{1F911}','\u{1F917}','\u{1F92D}','\u{1F92B}','\u{1F914}','\u{1F910}','\u{1F928}','\u{1F610}','\u{1F611}','\u{1F636}','\u{1F60F}','\u{1F612}','\u{1F644}','\u{1F62C}','\u{1F925}','\u{1F60E}','\u{1F913}','\u{1F929}','\u{1F973}','\u{1F60E}'],
  'Gestures': ['\u{1F44D}','\u{1F44E}','\u{1F44A}','\u270A','\u{1F91B}','\u{1F91C}','\u{1F44F}','\u{1F64C}','\u{1F450}','\u{1F932}','\u{1F91D}','\u{1F64F}','\u270D\uFE0F','\u{1F485}','\u{1F933}','\u{1F4AA}','\u{1F9B5}','\u{1F9B6}','\u{1F442}','\u{1F443}','\u{1F9E0}','\u{1F9B7}','\u{1F9B4}','\u{1F440}','\u{1F441}\uFE0F','\u{1F445}','\u{1F444}','\u{1F48B}','\u{1F476}','\u{1F9D2}','\u{1F466}','\u{1F467}'],
  'Hearts': ['\u2764\uFE0F','\u{1F9E1}','\u{1F49B}','\u{1F49A}','\u{1F499}','\u{1F49C}','\u{1F5A4}','\u{1F90D}','\u{1F90E}','\u{1F494}','\u2763\uFE0F','\u{1F495}','\u{1F49E}','\u{1F493}','\u{1F497}','\u{1F496}','\u{1F498}','\u{1F49D}','\u{1F49F}','\u2665\uFE0F','\u{1FA77}'],
  'Objects': ['\u{1F525}','\u2B50','\u{1F31F}','\u2728','\u{1F4A5}','\u{1F389}','\u{1F38A}','\u{1F388}','\u{1F381}','\u{1F3C6}','\u{1F3C5}','\u{1F947}','\u{1F948}','\u{1F949}','\u26BD','\u{1F3C0}','\u{1F3C8}','\u26BE','\u{1F3BE}','\u{1F3B5}','\u{1F3B6}','\u{1F3A4}','\u{1F3A7}','\u{1F3AC}','\u{1F4F7}','\u{1F4F1}','\u{1F4BB}','\u{1F4A1}','\u{1F4B0}','\u{1F48E}'],
  'Nature': ['\u{1F436}','\u{1F431}','\u{1F42D}','\u{1F439}','\u{1F430}','\u{1F98A}','\u{1F43B}','\u{1F43C}','\u{1F428}','\u{1F42F}','\u{1F981}','\u{1F42E}','\u{1F437}','\u{1F438}','\u{1F435}','\u{1F649}','\u{1F64A}','\u{1F648}','\u{1F412}','\u{1F414}','\u{1F427}','\u{1F426}','\u{1F40D}','\u{1F422}','\u{1F41D}','\u{1F33B}','\u{1F339}','\u{1F33A}','\u{1F337}','\u{1F332}','\u{1F334}'],
  'Food': ['\u{1F34E}','\u{1F34A}','\u{1F34B}','\u{1F34C}','\u{1F349}','\u{1F347}','\u{1F353}','\u{1F351}','\u{1F352}','\u{1F34D}','\u{1F96D}','\u{1F95D}','\u{1F345}','\u{1F346}','\u{1F33D}','\u{1F336}\uFE0F','\u{1F954}','\u{1F955}','\u{1F35E}','\u{1F355}','\u{1F354}','\u{1F37F}','\u{1F366}','\u{1F370}','\u{1F382}','\u2615','\u{1F37A}','\u{1F377}','\u{1F379}','\u{1F964}'],
};

const CATEGORY_NAMES = Object.keys(EMOJI_CATEGORIES);

interface EmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

export default function EmojiPicker({ visible, onClose, onSelect }: EmojiPickerProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const numColumns = Math.max(4, Math.floor(screenWidth / 48));
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(CATEGORY_NAMES[0]);

  const allEmojis = Object.values(EMOJI_CATEGORIES).flat();
  const displayEmojis = search
    ? allEmojis
    : EMOJI_CATEGORIES[activeCategory] || [];

  const styles = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
      backgroundColor: colors.bgSecondary,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '60%',
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: colors.textMuted,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    categoryBar: {
      paddingHorizontal: spacing.md,
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    categoryTab: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
    },
    categoryTabActive: {
      backgroundColor: colors.accentLight,
    },
    categoryText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
    categoryTextActive: {
      color: colors.accentPrimary,
    },
    grid: {
      paddingHorizontal: spacing.sm,
    },
    emojiBtn: {
      flex: 1,
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
      maxWidth: `${100 / numColumns}%` as any,
    },
    emojiText: {
      fontSize: 28,
    },
  }), [colors, spacing, fontSize, borderRadius, neo, numColumns]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} accessibilityLabel="Close emoji picker">
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />

          <SearchBar value={search} onChangeText={setSearch} placeholder="Search emojis..." />

          {!search && (
            <FlatList
              horizontal
              data={CATEGORY_NAMES}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryBar}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.categoryTab, activeCategory === item && styles.categoryTabActive]}
                  onPress={() => setActiveCategory(item)}
                >
                  <Text style={[styles.categoryText, activeCategory === item && styles.categoryTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}

          <FlatList
            key={`emoji-grid-${numColumns}`}
            data={displayEmojis}
            numColumns={numColumns}
            keyExtractor={(item, index) => `${item}-${index}`}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.emojiBtn}
                onPress={() => { lightImpact(); onSelect(item); onClose(); }}
                accessibilityRole="button"
                accessibilityLabel={item}
              >
                <Text style={styles.emojiText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
