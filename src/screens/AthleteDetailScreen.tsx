import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { getAthleteAnalyses, getAssignments, Analysis, Assignment } from '../lib/api';
import { getAthleteSubmissions, type AthleteSubmission } from '../lib/feedbackApi';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';
import AssignDrillModal from '../components/AssignDrillModal';

type AthleteDetailRouteProp = RouteProp<RootStackParamList, 'AthleteDetail'>;
type AthleteDetailNavProp = StackNavigationProp<RootStackParamList>;

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function calcAvgScore(scores: Record<string, number> | null): number | null {
  if (!scores) return null;
  const vals = Object.values(scores);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((sum, v) => sum + v, 0) / vals.length);
}

function daysSince(dateStr: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

// ─── Progress bar component ───────────────────────────────────

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? done / total : 0;
  return (
    <View style={pbarStyles.track}>
      <View style={[pbarStyles.fill, { width: `${Math.round(pct * 100)}%` as any }]} />
      <Text style={pbarStyles.label}>{done}/{total} reviewed</Text>
    </View>
  );
}

const pbarStyles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1e293b',
    marginTop: 8,
    marginBottom: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.accent,
  },
  label: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 5,
    marginBottom: 4,
  },
});

// ─── Main screen ──────────────────────────────────────────────

export default function AthleteDetailScreen() {
  const navigation = useNavigation<AthleteDetailNavProp>();
  const route = useRoute<AthleteDetailRouteProp>();
  const { playerId, playerName } = route.params;

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AthleteSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);

  const PREVIEW_LIMIT = 5;

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [analysesData, assignmentsData, submissionsData] = await Promise.all([
        getAthleteAnalyses(playerId),
        getAssignments('all', playerId),
        getAthleteSubmissions(playerId).catch(() => ({
          submissions: [] as AthleteSubmission[],
          pending_review_count: 0,
        })),
      ]);
      setAnalyses(analysesData);
      setAssignments(assignmentsData);
      setSubmissions(submissionsData.submissions);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [playerId]);

  // Reload on focus (returns from CoachFeedback, etc.)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData(true);
    });
    return unsubscribe;
  }, [navigation, loadData]);

  // ─── Derived data ─────────────────────────────────────────

  const pendingReview = useMemo(
    () => submissions.filter((s) => !s.reviewed),
    [submissions],
  );

  // Per-assignment stats: total submissions, reviewed count
  const assignmentStats = useMemo(() => {
    return assignments.map((a) => {
      const subs = submissions.filter((s) => s.assignment_id === a.id);
      const reviewedCount = subs.filter((s) => s.reviewed).length;
      return { ...a, totalSubmissions: subs.length, reviewedCount };
    });
  }, [assignments, submissions]);

  // ─── Actions ──────────────────────────────────────────────

  function openSubmissionReview(sub: AthleteSubmission) {
    navigation.navigate('CoachFeedback', {
      playerId,
      playerName,
      source: 'submission',
      submissionId: sub.id,
      videoUrl: sub.video_url,
      durationSec: sub.duration_sec,
      title: sub.assignment_title,
    });
  }

  function openAnalysis(analysisId: string) {
    navigation.navigate('AnalysisResult', { analysisId });
  }

  function openAssignmentFeedback(assignment: Assignment) {
    navigation.navigate('FeedbackList', {
      assignmentId: assignment.id,
      assignmentTitle: assignment.title,
      coachView: true,
    });
  }

  // ─── Loading state ────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{playerName}</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render ───────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{playerName}</Text>
        {pendingReview.length > 0 && (
          <View style={styles.pendingBadge}>
            <Ionicons name="hourglass-outline" size={12} color="#04110a" />
            <Text style={styles.pendingBadgeText}>{pendingReview.length} to review</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(true); }}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
      >
        {/* ─── Section 1: To Review ─────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="alarm-outline" size={18} color="#f59e0b" style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>To Review</Text>
            <Text style={styles.sectionCount}>{pendingReview.length}</Text>
          </View>

          {pendingReview.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle-outline" size={28} color={COLORS.accent} />
              <Text style={styles.emptyText}>All caught up! No pending reviews.</Text>
            </View>
          ) : (
            pendingReview.map((sub) => {
              const days = daysSince(sub.created_at);
              return (
                <View key={sub.id} style={styles.reviewCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewCardTitle}>{sub.assignment_title}</Text>
                    <Text style={styles.reviewCardMeta}>
                      Attempt {sub.attempt_no}/3{' · '}
                      {days > 0 ? `waiting ${days}d` : 'just submitted'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.reviewBtn}
                    onPress={() => openSubmissionReview(sub)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="play-circle" size={15} color="#04110a" />
                    <Text style={styles.reviewBtnText}>Review</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>

        {/* ─── Section 2: Assignments ───────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="book-outline" size={18} color={COLORS.accent} style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>Assignments</Text>
            <Text style={styles.sectionCount}>{assignments.length}</Text>
          </View>

          {assignments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No assignments yet</Text>
            </View>
          ) : (
            <>
              {assignmentStats.slice(0, PREVIEW_LIMIT).map((a) => {
                const srcIcon = a.source === 'ai' ? '🤖' : '👨‍🏫';
                const srcLabel = a.source === 'ai' ? 'AI Coach' : 'Coach';
                const hasReviewed = a.reviewedCount > 0;
                const allDone = a.totalSubmissions > 0 && a.reviewedCount >= a.totalSubmissions;

                return (
                  <View key={a.id} style={styles.assignmentCard}>
                    {/* Top row: source + title + status */}
                    <View style={styles.assignmentTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.assignmentSource}>
                          {srcIcon}{' '}{srcLabel}
                        </Text>
                        <Text style={styles.assignmentTitle}>{a.title}</Text>
                        {a.reps != null && (
                          <Text style={styles.assignmentDrillMeta}>
                            {a.reps} × {a.sets ?? 3}
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

                    {/* Progress bar (only if there are submissions) */}
                    {a.totalSubmissions > 0 && (
                      <ProgressBar done={a.reviewedCount} total={a.totalSubmissions} />
                    )}

                    {/* Bottom actions */}
                    {hasReviewed && (
                      <TouchableOpacity
                        style={styles.viewFeedbackLink}
                        onPress={() => openAssignmentFeedback(a)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="chatbubble-ellipses" size={14} color={COLORS.accent} />
                        <Text style={styles.viewFeedbackText}>View Feedback</Text>
                        <Ionicons name="chevron-forward" size={14} color={COLORS.accent} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              {assignmentStats.length > PREVIEW_LIMIT && (
                <TouchableOpacity
                  style={styles.seeAllBtn}
                  onPress={() =>
                    navigation.navigate('AthleteAssignments', { playerId, playerName })
                  }
                  activeOpacity={0.7}
                >
                  <Text style={styles.seeAllText}>
                    View All ({assignmentStats.length})
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color={COLORS.accent} />
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Assign new drill */}
          <TouchableOpacity
            style={styles.assignBtn}
            onPress={() => setAssignModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={18} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.assignBtnText}>Assign New Drill</Text>
          </TouchableOpacity>
        </View>

{/* ─── Section 3: Activity ──────────────────────────── */}
        {analyses.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="time-outline" size={18} color="#64748b" style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Activity</Text>
              <Text style={styles.sectionCount}>{analyses.length}</Text>
            </View>

            {analyses.slice(0, PREVIEW_LIMIT).map((analysis) => {
              const avgScore = calcAvgScore(analysis.scores);
              return (
                <TouchableOpacity
                  key={analysis.id}
                  style={styles.activityRow}
                  onPress={() => openAnalysis(analysis.id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityDate}>{formatDate(analysis.created_at)}</Text>
                    <Text style={styles.activityType}>
                      {avgScore !== null ? `Swing · Score ${avgScore}` : 'Swing analysis'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
                </TouchableOpacity>
              );
            })}

            {analyses.length > PREVIEW_LIMIT && (
              <TouchableOpacity
                style={styles.seeAllBtn}
                onPress={() =>
                  navigation.navigate('AthleteActivity', { playerId, playerName })
                }
                activeOpacity={0.7}
              >
                <Text style={styles.seeAllText}>
                  View All ({analyses.length})
                </Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.accent} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Assign Drill Modal */}
      <AssignDrillModal
        visible={assignModalVisible}
        playerId={playerId}
        playerName={playerName}
        onClose={() => setAssignModalVisible(false)}
        onSuccess={() => loadData(true)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  pendingBadgeText: { color: '#04110a', fontSize: 11, fontWeight: '800' },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 4 },

  // Section
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 12,
  },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', flex: 1 },
  sectionCount: { color: COLORS.muted, fontSize: 13 },

  // ─── To Review ─────────────────────────────────────────

  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: { color: COLORS.muted, fontSize: 14 },
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 8,
  },
  reviewCardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600', marginBottom: 3 },
  reviewCardMeta: { color: COLORS.muted, fontSize: 12 },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.accent,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reviewBtnText: { color: '#04110a', fontSize: 13, fontWeight: '800' },

  // ─── Assignments ───────────────────────────────────────

  assignmentCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 8,
  },
  assignmentTop: { flexDirection: 'row', alignItems: 'flex-start' },
  assignmentSource: { color: COLORS.muted, fontSize: 11, marginBottom: 3 },
  assignmentTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  assignmentDrillMeta: { color: COLORS.muted, fontSize: 12 },
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

  // Assign CTA
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 4,
  },
  assignBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },

  // ─── Activity ──────────────────────────────────────────

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activityInfo: { flex: 1 },
  activityDate: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  activityType: { color: COLORS.muted, fontSize: 12 },

  // ─── See All ──────────────────────────────────────────

  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    marginTop: 4,
  },
  seeAllText: { color: COLORS.accent, fontSize: 14, fontWeight: '600' },
});