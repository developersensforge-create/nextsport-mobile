import React, { useState, useCallback, useRef } from 'react';
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
import { deletedAnalysisIds as _deletedAnalysisIds, persistDeletedId } from '../lib/deletedAnalyses';
import { COLORS } from '../theme';
import type { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  StackNavigationProp<RootStackParamList>
>;

export default function HomeScreen() {
  const navigation = useNavigation<HomeNavProp>();
  const { user } = useAuth();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useProfile();
  const {
    athletes,
    activeAthlete,
    activeAthleteId,
    setActiveAthlete,
    createAthlete,
  } = useAthletes();

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [analysesLoading, setAnalysesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addAthleteVisible, setAddAthleteVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  // Guard against duplicate simultaneous fetches triggered by useFocusEffect re-fires
  const analysesFetchInFlight = useRef(false);
  // Track which athleteId was used for the last fetch so we can reload on change
  const lastFetchedAthleteId = useRef<string | null | undefined>(undefined);
  // Full pool of fetched analyses — used to refill Home slots after delete
  const allAnalysesPool = useRef<Analysis[]>([]);


  function applyPoolToHome() {
    const visible = allAnalysesPool.current
      .filter(a => !_deletedAnalysisIds.has(a.id))
      .slice(0, 5);
    setAnalyses(visible);
  }

  async function loadAnalyses(forAthleteId?: string) {
    if (analysesFetchInFlight.current) return;
    analysesFetchInFlight.current = true;
    try {
      const data = await getAnalyses(forAthleteId ?? undefined, 0, 50);
      // Prune stale tombstone entries: if server still returns an ID it means the delete
      // never actually succeeded (stale tombstone from a previous failed session).
      // Remove those so valid records aren't permanently hidden.
      const serverIds = new Set(data.map(a => a.id));
      for (const id of Array.from(_deletedAnalysisIds)) {
        if (serverIds.has(id)) _deletedAnalysisIds.delete(id);
      }
      // Filter out any remaining tombstoned IDs (just-deleted, not yet gone from server)
      const filtered = data.filter(a => !_deletedAnalysisIds.has(a.id));
      allAnalysesPool.current = filtered;
      setAnalyses(filtered.slice(0, 5));
      lastFetchedAthleteId.current = forAthleteId;
    } catch {
      // silently fail on load — show empty state
    } finally {
      setAnalysesLoading(false);
      analysesFetchInFlight.current = false;
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadAnalyses(activeAthleteId ?? undefined);
      refetchProfile();
    }, [refetchProfile, activeAthleteId])
  );

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([loadAnalyses(activeAthleteId ?? undefined), refetchProfile()]);
    setRefreshing(false);
  }

  async function handleAthleteSwitch(id: string) {
    await setActiveAthlete(id);
    setAnalysesLoading(true);
    await loadAnalyses(id);
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
    // Optimistic: remove from pool and refill home slots from remaining
    allAnalysesPool.current = allAnalysesPool.current.filter(a => a.id !== id);
    applyPoolToHome();
    try {
      await deleteAnalysis(id);
      // Server confirmed — persist tombstone so it survives app restart
      await persistDeletedId(id);
    } catch (err) {
      // Server delete failed — restore from a fresh fetch
      await loadAnalyses(activeAthleteId ?? undefined);
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

        {/* CTA Buttons */}
        <TouchableOpacity style={styles.recordButton} onPress={handleRecord} activeOpacity={0.85}>
          <Ionicons name="videocam" size={28} color="#000" />
          <Text style={styles.recordButtonText}>Record My Swing</Text>
          <Ionicons name="arrow-forward" size={20} color="#000" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.uploadButton} onPress={handleUpload} activeOpacity={0.85}>
          <Ionicons name="cloud-upload-outline" size={22} color={COLORS.accent} />
          <Text style={styles.uploadButtonText}>Upload Existing Video</Text>
        </TouchableOpacity>

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
