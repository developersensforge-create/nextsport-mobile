import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import { getReferral } from '../lib/api';
import { useLogContext } from '../context/LogContext';
import { COLORS } from '../theme';
import type { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';

type ProfileNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Profile'>,
  StackNavigationProp<RootStackParamList>
>;

interface ReferralData {
  referral_code: string;
  referred_count: number;
}

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileNavProp>();
  const { user, signOut } = useAuth();
  const { profile, loading, refetch } = useProfile();
  const { logs, exportLogs, clearLogs } = useLogContext();
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadReferral() {
    try {
      const data = await getReferral();
      setReferral(data);
    } catch {
      // Referral endpoint may not exist yet — ignore
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadReferral();
    }, [])
  );

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refetch(), loadReferral()]);
    setRefreshing(false);
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (err: any) {
            Alert.alert('Error', err.message ?? 'Failed to sign out.');
          }
        },
      },
    ]);
  }

  async function handleUpgrade() {
    navigation.navigate('Paywall');
  }

  async function handleManageBilling() {
    await WebBrowser.openBrowserAsync('https://nextsport.vercel.app/pricing');
  }

  async function handleShareReferral() {
    if (!referral?.referral_code) return;
    const message = `Use my referral code ${referral.referral_code} to get bonus tokens on NextSport — the AI baseball swing analyzer! 🏈\nhttps://nextsport.vercel.app`;
    try {
      await Share.share({ message });
    } catch {
      // user cancelled
    }
  }

  function formatResetDate(dateStr: string | null): string {
    if (!dateStr) return 'Every Monday';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const isPremium = profile?.subscription_status === 'premium';

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
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {(profile?.full_name ?? user?.email ?? 'A')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{profile?.full_name ?? 'Athlete'}</Text>
          <Text style={styles.email}>{user?.email ?? ''}</Text>

          {/* Plan badge */}
          <View style={[styles.planBadge, isPremium && styles.planBadgePremium]}>
            <Ionicons
              name={isPremium ? 'star' : 'person'}
              size={13}
              color={isPremium ? '#f59e0b' : COLORS.muted}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.planBadgeText, isPremium && styles.planBadgeTextPremium]}>
              {isPremium ? 'Premium Member' : 'Free Plan'}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile?.tokens_remaining ?? '—'}</Text>
            <Text style={styles.statLabel}>Tokens Left</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatResetDate(profile?.token_reset_date ?? null)}</Text>
            <Text style={styles.statLabel}>Next Reset</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, isPremium && { color: '#f59e0b' }]}>
              {isPremium ? 'Premium' : 'Free'}
            </Text>
            <Text style={styles.statLabel}>Plan</Text>
          </View>
        </View>

        {/* Upgrade card (free users only) */}
        {!isPremium && (
          <TouchableOpacity style={styles.upgradeCard} onPress={handleUpgrade} activeOpacity={0.85}>
            <View style={styles.upgradeLeft}>
              <Text style={styles.upgradeTitle}>Go Premium</Text>
              <Text style={styles.upgradeSubtitle}>
                Unlimited tokens + advanced AI feedback
              </Text>
            </View>
            <View style={styles.upgradeRight}>
              <Text style={styles.upgradePrice}>$14.99</Text>
              <Text style={styles.upgradePer}>/mo</Text>
            </View>
            <Ionicons name="arrow-forward" size={20} color="#000" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        )}

        {/* Manage subscription (premium users) */}
        {isPremium && (
          <TouchableOpacity style={styles.manageCard} onPress={handleManageBilling} activeOpacity={0.85}>
            <Ionicons name="card-outline" size={20} color={COLORS.accent} />
            <Text style={styles.manageText}>Manage Subscription</Text>
            <Ionicons name="open-outline" size={16} color={COLORS.muted} />
          </TouchableOpacity>
        )}

        {/* Referral */}
        {referral && (
          <View style={styles.referralCard}>
            <View style={styles.referralHeader}>
              <Ionicons name="gift-outline" size={20} color={COLORS.accent} />
              <Text style={styles.referralTitle}>Refer Friends</Text>
            </View>
            <Text style={styles.referralSubtitle}>
              Share your code and earn bonus tokens for each friend who joins.
            </Text>
            <View style={styles.referralCodeRow}>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{referral.referral_code}</Text>
              </View>
              <TouchableOpacity style={styles.shareCodeButton} onPress={handleShareReferral}>
                <Ionicons name="share-social" size={18} color="#000" />
                <Text style={styles.shareCodeText}>Share</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.referralCount}>
              {referral.referred_count} friend{referral.referred_count !== 1 ? 's' : ''} referred
            </Text>
          </View>
        )}

        {/* Settings sections */}
        <View style={styles.sectionCard}>
          <SettingsRow
            icon="help-circle-outline"
            label="Help & FAQ"
            onPress={() => WebBrowser.openBrowserAsync('https://nextsport.vercel.app/faq')}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => WebBrowser.openBrowserAsync('https://nextsport.vercel.app/terms')}
          />
          <View style={styles.rowDivider} />
          <SettingsRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => WebBrowser.openBrowserAsync('https://nextsport.vercel.app/privacy')}
          />
        </View>

        {/* Debug / Log Export section */}
        <View style={styles.debugCard}>
          <View style={styles.debugHeader}>
            <Ionicons name="bug-outline" size={18} color={COLORS.muted} />
            <Text style={styles.debugTitle}>Debug Logs</Text>
            <Text style={styles.debugCount}>{logs.length} entries</Text>
          </View>
          <Text style={styles.debugSubtitle}>
            Export logs to share with the team when reporting a crash or issue.
          </Text>
          <View style={styles.debugButtonRow}>
            <TouchableOpacity
              style={styles.exportButton}
              onPress={exportLogs}
              activeOpacity={0.85}
            >
              <Ionicons name="share-outline" size={18} color="#000" style={{ marginRight: 6 }} />
              <Text style={styles.exportButtonText}>Export Logs</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() =>
                Alert.alert('Clear Logs', 'Delete all stored debug logs?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', style: 'destructive', onPress: clearLogs },
                ])
              }
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>NextSport v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

