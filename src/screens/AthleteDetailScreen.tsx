import React, { useState, useCallback } from 'react';
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
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { getAthleteAnalyses, getAssignments, Analysis, Assignment } from '../lib/api';
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

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    completed: '#22c55e',
    processing: '#f59e0b',
    pending: '#9ca3af',
    failed: '#ef4444',
  };
  const color = colorMap[status] ?? COLORS.muted;
  return (
    <View style={[badgeStyles.badge, { borderColor: color + '44', backgroundColor: color + '18' }]}>
      <Text style={[badgeStyles.text, { color }]}>{status}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default function AthleteDetailScreen() {
  const navigation = useNavigation<AthleteDetailNavProp>();
  const route = useRoute<AthleteDetailRouteProp>();
  const { playerId, playerName } = route.params;

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [analysesData, assignmentsData] = await Promise.all([
        getAthleteAnalyses(playerId),
        getAssignments('all', playerId),
      ]);
      setAnalyses(analysesData);
      setAssignments(assignmentsData);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [playerId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function load() {
        setLoading(true);
        try {
          const [analysesData, assignmentsData] = await Promise.all([
            getAthleteAnalyses(playerId),
            getAssignments('all', playerId),
          ]);
          if (!cancelled) {
            setAnalyses(analysesData);
            setAssignments(assignmentsData);
          }
        } catch {
          // silently fail
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      load();
      return () => { cancelled = true; };
    }, [playerId])
  );

  function handleAnalysisPress(analysisId: string) {
    navigation.navigate('AnalysisResult', { analysisId });
  }

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{playerName}</Text>
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
        {/* Analyses Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Analysis History</Text>
            <Text style={styles.sectionCount}>{analyses.length}</Text>
          </View>

          {analyses.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No analysis records yet</Text>
            </View>
          ) : (
            analyses.map((analysis) => {
              const avgScore = calcAvgScore(analysis.scores);
              return (
                <TouchableOpacity
                  key={analysis.id}
                  style={styles.analysisRow}
                  onPress={() => handleAnalysisPress(analysis.id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.analysisInfo}>
                    <Text style={styles.analysisDate}>{formatDate(analysis.created_at)}</Text>
                    {avgScore !== null && (
                      <Text style={styles.analysisScore}>Score {avgScore}</Text>
                    )}
                  </View>
                  <StatusBadge status={analysis.status} />
                  <Ionicons name="chevron-forward" size={16} color={COLORS.muted} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Assignments Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Assignments</Text>
            <Text style={styles.sectionCount}>{assignments.length}</Text>
          </View>

          {assignments.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptyText}>No assignments yet</Text>
            </View>
          ) : (
            assignments.map((assignment) => (
              <View key={assignment.id} style={styles.assignmentRow}>
                <View style={styles.assignmentLeft}>
                  <Text style={styles.assignmentSource}>
                    {assignment.source === 'ai' ? '🤖 AI Coach' : '👨‍🏫 Coach'}
                  </Text>
                  <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                  {assignment.reps != null && (
                    <Text style={styles.assignmentMeta}>
                      {assignment.reps} × {assignment.sets ?? 3}
                    </Text>
                  )}
                </View>
                <StatusBadge status={assignment.status} />
              </View>
            ))
          )}

          {/* Assign new drill button */}
          <TouchableOpacity
            style={styles.assignBtn}
            onPress={() => setAssignModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={18} color="#000" style={{ marginRight: 6 }} />
            <Text style={styles.assignBtnText}>Assign New Drill</Text>
          </TouchableOpacity>
        </View>
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
  backBtn: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 16,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  sectionCount: {
    color: COLORS.muted,
    fontSize: 13,
  },
  analysisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  analysisInfo: {
    flex: 1,
  },
  analysisDate: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  analysisScore: {
    color: COLORS.muted,
    fontSize: 12,
  },
  assignmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  assignmentLeft: {
    flex: 1,
  },
  assignmentSource: {
    color: COLORS.muted,
    fontSize: 11,
    marginBottom: 3,
  },
  assignmentTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  assignmentMeta: {
    color: COLORS.muted,
    fontSize: 12,
  },
  assignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 12,
  },
  assignBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  emptySection: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 14,
  },
});
