import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { getAthletes, createInvite, Athlete, PendingInvite } from '../lib/api';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type AthletesNavProp = StackNavigationProp<RootStackParamList>;

function formatExpiry(dateStr: string): string {
  const expiry = new Date(dateStr);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return `${Math.floor(diffMs / (1000 * 60))}m remaining`;
  if (diffHours < 24) return `${diffHours}h remaining`;
  return `${Math.floor(diffHours / 24)}d remaining`;
}

function formatLastAnalysis(val: string | null): string {
  if (!val) return 'No analyses yet';
  try {
    const date = new Date(val);
    if (isNaN(date.getTime())) return 'No analyses yet';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'No analyses yet';
  }
}

export default function AthletesScreen() {
  const navigation = useNavigation<AthletesNavProp>();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviting, setInviting] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getAthletes();
      setAthletes(data.athletes ?? []);
      setPendingInvites(data.pending_invites ?? []);
    } catch {
      // silently fail
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
          const data = await getAthletes();
          if (!cancelled) {
            setAthletes(data.athletes ?? []);
            setPendingInvites(data.pending_invites ?? []);
          }
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

  async function handleCreateInvite() {
    setInviting(true);
    try {
      const invite = await createInvite();
      Alert.alert(
        'Invite Created',
        `Code: ${invite.invite_code}\n\nShare this link with your athlete:`,
        [
          {
            text: 'Share Link',
            onPress: () => {
              Share.share({
                message: `Join my training program: ${invite.share_url}\n\nOr enter invite code: ${invite.invite_code}`,
                url: invite.share_url,
              }).catch(() => {});
            },
          },
          {
            text: 'Close',
            style: 'cancel',
          },
        ]
      );
      // Reload to show pending invite
      loadData(true);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? err?.message ?? 'Please try again');
    } finally {
      setInviting(false);
    }
  }

  function handleAthletePress(athlete: Athlete) {
    navigation.navigate('AthleteDetail', {
      playerId: athlete.player_id,
      playerName: athlete.player_name,
    });
  }

  async function handleShareInvite(invite: PendingInvite) {
    try {
      await Share.share({
        message: `Join my training program: ${invite.share_url}\n\nOr enter invite code: ${invite.invite_code}`,
        url: invite.share_url,
      });
    } catch {
      // user cancelled
    }
  }

  function renderAthlete({ item }: { item: Athlete }) {
    const initial = (item.player_name || 'A')[0].toUpperCase();
    return (
      <TouchableOpacity
        style={styles.athleteRow}
        onPress={() => handleAthletePress(item)}
        activeOpacity={0.75}
      >
        {/* Avatar */}
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitial}>{initial}</Text>
        </View>

        {/* Info */}
        <View style={styles.athleteInfo}>
          <Text style={styles.athleteName}>{item.player_name}</Text>
          <Text style={styles.athleteMeta}>
            Last analysis: {formatLastAnalysis(item.latest_analysis)}
            {item.pending_assignments_count > 0
              ? ` · ${item.pending_assignments_count} pending`
              : ''}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
      </TouchableOpacity>
    );
  }

  function renderPendingInvite(invite: PendingInvite) {
    return (
      <View key={invite.id} style={styles.inviteRow}>
        <View style={styles.inviteInfo}>
          <Text style={styles.inviteCode}>{invite.invite_code}</Text>
          <Text style={styles.inviteExpiry}>{formatExpiry(invite.invite_expires_at)}</Text>
        </View>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => handleShareInvite(invite)}
          activeOpacity={0.8}
        >
          <Ionicons name="share-social-outline" size={16} color="#000" />
          <Text style={styles.shareBtnText}>Share</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>My Students</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>My Students</Text>
        <TouchableOpacity
          style={[styles.inviteBtn, inviting && { opacity: 0.6 }]}
          onPress={handleCreateInvite}
          disabled={inviting}
          activeOpacity={0.8}
        >
          {inviting ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="add" size={18} color="#000" />
              <Text style={styles.inviteBtnText}>Invite</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={athletes}
        keyExtractor={(item) => item.player_id}
        renderItem={renderAthlete}
        contentContainerStyle={[
          styles.listContent,
          athletes.length === 0 && pendingInvites.length === 0 && styles.emptyContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(true); }}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          pendingInvites.length > 0 ? (
            <View style={styles.pendingSection}>
              <Text style={styles.pendingSectionTitle}>Pending Invites</Text>
              {pendingInvites.map(renderPendingInvite)}
            </View>
          ) : null
        }
        ListEmptyComponent={
          pendingInvites.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🏃</Text>
              <Text style={styles.emptyTitle}>No Students Yet</Text>
              <Text style={styles.emptyHint}>
                Tap + to invite your first student
              </Text>
            </View>
          ) : null
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
  },
  topBarTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    flex: 1,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 4,
  },
  inviteBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 8,
  },
  emptyContent: { flex: 1 },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  athleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(34,197,94,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitial: {
    color: COLORS.accent,
    fontSize: 18,
    fontWeight: '800',
  },
  athleteInfo: { flex: 1, justifyContent: 'center', minHeight: 46 },
  athleteName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  athleteMeta: {
    color: COLORS.muted,
    fontSize: 12,
  },
  pendingSection: {
    marginBottom: 16,
  },
  pendingSectionTitle: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    padding: 12,
    marginBottom: 8,
  },
  inviteInfo: { flex: 1 },
  inviteCode: {
    color: COLORS.warning,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 2,
  },
  inviteExpiry: {
    color: COLORS.muted,
    fontSize: 12,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  shareBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyHint: {
    color: COLORS.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
});
