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
import { getAnalyses, Analysis } from '../lib/api';
import AnalysisCard from '../components/AnalysisCard';
import TokenBadge from '../components/TokenBadge';
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
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [analysesLoading, setAnalysesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Guard against duplicate simultaneous fetches triggered by useFocusEffect re-fires
  const analysesFetchInFlight = useRef(false);

  async function loadAnalyses() {
    if (analysesFetchInFlight.current) return;
    analysesFetchInFlight.current = true;
    try {
      const data = await getAnalyses();
      setAnalyses(data.slice(0, 5));
    } catch {
      // silently fail on load — show empty state
    } finally {
      setAnalysesLoading(false);
      analysesFetchInFlight.current = false;
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadAnalyses();
      refetchProfile();
    }, [refetchProfile])
  );

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([loadAnalyses(), refetchProfile()]);
    setRefreshing(false);
  }

  function handleRecord() {
    if (profile && profile.tokens_remaining <= 0) {
      navigation.navigate('Paywall');
      return;
    }
    navigation.navigate('Record');
  }

  function handleUpload() {
    if (profile && profile.tokens_remaining <= 0) {
      navigation.navigate('Paywall');
      return;
    }
    navigation.navigate('Record', { mode: 'upload' });
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
          <Text style={styles.sectionTitle}>Recent Analyses</Text>
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
                onPress={() => navigation.navigate('AnalysisResult', { analysisId: a.id })}
              />
            ))
          )}
        </View>
      </ScrollView>
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
    marginBottom: 20,
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
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
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
