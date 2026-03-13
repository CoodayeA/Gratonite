import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../lib/theme';
import { API_BASE } from '../lib/api';
import LinkPreview from './LinkPreview';

interface CustomEmoji {
  name: string;
  imageHash: string;
}

interface RichTextProps {
  content: string | null | undefined;
  color?: string;
  customEmojis?: CustomEmoji[];
}

// Simple markdown-like renderer: **bold**, *italic*, `code`, > quote, [text](url), @mentions, :emoji:
export default function RichText({ content, color, customEmojis }: RichTextProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const resolvedColor = color ?? colors.textPrimary;
  const safeContent = content ?? '';
  const parts = parseContent(safeContent, customEmojis);

  // Extract URLs for link previews
  const urls = parts.filter(p => p.type === 'link' && p.url).map(p => p.url!);

  const styles = useMemo(() => StyleSheet.create({
    text: {
      fontSize: fontSize.md,
      lineHeight: 22,
    },
    bold: {
      fontWeight: '700',
    },
    italic: {
      fontStyle: 'italic',
    },
    code: {
      fontFamily: 'Courier',
      backgroundColor: colors.bgElevated,
      color: colors.textPrimary,
      paddingHorizontal: 4,
      borderRadius: 3,
      fontSize: fontSize.sm,
    },
    link: {
      color: colors.textLink,
      textDecorationLine: 'underline',
    },
    mention: {
      color: colors.accentPrimary,
      fontWeight: '600',
      backgroundColor: colors.accentLight,
      paddingHorizontal: 2,
      borderRadius: 3,
    },
    spoiler: {
      backgroundColor: colors.bgElevated,
      color: colors.bgElevated,
    },
    emoji: {
      width: 20,
      height: 20,
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <View>
      <Text style={[styles.text, { color: resolvedColor }]}>
        {parts.map((part, i) => {
          switch (part.type) {
            case 'bold':
              return <Text key={i} style={[styles.bold, { color: resolvedColor }]}>{part.text}</Text>;
            case 'italic':
              return <Text key={i} style={[styles.italic, { color: resolvedColor }]}>{part.text}</Text>;
            case 'code':
              return <Text key={i} style={styles.code}>{part.text}</Text>;
            case 'link':
              return (
                <Text key={i} style={styles.link} onPress={() => Linking.openURL(part.url!)}>
                  {part.text}
                </Text>
              );
            case 'mention':
              return <Text key={i} style={styles.mention}>{part.text}</Text>;
            case 'spoiler':
              return <Text key={i} style={styles.spoiler}>{part.text}</Text>;
            case 'emoji':
              return <Image key={i} source={{ uri: part.url }} style={styles.emoji} contentFit="contain" />;
            default:
              return <Text key={i}>{part.text}</Text>;
          }
        })}
      </Text>
      {urls.map((url, i) => (
        <LinkPreview key={url + i} url={url} />
      ))}
    </View>
  );
}

interface TextPart {
  type: 'text' | 'bold' | 'italic' | 'code' | 'link' | 'mention' | 'spoiler' | 'emoji';
  text: string;
  url?: string;
}

function parseContent(content: string, customEmojis?: CustomEmoji[]): TextPart[] {
  const parts: TextPart[] = [];
  // Combined regex for markdown patterns + custom emoji :name:
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\|\|(.+?)\|\||@(\w+)|\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s]+)|:([a-zA-Z0-9_]{2,}):)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: content.slice(lastIndex, match.index) });
    }

    if (match[2]) {
      parts.push({ type: 'bold', text: match[2] });
    } else if (match[3]) {
      parts.push({ type: 'italic', text: match[3] });
    } else if (match[4]) {
      parts.push({ type: 'code', text: match[4] });
    } else if (match[5]) {
      parts.push({ type: 'spoiler', text: match[5] });
    } else if (match[6]) {
      parts.push({ type: 'mention', text: `@${match[6]}` });
    } else if (match[7] && match[8]) {
      parts.push({ type: 'link', text: match[7], url: match[8] });
    } else if (match[9]) {
      parts.push({ type: 'link', text: match[9], url: match[9] });
    } else if (match[10]) {
      // Custom emoji :name:
      const emojiName = match[10];
      const found = customEmojis?.find(e => e.name.toLowerCase() === emojiName.toLowerCase());
      if (found) {
        const url = `${API_BASE}/files/${found.imageHash}`;
        parts.push({ type: 'emoji', text: `:${emojiName}:`, url });
      } else {
        // Not a known custom emoji — render as plain text
        parts.push({ type: 'text', text: match[0] });
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', text: content.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', text: content }];
}
