import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, fontSize } from '../../theme';

// ── Emoji data ───────────────────────────────────────────────
// Curated emoji set organised by category.
const EMOJI_CATEGORIES: { name: string; icon: keyof typeof Ionicons.glyphMap; emojis: string[] }[] = [
  {
    name: 'Smileys',
    icon: 'happy-outline',
    emojis: [
      '\u{1F600}', '\u{1F603}', '\u{1F604}', '\u{1F601}', '\u{1F606}', '\u{1F605}',
      '\u{1F602}', '\u{1F923}', '\u{1F60A}', '\u{1F607}', '\u{1F642}', '\u{1F643}',
      '\u{1F609}', '\u{1F60C}', '\u{1F60D}', '\u{1F970}', '\u{1F618}', '\u{1F617}',
      '\u{1F619}', '\u{1F61A}', '\u{1F60B}', '\u{1F61B}', '\u{1F61C}', '\u{1F92A}',
      '\u{1F61D}', '\u{1F911}', '\u{1F917}', '\u{1F92D}', '\u{1F92B}', '\u{1F914}',
      '\u{1F910}', '\u{1F928}', '\u{1F610}', '\u{1F611}', '\u{1F636}', '\u{1F60F}',
      '\u{1F612}', '\u{1F644}', '\u{1F62C}', '\u{1F925}', '\u{1F60E}', '\u{1F913}',
      '\u{1F9D0}', '\u{1F615}', '\u{1F61F}', '\u{1F641}', '\u{2639}\uFE0F', '\u{1F62E}',
    ],
  },
  {
    name: 'Gestures',
    icon: 'hand-left-outline',
    emojis: [
      '\u{1F44D}', '\u{1F44E}', '\u{1F44A}', '\u{270A}', '\u{1F91B}', '\u{1F91C}',
      '\u{1F44F}', '\u{1F64C}', '\u{1F450}', '\u{1F91D}', '\u{1F64F}', '\u{270D}\uFE0F',
      '\u{1F485}', '\u{1F933}', '\u{1F4AA}', '\u{1F9B5}', '\u{1F9B6}', '\u{1F442}',
      '\u{1F443}', '\u{1F9E0}', '\u{1F9B7}', '\u{1F9B4}', '\u{1F440}', '\u{1F441}\uFE0F',
    ],
  },
  {
    name: 'Hearts',
    icon: 'heart-outline',
    emojis: [
      '\u{2764}\uFE0F', '\u{1F9E1}', '\u{1F49B}', '\u{1F49A}', '\u{1F499}', '\u{1F49C}',
      '\u{1F5A4}', '\u{1F90D}', '\u{1F90E}', '\u{1F494}', '\u{2763}\uFE0F', '\u{1F495}',
      '\u{1F49E}', '\u{1F493}', '\u{1F497}', '\u{1F496}', '\u{1F498}', '\u{1F49D}',
    ],
  },
  {
    name: 'Objects',
    icon: 'bulb-outline',
    emojis: [
      '\u{1F525}', '\u{2B50}', '\u{1F31F}', '\u{1F4A5}', '\u{1F4AB}', '\u{26A1}',
      '\u{1F389}', '\u{1F38A}', '\u{1F388}', '\u{1F381}', '\u{1F3C6}', '\u{1F3C5}',
      '\u{1F947}', '\u{1F948}', '\u{1F949}', '\u{26BD}', '\u{1F3AE}', '\u{1F3B5}',
      '\u{1F3B6}', '\u{1F3A4}', '\u{1F4F7}', '\u{1F4BB}', '\u{1F4F1}', '\u{1F4A1}',
    ],
  },
  {
    name: 'Food',
    icon: 'fast-food-outline',
    emojis: [
      '\u{1F34E}', '\u{1F34A}', '\u{1F34B}', '\u{1F34C}', '\u{1F349}', '\u{1F347}',
      '\u{1F353}', '\u{1F348}', '\u{1F352}', '\u{1F351}', '\u{1F34D}', '\u{1F95D}',
      '\u{1F96D}', '\u{1F345}', '\u{1F955}', '\u{1F33D}', '\u{1F336}\uFE0F', '\u{1F952}',
      '\u{1F35F}', '\u{1F355}', '\u{1F354}', '\u{1F32D}', '\u{1F32E}', '\u{1F32F}',
    ],
  },
  {
    name: 'Nature',
    icon: 'leaf-outline',
    emojis: [
      '\u{1F436}', '\u{1F431}', '\u{1F42D}', '\u{1F439}', '\u{1F430}', '\u{1F98A}',
      '\u{1F43B}', '\u{1F43C}', '\u{1F428}', '\u{1F42F}', '\u{1F981}', '\u{1F42E}',
      '\u{1F437}', '\u{1F438}', '\u{1F435}', '\u{1F649}', '\u{1F64A}', '\u{1F412}',
      '\u{1F333}', '\u{1F334}', '\u{1F335}', '\u{1F33B}', '\u{1F33A}', '\u{1F337}',
    ],
  },
];

