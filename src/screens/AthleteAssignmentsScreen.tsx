import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { getAssignments, Assignment } from '../lib/api';
import { getAthleteSubmissions, type AthleteSubmission } from '../lib/feedbackApi';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';
import AssignDrillModal from '../components/AssignDrillModal';

type Nav = StackNavigationProp<RootStackParamList, 'AthleteAssignments'>;
type Rt = RouteProp<RootStackParamList, 'AthleteAssignments'>;

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? done / total : 0;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` as any }]} />
      <Text style={styles.progressLabel}>{done}/{total} reviewed</Text>
    </View>
  );
}

export default function AthleteAssignmentsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { playerId, playerName } = route.params;

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AthleteSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [assignmentsData, submissionsData] = await Promise.all([
        getAssignments('all', playerId),
        getAthleteSubmissions(playerId).catch(() => ({
          submissions: [] as AthleteSubmission[],
          pending_review_count: 0,
        })),
      ]);
      setAssignments(assignmentsData);
      setSubmissions(submissionsData.submissions);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [playerId]);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load]),
  );

  const getStats = (assignmentId: string) => {
    const subs = submissions.filter((s) => s.assignment_id === assignmentId);
    return {
      total: subs.length,
      reviewed: subs.filter((s) => s.reviewed).length,
    };
  };

  function openFeedback(assignment: Assignment) {
    navigation.navigate('FeedbackList', {
      assignmentId: assignment.id,
      assignmentTitle: assignment.title,
      coachView: true,
    });
  }

  function renderItem({ item }: { item: Assignment }) {
    const stats = getStats(item.id);
    const srcIcon = item.source === 'ai' ? '🤖' : '👨‍🏫';
    const srcLabel = item.source === 'ai' ? 'AI Coach' : 'Coach';
    const hasReviewed = stats.reviewed > 0;
    const allDone = stats.total > 0 && stats.reviewed >= stats.total;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.source}>
              {srcIcon} {srcLabel}
            </Text>
            <Text style={styles.title}>{item.title}</Text>
            {item.reps != null && (
              <Text style={styles.meta}>
                {item.reps} × {item.sets ?? 3}
              </Text>
            )}
          </View>
          {allDone && (
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark" size={12} color="#22c55e" />
              <Text style={styles.doneBadgeText}>Done</Text>
            </View>
          )}
        </View>

        {stats.total > 0 && <ProgressBar done={stats.reviewed} total={stats.total} />}

        {hasReviewed && (
          <TouchableOpacity
            style={styles.viewFeedbackLink}
            onPress={() => openFeedback(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-ellipses" size={14} color={COLORS.accent} />
            <Text style={styles.viewFeedbackText}>View Feedback</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.accent} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Assignments" subtitle={playerName} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Header
        title="Assignments"
        subtitle={`${playerName} · ${assignments.length} total`}
        onBack={() => navigation.goBack()}
      />

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
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={44} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>No assignments yet</Text>
            <Text style={styles.emptyHint}>Assign a drill to get started.</Text>
          </View>
        }
        ListFooterComponent={
          <TouchableOpacity
            style={styles.assignBtn}
            onPress={() => setAssignModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={18} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.assignBtnText}>Assign New Drill</Text>
          </TouchableOpacity>
        }
      />

      <AssignDrillModal
        visible={assignModalVisible}
        playerId={playerId}
        playerName={playerName}
        onClose={() => setAssignModalVisible(false)}
        onSuccess={() => load(true)}
      />
    </SafeAreaView>
  );
}

function Header({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={12}>
        <Ionicons name="chevron-back" size={24} color={COLORS.text} />
      </TouchableOpacity>
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  headerSub: { color: COLORS.muted, fontSize: 12, marginTop: 2 },

  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  emptyContent: { flex: 1 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  source: { color: COLORS.muted, fontSize: 11, marginBottom: 3 },
  title: { color: COLORS.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  meta: { color: COLORS.muted, fontSize: 12 },

  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1e293b',
    marginTop: 8,
    marginBottom: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  progressLabel: { color: COLORS.muted, fontSize: 11, marginTop: 5, marginBottom: 4 },

  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#22c55e18',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#22c55e44',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  doneBadgeText: { color: '#22c55e', fontSize: 11, fontWeight: '600' },

  viewFeedbackLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  viewFeedbackText: { color: COLORS.accent, fontSize: 13, fontWeight: '600', flex: 1 },

  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 8,
  },
  assignBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700', marginTop: 16 },
  emptyHint: { color: COLORS.muted, fontSize: 13, textAlign: 'center', marginTop: 8 },
});