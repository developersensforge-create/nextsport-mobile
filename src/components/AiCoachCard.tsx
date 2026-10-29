import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import type { Assignment } from '../lib/api';

interface AiCoachCardProps {
  assignments: Assignment[];
  loading: boolean;
  onViewAll: () => void;
  coachName?: string | null;
}

export default function AiCoachCard({ assignments, loading, onViewAll, coachName }: AiCoachCardProps) {
  const pending = assignments.filter((a) => a.status === 'pending');
  // If any assignment is from a human coach, show coach branding instead of AI
  const hasHuman = assignments.some((a) => a.source === 'human');
  // Show the most recent coach summary (stored on the first assignment of each analysis batch)
  const latestSummary = assignments.find((a) => a.ai_summary != null)?.ai_summary ?? null;

  const displayName = hasHuman ? (coachName || 'My Coach') : 'AI Coach';
  const displaySubtitle = hasHuman ? 'Training Tasks' : 'NextSport Intelligence';
  const displayIcon = hasHuman ? '👨‍🏫' : '🤖';

  const taskLabel = loading
    ? 'Loading tasks…'
    : pending.length > 0
    ? `${pending.length} task${pending.length !== 1 ? 's' : ''} this week`
    : 'No pending tasks';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onViewAll}
      activeOpacity={0.85}
    >
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarIcon}>{displayIcon}</Text>
          </View>
          <View>
            <Text style={styles.title}>{displayName}</Text>
            <Text style={styles.subtitle}>{displaySubtitle}</Text>
          </View>
        </View>
        {!hasHuman && (
          <View style={styles.aiBadge}>
            <Text style={styles.aiBadgeText}>AI</Text>
          </View>
        )}
      </View>

      {/* Coach summary or empty state */}
      <View style={styles.summaryBox}>
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.accent} />
        ) : latestSummary && !hasHuman ? (
          <Text style={styles.summaryText} numberOfLines={3}>
            "{latestSummary}"
          </Text>
        ) : hasHuman && pending.length > 0 ? (
          <Text style={styles.summaryText} numberOfLines={2}>
            {coachName || 'Your coach'} assigned {pending.length} task{pending.length !== 1 ? 's' : ''} for you.
          </Text>
        ) : hasHuman ? (
          <Text style={styles.emptyText}>
            No pending tasks from your coach right now.
          </Text>
        ) : (
          <Text style={styles.emptyText}>
            Complete a swing analysis to get your first personalized coaching feedback.
          </Text>
        )}
      </View>

      {/* Footer: task count + chevron */}
      <View style={styles.footer}>
        <View style={styles.taskRow}>
          <Ionicons name="clipboard-outline" size={15} color={COLORS.accent} />
          <Text style={styles.taskText}>{taskLabel}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingBottom: 10,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: { fontSize: 20 },
  title: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 1,
  },
  aiBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  aiBadgeText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  summaryBox: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  summaryText: {
    color: '#d1d5db',
    fontSize: 14,
    lineHeight: 21,
    fontStyle: 'italic',
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  taskText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
  },
});
