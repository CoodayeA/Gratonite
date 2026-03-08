import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { mediumImpact } from '../lib/haptics';
import type { Poll } from '../types';

interface PollCardProps {
  poll: Poll;
  onVote: (pollId: string, optionId: string) => void;
  onRemoveVote: (pollId: string) => void;
}

export default function PollCard({ poll, onVote, onRemoveVote }: PollCardProps) {
  const { colors, spacing, fontSize, borderRadius, neo } = useTheme();
  const hasVoted = poll.myVotes.length > 0;
  const isExpired = poll.expiresAt ? new Date(poll.expiresAt) < new Date() : false;
  const showResults = hasVoted || isExpired;

  const getPercentage = (voteCount: number): number => {
    if (poll.totalVoters === 0) return 0;
    return Math.round((voteCount / poll.totalVoters) * 100);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: colors.bgElevated,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    question: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontWeight: '600',
      flex: 1,
      lineHeight: 22,
    },
    multiLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      marginBottom: spacing.md,
    },
    optionsList: {
      gap: spacing.sm,
    },
    optionItem: {
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.borderLight,
      overflow: 'hidden',
      position: 'relative',
      minHeight: 44,
      justifyContent: 'center',
    },
    optionSelected: {
      borderColor: colors.accentPrimary,
    },
    optionDisabled: {
      opacity: 0.8,
    },
    progressBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      backgroundColor: colors.accentLight,
      borderRadius: borderRadius.md,
    },
    progressBarSelected: {
      backgroundColor: 'rgba(108, 99, 255, 0.25)',
    },
    optionContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.sm,
      zIndex: 1,
    },
    optionText: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      flex: 1,
    },
    optionTextSelected: {
      fontWeight: '600',
    },
    optionPct: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontWeight: '600',
      minWidth: 36,
      textAlign: 'right',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    footerText: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
    },
    expiredLabel: {
      color: colors.textMuted,
      fontSize: fontSize.xs,
      fontStyle: 'italic',
    },
    removeVote: {
      color: colors.accentPrimary,
      fontSize: fontSize.xs,
      fontWeight: '600',
    },
  }), [colors, spacing, fontSize, borderRadius, neo]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="stats-chart" size={16} color={colors.accentPrimary} />
        <Text style={styles.question}>{poll.question}</Text>
      </View>

      {poll.multipleChoice && (
        <Text style={styles.multiLabel}>Multiple choices allowed</Text>
      )}

      {/* Options */}
      <View style={styles.optionsList}>
        {poll.options.map((option) => {
          const isSelected = poll.myVotes.includes(option.id);
          const pct = getPercentage(option.voteCount);

          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionItem,
                isSelected && styles.optionSelected,
                isExpired && styles.optionDisabled,
              ]}
              onPress={() => {
                if (isExpired) return;
                mediumImpact();
                if (isSelected && !poll.multipleChoice) {
                  onRemoveVote(poll.id);
                } else {
                  onVote(poll.id, option.id);
                }
              }}
              disabled={isExpired}
              activeOpacity={0.7}
            >
              {/* Progress bar background */}
              {showResults && (
                <View
                  style={[
                    styles.progressBar,
                    { width: `${pct}%` },
                    isSelected && styles.progressBarSelected,
                  ]}
                />
              )}

              <View style={styles.optionContent}>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={18} color={colors.accentPrimary} />
                )}
                <Text
                  style={[styles.optionText, isSelected && styles.optionTextSelected]}
                  numberOfLines={2}
                >
                  {option.text}
                </Text>
                {showResults && (
                  <Text style={styles.optionPct}>{pct}%</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {poll.totalVoters} {poll.totalVoters === 1 ? 'voter' : 'voters'}
        </Text>
        {isExpired && (
          <Text style={styles.expiredLabel}>Poll ended</Text>
        )}
        {hasVoted && !isExpired && (
          <TouchableOpacity onPress={() => onRemoveVote(poll.id)}>
            <Text style={styles.removeVote}>Remove vote</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