interface SettingsRowProps {
  icon: string;
  label: string;
  onPress: () => void;
}

function SettingsRow({ icon, label, onPress }: SettingsRowProps) {
  return (
    <TouchableOpacity style={settingsRowStyles.row} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon as any} size={20} color={COLORS.muted} />
      <Text style={settingsRowStyles.label}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
    </TouchableOpacity>
  );
}

const settingsRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  label: {
    color: COLORS.text,
    fontSize: 15,
    flex: 1,
    marginLeft: 12,
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 2,
    borderColor: 'rgba(34,197,94,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitial: {
    color: COLORS.accent,
    fontSize: 32,
    fontWeight: '800',
  },
  name: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  email: {
    color: COLORS.muted,
    fontSize: 14,
    marginBottom: 10,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(156,163,175,0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(156,163,175,0.2)',
  },
  planBadgePremium: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderColor: 'rgba(245,158,11,0.3)',
  },
  planBadgeText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  planBadgeTextPremium: {
    color: '#f59e0b',
  },
  statsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: { color: COLORS.muted, fontSize: 11 },
  statDivider: { width: 1, height: 36, backgroundColor: COLORS.border },
  upgradeCard: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  upgradeLeft: { flex: 1 },
  upgradeTitle: { color: '#000', fontSize: 16, fontWeight: '800' },
  upgradeSubtitle: { color: 'rgba(0,0,0,0.65)', fontSize: 12, marginTop: 2 },
  upgradeRight: { flexDirection: 'row', alignItems: 'baseline', marginLeft: 8 },
  upgradePrice: { color: '#000', fontSize: 20, fontWeight: '900' },
  upgradePer: { color: 'rgba(0,0,0,0.6)', fontSize: 12, marginLeft: 2 },
  manageCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  manageText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginLeft: 10,
  },
  referralCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  referralTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  referralSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  referralCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeBox: {
    flex: 1,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
  },
  codeText: {
    color: COLORS.accent,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  shareCodeButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareCodeText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  referralCount: {
    color: COLORS.muted,
    fontSize: 12,
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  rowDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },
  debugCard: {
    backgroundColor: 'rgba(22,160,133,0.08)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    marginBottom: 16,
  },
  debugHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  debugTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
    flex: 1,
  },
  debugCount: {
    color: COLORS.muted,
    fontSize: 12,
  },
  debugSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  debugButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exportButton: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  exportButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
  clearButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 14,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    marginBottom: 20,
  },
  signOutText: {
    color: COLORS.danger,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  version: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
  },
});
