import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useProfile } from '../hooks/useProfile';
import { useAuth } from '../hooks/useAuth';
import { useAthletes } from '../hooks/useAthletes';
import { getAnalyses, deleteAnalysis, Analysis } from '../lib/api';
import { logger } from '../lib/logger';
import AnalysisCard from '../components/AnalysisCard';
import TokenBadge from '../components/TokenBadge';
import AthleteModal from '../components/AthleteModal';
import { COLORS } from '../theme';
import { getTrainingFocus, needsWeeklyCheckin, pickTopDrills, TrainingFocus } from '../lib/trainingFocus';
import { DRILLS } from '../data/drills';
import type { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  StackNavigationProp<RootStackParamList>
>;

// Module-level cache — survives screen unmount/remount on Android stack navigation
let _cachedPool: Analysis[] = [];
let _cachedScopeKey: string | undefined = undefined;
let _hasFetched = false;

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const { user } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile();
  const {
    athletes,
    activeAthlete,
    activeAthleteId,
    loading: athletesLoading,
    setActiveAthlete,
    createAthlete,
  } = useAthletes();

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [analysesLoading, setAnalysesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trainingFocus, setTrainingFocus] = useState<TrainingFocus | null>(null);
  const hasCheckedFocus = useRef(false);
  const [addAthleteVisible, setAddAthleteVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const analysesFetchInFlight = useRef(false);

  function applyPoolToHome() {
    setAnalyses(_cachedPool.slice(0, 5));
  }

  function getScopeKey(athleteId?: string, usedFallback = false) {
    if (!athleteId) return 'all';
    return usedFallback ? `fallback:${athleteId}` : `athlete:${athleteId}`;
  }

  function cacheMatchesCurrentAthlete(athleteId?: string | null) {
    if (!athleteId) return _cachedScopeKey === 'all';
    return (
      _cachedScopeKey === `athlete:${athleteId}` ||
      _cachedScopeKey === `fallback:${athleteId}`
    );
  }

  async function loadAnalyses(forAthleteId?: string, force = false) {
    if (analysesFetchInFlight.current) return;
    const targetScopeKey = getScopeKey(forAthleteId);
    const athleteChanged = _cachedScopeKey !== targetScopeKey && _cachedScopeKey !== getScopeKey(forAthleteId, true);
    if (!force && _hasFetched && !athleteChanged) return;
    analysesFetchInFlight.current = true;
    try {
      let data = await getAnalyses(forAthleteId ?? undefined, 0, 50);
      let usedFallback = false;
      if (forAthleteId && data.length === 0) {
        const allData = await getAnalyses(undefined, 0, 50);
        if (allData.length > 0) {
          logger.warn('HomeScreen', 'loadAnalyses: athlete-scoped list empty, falling back to unfiltered analyses', {
            athleteId: forAthleteId,
            fallbackCount: allData.length,
          });
          data = allData;
          usedFallback = true;
        }
      }
      _cachedPool = data;
      _cachedScopeKey = getScopeKey(forAthleteId, usedFallback);
      _hasFetched = true;
      setAnalyses(data.slice(0, 5));
    } catch {
      // silently fail — keep existing pool
    } finally {
      setAnalysesLoading(false);
      analysesFetchInFlight.current = false;
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (athletesLoading) {
        setAnalysesLoading(true);
        return;
      }

      const currentAthleteKey = activeAthleteId ?? null;

      // Only restore cache when it matches the currently active athlete context.
      if (_hasFetched && cacheMatchesCurrentAthlete(currentAthleteKey)) {
        setAnalyses(_cachedPool.slice(0, 5));
        setAnalysesLoading(false);
      }
      loadAnalyses(activeAthleteId ?? undefined, true);
      refetchProfile();
    }, [refetchProfile, activeAthleteId, athletesLoading])
  );

  // Check training focus on first mount
  useEffect(() => {
    if (hasCheckedFocus.current || athletesLoading || !activeAthleteId) return;
    hasCheckedFocus.current = true;
    getTrainingFocus(activeAthleteId).then(focus => {
      setTrainingFocus(focus);
      if (needsWeeklyCheckin(focus)) {
        navigation.navigate('TrainingFocus');
      }
    });
  }, [athletesLoading, activeAthleteId]);

  // Reload training focus when returning from TrainingFocusScreen
  useFocusEffect(
    useCallback(() => {
      if (activeAthleteId) {
        getTrainingFocus(activeAthleteId).then(setTrainingFocus);
      }
    }, [activeAthleteId])
  );

  // Drill plan from training focus
  const drillPlan = trainingFocus ? pickTopDrills(trainingFocus) : null;
  const drillItems = drillPlan?.map(({ id, reason }) => {
    const drill = DRILLS.find(d => d.id === id);
    return drill ? { drill, reason } : null;
  }).filter(Boolean) ?? [];

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([loadAnalyses(activeAthleteId ?? undefined, true), refetchProfile()]);
    setRefreshing(false);
  }

  async function handleAthleteSwitch(id: string) {
    await setActiveAthlete(id);
    setAnalysesLoading(true);
    await loadAnalyses(id, true);
  }

  function handleRecord() {
    if (profile && profile.tokens_remaining <= 0) {
      navigation.navigate('Paywall');
      return;
    }
    navigation.navigate('Record', { athleteId: activeAthleteId ?? undefined });
  }

  function handleUpload() {
    if (profile && profile.tokens_remaining <= 0) {
      navigation.navigate('Paywall');
      return;
    }
    navigation.navigate('Record', { mode: 'upload', athleteId: activeAthleteId ?? undefined });
  }

  async function handleDeleteAnalysis(id: string) {
    // Optimistic: remove from pool and refill home from remaining
    _cachedPool = _cachedPool.filter(a => a.id !== id);
    applyPoolToHome();
    try {
      await deleteAnalysis(id);
    } catch (err) {
      // Server delete failed — force a fresh fetch to restore correct state
      await loadAnalyses(activeAthleteId ?? undefined, true);
      Alert.alert('Error', 'Failed to delete analysis. Please try again.');
    }
  }

  const firstName = profile?.full_name?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? 'Athlete';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hey, {firstName} 👋</Text>
            <Text style={styles.subtitle}>Ready to analyze your swing?</Text>
          </View>
          {profile && <TokenBadge tokens={profile.tokens_remaining} size="md" />}
        </View>

        {/* Athlete Switcher */}
        {athletes.length > 0 && (
          <View style={styles.athleteSwitcher}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.athleteScrollContent}
            >
              {athletes.map((athlete) => {
                const isActive = athlete.id === activeAthleteId;
                const initials = athlete.name
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                const avatarColor = athlete.avatar_color ?? COLORS.accent;
                return (
                  <TouchableOpacity
                    key={athlete.id}
                    style={[
                      styles.athleteChip,
                      isActive && styles.athleteChipActive,
                    ]}
                    onPress={() => handleAthleteSwitch(athlete.id)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.avatarCircle,
                        { backgroundColor: `${avatarColor}26` },
                        isActive && { borderColor: avatarColor, borderWidth: 2 },
                      ]}
                    >
                      <Text style={[styles.avatarInitial, { color: avatarColor }]}>
                        {initials}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.athleteChipName,
                        isActive && styles.athleteChipNameActive,
                      ]}
                      numberOfLines={1}
                    >
                      {athlete.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* Add athlete button */}
              <TouchableOpacity
                style={styles.addAthleteChip}
                onPress={() => setAddAthleteVisible(true)}
                activeOpacity={0.75}
              >
                <View style={styles.addAthleteCircle}>
                  <Ionicons name="add" size={20} color={COLORS.accent} />
                </View>
                <Text style={styles.addAthleteText}>Add</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Token info card */}
        {profile && (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="flash" size={22} color={COLORS.accent} />
                <Text style={styles.infoValue}>{profile.tokens_remaining}</Text>
                <Text style={styles.infoLabel}>Tokens Left</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <Ionicons
                  name={profile.subscription_status === 'premium' ? 'star' : 'person'}
                  size={22}
                  color={profile.subscription_status === 'premium' ? '#f59e0b' : COLORS.muted}
                />
                <Text style={styles.infoValue}>
                  {profile.subscription_status === 'premium' ? 'Premium' : 'Free'}
                </Text>
                <Text style={styles.infoLabel}>Plan</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoItem}>
                <Ionicons name="refresh" size={22} color={COLORS.muted} />
                <Text style={styles.infoValue}>Weekly</Text>
                <Text style={styles.infoLabel}>Reset</Text>
              </View>
            </View>
          </View>
        )}

        {/* Drill Plan Card */}
        {drillItems.length > 0 && (
          <View style={styles.drillPlanCard}>
            <View style={styles.drillPlanHeader}>
              <View>
                <Text style={styles.drillPlanTitle}>🎯 {activeAthlete ? `${activeAthlete.name.split(' ')[0]}'s` : 'Your'} Drill Plan</Text>
                <Text style={styles.drillPlanSub}>Based on weekly check-in</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('TrainingFocus')}>
                <Text style={styles.drillPlanUpdate}>✏️ Update</Text>
              </TouchableOpacity>
            </View>
            {drillItems.map((item, idx) => item && (
              <View key={item.drill.id} style={[styles.drillItem, idx === drillItems.length - 1 && { borderBottomWidth: 0, paddingBottom: 0 }]}>
                <View style={styles.drillNum}><Text style={styles.drillNumText}>{idx + 1}</Text></View>
                <View style={styles.drillInfo}>
                  <Text style={styles.drillName}>{item.drill.title}</Text>
                  <Text style={styles.drillWhy} numberOfLines={1}>{item.reason}</Text>
                </View>
                <View style={[styles.drillTag, { backgroundColor: idx === 0 ? 'rgba(249,115,22,0.15)' : idx === 1 ? 'rgba(59,130,246,0.15)' : 'rgba(139,92,246,0.15)' }]}>
                  <Text style={[styles.drillTagText, { color: idx === 0 ? '#fb923c' : idx === 1 ? '#60a5fa' : '#a78bfa' }]}>{item.drill.category.split(' ')[0]}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* No drill plan yet */}
        {drillItems.length === 0 && (
          <TouchableOpacity style={styles.drillPlanEmpty} onPress={() => navigation.navigate('TrainingFocus')} activeOpacity={0.8}>
            <Text style={styles.drillPlanEmptyIcon}>🎯</Text>
            <View style={styles.drillPlanEmptyText}>
              <Text style={styles.drillPlanEmptyTitle}>Set Up Your Drill Plan</Text>
              <Text style={styles.drillPlanEmptySub}>Tell us about your player → get 3 targeted drills</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.accent} />
          </TouchableOpacity>
        )}

        {/* Analyze Swing Card */}
        <View style={styles.analysisCard}>
          <View style={styles.analysisCardHeader}>
            <View style={styles.analysisIcon}><Text style={{ fontSize: 18 }}>📹</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.analysisTitle}>Analyze {activeAthlete ? `${activeAthlete.name.split(' ')[0]}'s` : 'Your'} Swing</Text>
              <Text style={styles.analysisSub}>AI coach · Video analysis</Text>
            </View>
          </View>
          <View style={styles.analysisButtons}>
            <TouchableOpacity style={styles.analysisBtnPrimary} onPress={handleRecord} activeOpacity={0.85}>
              <Ionicons name="videocam" size={16} color="#fff" />
              <Text style={styles.analysisBtnPrimaryText}>Record</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.analysisBtnSecondary} onPress={handleUpload} activeOpacity={0.85}>
              <Ionicons name="cloud-upload-outline" size={16} color={COLORS.text} />
              <Text style={styles.analysisBtnSecondaryText}>Upload</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Token upgrade nudge */}
        {profile && profile.tokens_remaining <= 10 && profile.subscription_status !== 'premium' && (
          <TouchableOpacity
            style={styles.nudgeCard}
            onPress={() => navigation.navigate('Paywall')}
            activeOpacity={0.85}
          >
            <Ionicons name="star" size={18} color="#f59e0b" />
            <Text style={styles.nudgeText}>
              Running low on tokens.{' '}
              <Text style={styles.nudgeLink}>Upgrade to Premium</Text> for unlimited analyses.
            </Text>
          </TouchableOpacity>
        )}

        {/* Recent Analyses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Recent Analyses
              {activeAthlete ? (
                <Text style={styles.sectionSubtitle}> · {activeAthlete.name}</Text>
              ) : null}
            </Text>
            <View style={styles.sectionActions}>
              {analyses.length > 0 && (
                <TouchableOpacity onPress={() => setEditMode(e => !e)} style={styles.sectionActionBtn}>
                  <Text style={styles.editToggle}>{editMode ? 'Done' : 'Edit'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => navigation.navigate('AnalysisHistory')} style={styles.sectionActionBtn}>
                <Text style={styles.viewAllToggle}>View All</Text>
              </TouchableOpacity>
            </View>
          </View>
          {analysesLoading ? (
            <Text style={styles.emptyText}>Loading…</Text>
          ) : analyses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="baseball-outline" size={40} color={COLORS.muted} />
              <Text style={styles.emptyTitle}>No analyses yet</Text>
              <Text style={styles.emptyText}>Record or upload a video to get started.</Text>
            </View>
          ) : (
            analyses.map((a) => (
              <AnalysisCard
                key={a.id}
                analysis={a}
                onPress={() => {
                  if (editMode) return;
                  logger.info('HomeScreen', 'navigate AnalysisResult from recent list', {
                    analysisId: a.id,
                    status: a.status,
                    hasResultVideo: !!a.result_video_url,
                  });
                  navigation.navigate('AnalysisResult', { analysisId: a.id });
                }}
                onDelete={handleDeleteAnalysis}
                showDeleteIcon={editMode}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Athlete Modal */}
      <AthleteModal
        visible={addAthleteVisible}
        onSave={async (data) => {
          try {
            const created = await createAthlete(data);
            setAddAthleteVisible(false);
            await handleAthleteSwitch(created.id);
          } catch {
            Alert.alert('Error', 'Failed to create athlete. Please try again.');
          }
        }}
        onCancel={() => setAddAthleteVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greeting: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 2,
  },
  // Athlete switcher
  athleteSwitcher: {
    marginBottom: 16,
  },
  athleteScrollContent: {
    paddingRight: 4,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  athleteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 24,
    paddingRight: 14,
    paddingLeft: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  athleteChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(34,197,94,0.06)',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 13,
    fontWeight: '800',
  },
  athleteChipName: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 90,
  },
  athleteChipNameActive: {
    color: COLORS.text,
  },
  addAthleteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 24,
    paddingRight: 14,
    paddingLeft: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    gap: 8,
  },
  addAthleteCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAthleteText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  // Info card
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
  },
  infoValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  infoLabel: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 2,
  },
  infoDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
  },
  // Drill Plan Card
  drillPlanCard: {
    backgroundColor: '#131a2e',
    borderRadius: 18, padding: 16, marginHorizontal: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
  },
  drillPlanHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  drillPlanTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  drillPlanSub: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  drillPlanUpdate: { fontSize: 12, color: '#60a5fa', fontWeight: '600' },
  drillItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  drillNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  drillNumText: { fontSize: 13, fontWeight: '800', color: '#f97316' },
  drillInfo: { flex: 1 },
  drillName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  drillWhy: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  drillTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  drillTagText: { fontSize: 10, fontWeight: '700' },
  drillPlanEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.card, borderRadius: 16, padding: 16,
    marginHorizontal: 16, marginBottom: 16, borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)', borderStyle: 'dashed' as const,
  },
  drillPlanEmptyIcon: { fontSize: 28 },
  drillPlanEmptyText: { flex: 1 },
  drillPlanEmptyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  drillPlanEmptySub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  // Analyze Swing Card
  analysisCard: {
    backgroundColor: COLORS.card, borderRadius: 16, padding: 16,
    marginHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  analysisCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  analysisIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center' },
  analysisTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  analysisSub: { fontSize: 12, color: COLORS.muted },
  analysisButtons: { flexDirection: 'row', gap: 10 },
  analysisBtnPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 13, borderRadius: 12, backgroundColor: COLORS.accent },
  analysisBtnPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  analysisBtnSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 13, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' },
  analysisBtnSecondaryText: { fontSize: 14, fontWeight: '700', color: COLORS.text },

  recordButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  recordButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    marginLeft: 12,
  },
  uploadButton: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    marginBottom: 20,
  },
  uploadButtonText: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  nudgeCard: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
    marginBottom: 24,
  },
  nudgeText: {
    color: COLORS.muted,
    fontSize: 13,
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
  nudgeLink: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  section: {
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '400',
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionActionBtn: {
    paddingVertical: 2,
  },
  editToggle: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  viewAllToggle: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
});