interface EmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}

export function EmojiPicker({ visible, onClose, onSelect }: EmojiPickerProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(0);

  // Filter emojis by search (searches category names only since we don't have emoji names)
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return EMOJI_CATEGORIES;
    const q = search.toLowerCase();
    return EMOJI_CATEGORIES.filter((cat) => cat.name.toLowerCase().includes(q));
  }, [search]);

  const handleSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji);
      onClose();
      setSearch('');
    },
    [onSelect, onClose],
  );

  const renderEmoji = useCallback(
    ({ item }: { item: string }) => (
      <TouchableOpacity
        style={styles.emojiCell}
        onPress={() => handleSelect(item)}
        activeOpacity={0.6}
      >
        <Text style={styles.emojiText}>{item}</Text>
      </TouchableOpacity>
    ),
    [handleSelect],
  );

  const currentCategory = filteredCategories[activeCategory] ?? filteredCategories[0];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayDismiss} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={18} color={colors.text.muted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search emoji categories..."
              placeholderTextColor={colors.text.muted}
              autoCorrect={false}
              returnKeyType="search"
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={colors.text.muted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Category tabs */}
          <FlatList
            horizontal
            data={filteredCategories}
            keyExtractor={(item) => item.name}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  styles.categoryTab,
                  activeCategory === index && styles.categoryTabActive,
                ]}
                onPress={() => setActiveCategory(index)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={activeCategory === index ? colors.brand.primary : colors.text.muted}
                />
              </TouchableOpacity>
            )}
            showsHorizontalScrollIndicator={false}
            style={styles.categoryBar}
            contentContainerStyle={styles.categoryBarContent}
          />

          {/* Category label */}
          {currentCategory && (
            <Text style={styles.categoryLabel}>{currentCategory.name}</Text>
          )}

          {/* Emoji grid */}
          {currentCategory ? (
            <FlatList
              data={currentCategory.emojis}
              keyExtractor={(item, index) => `${currentCategory.name}-${index}`}
              renderItem={renderEmoji}
              numColumns={8}
              contentContainerStyle={styles.emojiGrid}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptySearch}>
              <Text style={styles.emptySearchText}>No categories match your search</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayDismiss: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
  },
  sheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '60%',
    paddingBottom: spacing['4xl'],
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.stroke.primary,
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25243a',
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.stroke.primary,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text.primary,
    paddingVertical: spacing.md,
  },

  // Category tabs
  categoryBar: {
    maxHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.stroke.secondary,
  },
  categoryBarContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  categoryTab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTabActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },

  // Category label
  categoryLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },

  // Emoji grid
  emojiGrid: {
    paddingHorizontal: spacing.sm,
  },
  emojiCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '12.5%',
  },
  emojiText: {
    fontSize: 28,
  },

  // Empty
  emptySearch: {
    paddingVertical: spacing['4xl'],
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: fontSize.md,
    color: colors.text.muted,
  },
});
