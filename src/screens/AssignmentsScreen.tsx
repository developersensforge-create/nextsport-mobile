import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../hooks/useAuth';
import { getAssignments, updateAssignmentStatus, Assignment } from '../lib/api';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type AssignmentsNavProp = StackNavigationProp<RootStackParamList, 'Assignments'>;

export default function AssignmentsScreen() {
  const navigation = useNavigation<AssignmentsNavProp>();
  const { session } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getAssignments('all');
      setAssignments(data);
    } catch {
      // silently fail — show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function load() {
        setLoading(true);
        try {
          const data = await getAssignments('all');
          if (!cancelled) setAssignments(data);
        } catch {
          // silently fail
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      load();
      return () => { cancelled = true; };
    }, [])
  );

  async function handleMark(id: string, status: 'completed' | 'skipped') {
    try {
      await updateAssignmentStatus(id, status);
      // Optimistic update
      setAssignments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    } catch {
      Alert.alert('Error', 'Failed to update task. Please try again.');
    }
  }

  function renderItem({ item }: { item: Assignment }) {
    const isDone = item.status === 'completed';
    const isSkipped = item.status === 'skipped';
    const isPending = item.status === 'pending';

    return (
      <View style={[styles.card, !isPending && styles.cardDim]}>
        {/* Source + status row */}
        <View style={styles.cardHeader}>
          <Text style={styles.sourceLabel}>
            {item.source === 'ai' ? '🤖 AI Coach' : `👨‍🏫 ${item.coach_name ?? 'Coach'}`}
          </Text>
          {isDone && (
            <View style={styles.statusBadge}>
              <Ionicons name="checkmark-circle" size={13} color={COLORS.accent} />
              <Text style={[styles.statusText, { color: COLORS.accent }]}>Done</Text>
            </View>
          )}
          {isSkipped && (
            <Text style={[styles.statusText, { color: COLORS.muted }]}>Skipped</Text>
          )}
        </View>

        {/* Title */}
        <Text style={[styles.cardTitle, !isPending && styles.cardTitleDim]}>
          {item.title}
        </Text>

        {/* Description */}
        {item.description ? (
          <Text style={styles.cardDesc}>{item.description}</Text>
        ) : null}

        {/* Meta: reps / sets / due date */}
        <View style={styles.metaRow}>
          {item.reps != null && (
            <View style={styles.metaChip}>
              <Ionicons name="repeat" size={12} color={COLORS.muted} />
              <Text style={styles.metaText}>
                {item.reps} reps × {item.sets ?? 3} sets
              </Text>
            </View>
          )}
          {item.due_date ? (
            <View style={styles.metaChip}>
              <Ionicons name="calendar-outline" size={12} color={COLORS.muted} />
              <Text style={styles.metaText}>
                Due {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Actions — only for pending tasks */}
        {isPending && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.btnComplete}
              onPress={() => handleMark(item.id, 'completed')}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#000" />
              <Text style={styles.btnCompleteText}>Mark Complete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnSkip}
              onPress={() => handleMark(item.id, 'skipped')}
              activeOpacity={0.8}
            >
              <Text style={styles.btnSkipText}>Skip</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>My Training Tasks</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const pending = assignments.filter((a) => a.status === 'pending');
  const done = assignments.filter((a) => a.status !== 'pending');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>My Training Tasks</Text>
        {pending.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{pending.length}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={assignments}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          assignments.length === 0 && styles.emptyContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(true); }}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        ListHeaderComponent={
          assignments.length > 0 ? (
            <View style={styles.statsRow}>
              <Text style={styles.statsText}>
                {pending.length} pending · {done.length} completed
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No tasks yet</Text>
            <Text style={styles.emptyHint}>
              Complete a swing analysis to get your first AI Coach assignment.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  backBtn: {
    padding: 2,
    marginRight: 4,
  },
  topBarTitle: { color: COLORS.text, fontSize: 20, fontWeight: '800', flex: 1 },
  countBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: { color: '#000', fontSize: 12, fontWeight: '800' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  emptyContent: { flex: 1 },
  statsRow: { paddingVertical: 12 },
  statsText: { color: COLORS.muted, fontSize: 13 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardDim: { opacity: 0.55 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sourceLabel: { color: COLORS.muted, fontSize: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  cardTitleDim: { textDecorationLine: 'line-through', color: COLORS.muted },
  cardDesc: { color: '#9ca3af', fontSize: 14, lineHeight: 20, marginBottom: 10 },
  metaRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 12 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: COLORS.muted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  btnComplete: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnCompleteText: { color: '#000', fontWeight: '700', fontSize: 14 },
  btnSkip: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSkipText: { color: COLORS.muted, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 44, marginBottom: 14 },
  emptyTitle: { color: COLORS.text, fontSize: 19, fontWeight: '700', marginBottom: 8 },
  emptyHint: { color: COLORS.muted, fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
