import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../lib/theme';
import { API_BASE } from '../lib/api';

interface OGData {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
}

const cache = new Map<string, OGData>();

interface LinkPreviewProps {
  url: string;
}

export default function LinkPreview({ url }: LinkPreviewProps) {
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const [data, setData] = useState<OGData | null>(cache.get(url) || null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (cache.has(url)) {
      setData(cache.get(url)!);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/unfurl?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error('unfurl failed');
        const og: OGData = await res.json();
        if (!cancelled) {
          cache.set(url, og);
          setData(og);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.md,
      borderLeftWidth: 3,
      borderLeftColor: colors.accentPrimary,
      marginTop: spacing.xs,
      overflow: 'hidden',
    },
    content: {
      padding: spacing.md,
    },
    siteName: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginBottom: spacing.xs,
    },
    title: {
      color: colors.textLink,
      fontSize: fontSize.sm,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    description: {
      color: colors.textSecondary,
      fontSize: fontSize.xs,
      lineHeight: 18,
    },
    thumbnail: {
      width: '100%',
      height: 150,
    },
  }), [colors, spacing, fontSize, borderRadius]);

  if (error || !data || !data.title) return null;

  return (
    <TouchableOpacity style={styles.card} onPress={() => Linking.openURL(url)} activeOpacity={0.8}>
      {data.image && (
        <Image source={{ uri: data.image }} style={styles.thumbnail} contentFit="cover" cachePolicy="memory-disk" />
      )}
      <View style={styles.content}>
        {data.siteName && <Text style={styles.siteName}>{data.siteName}</Text>}
        <Text style={styles.title} numberOfLines={2}>{data.title}</Text>
        {data.description && <Text style={styles.description} numberOfLines={2}>{data.description}</Text>}
      </View>
    </TouchableOpacity>
  );
}
