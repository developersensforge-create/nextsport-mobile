import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Analysis } from '../lib/api';
import { COLORS } from '../theme';

interface AnalysisCardProps {
  analysis: Analysis;
  onPress: () => void;
}

function getScoreColor(score: number | null): string {
  if (score === null) return COLORS.muted;
  if (score >= 80) return COLORS.accent;
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusLabel(status: Analysis['status']): string {
  switch (status) {
    case 'completed': return 'Completed';
    case 'processing': return 'Processing…';
    case 'pending': return 'Queued';
    case 'failed': return 'Failed';
    default: return status;
  }
}

/** 从结构化字段生成可读的 coaching 预览文字，避免显示 JSON 原文 */
function getCoachingPreview(analysis: Analysis): string | null {
  // 优先用 improvements 第一条的 title（最重要的改进点）
  const improvements = analysis.improvements ?? [];
  if (improvements.length > 0) {
    const first = improvements[0];
    const titleKey = Object.keys(first).find((k) => k !== 'fix');
    if (titleKey) {
      const rest = improvements.length > 1 ? ` +${improvements.length - 1} more` : '';
      return `Focus: ${titleKey}${rest}`;
    }
  }
  // 次选：strengths 第一条
  const strengths = analysis.strengths ?? [];
  if (strengths.length > 0) {
    return `✓ ${strengths[0]}`;
  }
  return null;
}

export default function AnalysisCard({ analysis, onPress }: AnalysisCardProps) {
  const scoreColor = getScoreColor(analysis.score);
  const preview = getCoachingPreview(analysis);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.left}>
        <View style={[styles.scoreBadge, { borderColor: scoreColor }]}>
          {analysis.score !== null ? (
            <Text style={[styles.scoreText, { color: scoreColor }]}>{analysis.score}</Text>
          ) : (
            <Ionicons name="time-outline" size={18} color={COLORS.muted} />
          )}
        </View>
      </View>
      <View style={styles.middle}>
        <Text style={styles.dateText}>{formatDate(analysis.created_at)}</Text>
        <Text style={styles.statusText}>{getStatusLabel(analysis.status)}</Text>
        {preview ? (
          <Text style={styles.preview} numberOfLines={2}>
            {preview}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  left: {
    marginRight: 14,
  },
  scoreBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '800',
  },
  middle: {
    flex: 1,
  },
  dateText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  statusText: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 4,
  },
  preview: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  right: {
    marginLeft: 8,
  },
});
