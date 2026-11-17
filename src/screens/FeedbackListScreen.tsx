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
import { getMyFeedback, getCoachFeedback, type FeedbackSummary } from '../lib/feedbackApi';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = StackNavigationProp<RootStackParamList, 'FeedbackList'>;
type Rt = RouteProp<RootStackParamList, 'FeedbackList'>;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function snippet(text: string | null, maxLen = 80): string {
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen) + '…';
}

export default function FeedbackListScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { assignmentId, assignmentTitle, coachView } = route.params ?? {};

  const [feedback, setFeedback] = useState<FeedbackSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const isCoach = coachView === true;
      const res = isCoach
        ? await getCoachFeedback(assignmentId)
        : await getMyFeedback();
      // If assignmentId filter is set (and not coach view, which already filters server-side),
      // filter by assignment_id client-side.
      let filtered = isCoach
        ? res.feedback
        : assignmentId
          ? res.feedback.filter((f) => f.assignment_id === assignmentId)
          : res.feedback;
      // Newest first
      filtered.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setFeedback(filtered);
    } catch {
      // silently keep whatever we had
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [assignmentId, coachView]);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load]),
  );

  function renderItem({ item }: { item: FeedbackSummary }) {
    const isRead = !!item.read_at;
    const hasAudio = !!item.audio_url;
    const hasAnnotations = (item.annotations?.length ?? 0) > 0;

    return (
      <TouchableOpacity
        style={[styles.card, isRead ? styles.cardRead : styles.cardUnread]}
        activeOpacity={0.75}
        onPress={() => navigation.navigate('FeedbackDetail', { feedbackId: item.id })}
      >
        {/* Top row: coach + date + unread dot */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            {!isRead && <View style={styles.unreadDot} />}
            <Text style={styles.coachName}>
              {item.coach_name ?? 'Coach'}  {isRead ? '' : '·  New'}
            </Text>
          </View>
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        </View>

        {/* Assignment title */}
        {item.assignment_title ? (
          <Text style={styles.assignmentTitle}>{item.assignment_title}</Text>
        ) : null}

        {/* Snippet of overall feedback */}
        {item.overall_note ? (
          <Text style={styles.snippet}>{snippet(item.overall_note)}</Text>
        ) : null}

        {/* Indicators: audio, annotations, video */}
        {(hasAudio || hasAnnotations || item.video_url) ? (
          <View style={styles.indicators}>
            {item.video_url ? (
              <View style={styles.indicator}>
                <Ionicons name="videocam" size={12} color={COLORS.muted} />
                <Text style={styles.indicatorText}>Video</Text>
              </View>
            ) : null}
            {hasAudio ? (
              <View style={styles.indicator}>
                <Ionicons name="mic" size={12} color={COLORS.muted} />
                <Text style={styles.indicatorText}>Voice note</Text>
              </View>
            ) : null}
            {hasAnnotations ? (
              <View style={styles.indicator}>
                <Ionicons name="chatbox-ellipses" size={12} color={COLORS.muted} />
                <Text style={styles.indicatorText}>
                  {item.annotations!.length} note{item.annotations!.length > 1 ? 's' : ''}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Ionicons
          name="chevron-forward"
          size={16}
          color={COLORS.muted}
          style={styles.chevron}
        />
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header
          title={assignmentTitle ?? 'Feedback'}
          subtitle={assignmentId ? `All feedback for this task` : 'All coach feedback'}
          onBack={() => navigation.goBack()}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Header
        title={assignmentTitle ?? 'Feedback'}
        subtitle={
          assignmentId
            ? `${feedback.length} feedback${feedback.length !== 1 ? 's' : ''} for this task`
            : `${feedback.length} coach feedback${feedback.length !== 1 ? 's' : ''}`
        }
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={feedback}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          feedback.length === 0 && styles.emptyContent,
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
            <Ionicons name="chatbubbles-outline" size={44} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>No feedback yet</Text>
            <Text style={styles.emptyHint}>
              {assignmentId
                ? 'Your coach hasn\'t left any feedback on this task.'
                : 'Complete a swing analysis to get your first coaching feedback.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function Header({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
}) {
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
    gap: 8,
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
    position: 'relative',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardUnread: {
    borderColor: 'rgba(34,197,94,0.40)',
    backgroundColor: 'rgba(34,197,94,0.06)',
  },
  cardRead: {},
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  coachName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  date: {
    color: COLORS.muted,
    fontSize: 12,
  },
  assignmentTitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 4,
  },
  snippet: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
    paddingRight: 24,
  },
  indicators: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  indicatorText: {
    color: COLORS.muted,
    fontSize: 11,
  },
  chevron: {
    position: 'absolute',
    right: 14,
    top: '50%',
    marginTop: -8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700', marginTop: 16 },
  emptyHint: { color: COLORS.muted, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});