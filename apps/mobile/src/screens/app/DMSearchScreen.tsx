import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { users as usersApi, relationships as relApi } from '../../lib/api';
import { useToast } from '../../contexts/ToastContext';
import { useTheme } from '../../lib/theme';
import Avatar from '../../components/Avatar';
import SearchBar from '../../components/SearchBar';
import EmptyState from '../../components/EmptyState';
import type { User } from '../../types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';
import PatternBackground from '../../components/PatternBackground';

type Props = NativeStackScreenProps<AppStackParamList, 'DMSearch'>;

export default function DMSearchScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [openingDM, setOpeningDM] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setSearching(true);
    try {
      const users = await usersApi.search(text.trim());
      setResults(users);
      setHasSearched(true);
    } catch (err: any) {
      if (err.status !== 401) {
        toast.error('Search failed');
      }
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (text.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceTimer.current = setTimeout(() => {
      performSearch(text);
    }, 250);
  }, [performSearch]);

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);

  const handleOpenDM = async (userId: string, username: string) => {
    setOpeningDM(userId);
    try {
      const dm = await relApi.openDM(userId);
      navigation.replace('DirectMessage', {
        channelId: dm.id,
        recipientName: username,
        recipientId: userId,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to open DM');
    } finally {
      setOpeningDM(null);
    }
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgPrimary,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      ...(neo ? { borderBottomWidth: neo.borderWidth, borderBottomColor: colors.border } : {}),
    },
    headerTitle: {
      fontSize: fontSize.xl,
      fontWeight: neo ? '800' : '700',
      color: colors.textPrimary,
      ...(neo ? { textTransform: 'uppercase' as const } : {}),
    },
    searchingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    searchingText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
    list: {
      paddingBottom: spacing.xxxl,
    },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    resultInfo: {
      flex: 1,
    },
    resultName: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
    },
    resultUsername: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <PatternBackground>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Find a User</Text>
      </View>

      <SearchBar
        value={query}
        onChangeText={handleSearch}
        placeholder="Search by username..."
        autoFocus
      />

      {searching && (
        <View style={styles.searchingRow}>
          <ActivityIndicator size="small" color={colors.accentPrimary} />
          <Text style={styles.searchingText}>Searching...</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const name = item.displayName || item.username;
          const isOpening = openingDM === item.id;
          return (
            <TouchableOpacity
              style={styles.resultRow}
              onPress={() => handleOpenDM(item.id, item.username)}
              disabled={isOpening}
              activeOpacity={0.7}
            >
              <Avatar
                userId={item.id}
                avatarHash={item.avatarHash}
                name={name}
                size={44}
                showStatus
              />
              <View style={styles.resultInfo}>
                <Text style={styles.resultName}>{name}</Text>
                {item.displayName && (
                  <Text style={styles.resultUsername}>@{item.username}</Text>
                )}
              </View>
              {isOpening ? (
                <ActivityIndicator size="small" color={colors.accentPrimary} />
              ) : (
                <Ionicons name="chatbubble-outline" size={20} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          hasSearched && !searching ? (
            <EmptyState
              icon="search-outline"
              title="No users found"
              subtitle="Try a different search term"
            />
          ) : !hasSearched && !searching ? (
            <EmptyState
              icon="search-outline"
              title="Search for users"
              subtitle="Type at least 2 characters to search"
            />
          ) : null
        }
      />
    </PatternBackground>
  );
}
