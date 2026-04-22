import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { Ionicons } from '@expo/vector-icons';
import { Analysis } from '../lib/api';
import { COLORS } from '../theme';

interface AnalysisCardProps {
  analysis: Analysis;
  onPress: () => void;
  onDelete?: (id: string) => void;
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

export default function AnalysisCard({ analysis, onPress, onDelete }: AnalysisCardProps) {
  const scoreColor = getScoreColor(analysis.score);
  const swipeableRef = useRef<Swipeable>(null);

  const handleDelete = () => {
    swipeableRef.current?.close();
    Alert.alert(
      'Delete Analysis',
      'Are you sure you want to delete this analysis? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete?.(analysis.id),
        },
      ]
    );
  };

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.7],
      extrapolate: 'clamp',
    });
    return (
      <TouchableOpacity style={styles.deleteAction} onPress={handleDelete} activeOpacity={0.85}>
        <Animated.View style={{ transform: [{ scale }], alignItems: 'center' }}>
          <Ionicons name="trash-outline" size={22} color="#fff" />
          <Text style={styles.deleteActionText}>Delete</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const card = (
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
        {analysis.feedback ? (
          <Text style={styles.preview} numberOfLines={2}>
            {analysis.feedback.slice(0, 80)}…
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        {onDelete ? (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={handleDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
        )}
      </View>
    </TouchableOpacity>
  );

  // Always wrap in Swipeable — swipe-to-delete works regardless of edit mode
  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      friction={2}
    >
      {card}
    </Swipeable>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    padding: 4,
  },
  deleteAction: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: 10,
    borderRadius: 14,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
