import React, { useCallback, useEffect, useState } from 'react';
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
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';

import VideoWithMarkers, { formatClock } from '../components/VideoWithMarkers';
import {
  getFeedbackDetail,
  markFeedbackRead,
  type FeedbackDetail,
} from '../lib/feedbackApi';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = StackNavigationProp<RootStackParamList, 'FeedbackDetail'>;
type Rt = RouteProp<RootStackParamList, 'FeedbackDetail'>;

/**
 * 语音播放：先把文件下载到本地缓存，再从 file:// 播放。
 *
 * 为什么不直接播签名 URL：Supabase 按扩展名把 .m4a 回成 `audio/m4a`，
 * 这个非标准 MIME 会让 Android ExoPlayer 选不到解复用器 → play() 静默无操作，
 * 表现就是「点了没反应」。本地文件不走 HTTP，彻底绕开 content-type 判断。
 */
function AudioBar({ url, durationSec }: { url: string; durationSec: number | null }) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLocalUri(null);
    setLoadError(null);

    (async () => {
      try {
        // 30s 超时：网络静默断开时不会永远转圈
        const pathPart = url.split('?')[0].split('/sign/').pop()?.replace(/[^a-zA-Z0-9_-]/g, '_') ?? 'audio';
        const dest = new File(Paths.cache, `coach-note-${pathPart}.m4a`);
        const dl = File.downloadFileAsync(url, dest, { idempotent: true });
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Download timed out — check your connection')), 30000),
        );
        const file = await Promise.race([dl, timeout]);
        if (!cancelled) setLocalUri(file.uri);
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.message ?? 'Download failed');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loadError) {
    return (
      <View>
        <View style={styles.audioBar}>
          <Ionicons name="alert-circle" size={18} color={COLORS.danger} />
          <View style={{ flex: 1 }}>
            <Text style={styles.audioLabel}>Coach voice note</Text>
            <Text style={styles.audioTime}>Couldn't download the audio</Text>
          </View>
        </View>
        <Text style={styles.audioError}>{loadError}</Text>
      </View>
    );
  }

  if (!localUri) {
    return (
      <View style={styles.audioBar}>
        <ActivityIndicator size="small" color={COLORS.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.audioLabel}>Coach voice note</Text>
          <Text style={styles.audioTime}>Preparing audio…</Text>
        </View>
      </View>
    );
  }

  return <AudioPlayerInner uri={localUri} durationSec={durationSec} />;
}

function AudioPlayerInner({ uri, durationSec }: { uri: string; durationSec: number | null }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState<string | null>(null);

  const total = durationSec ?? status.duration ?? 0;
  const atEnd = total > 0 && (status.currentTime ?? 0) >= total - 0.25;

  async function toggle() {
    try {
      setError(null);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

      if (status.playing) {
        player.pause();
        return;
      }
      if (status.didJustFinish || atEnd) {
        await player.seekTo(0);
      }
      player.play();
    } catch (err: any) {
      setError(err?.message ?? 'Playback failed');
    }
  }

  return (
    <View>
      <View style={styles.audioBar}>
        <TouchableOpacity style={styles.playBtn} onPress={toggle}>
          <Ionicons name={status.playing ? 'pause' : 'play'} size={18} color="#04110a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.audioLabel}>Coach voice note</Text>
          <Text style={styles.audioTime}>
            {`${formatClock(status.currentTime ?? 0)} / ${formatClock(total)}`}
          </Text>
        </View>
      </View>
      {error ? (
        <Text style={styles.audioError}>Can't play the voice note: {error}</Text>
      ) : null}
    </View>
  );
}

export default function FeedbackDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { feedbackId } = route.params;

  const [data, setData] = useState<FeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getFeedbackDetail(feedbackId);
      setData(res.feedback);
      // 打点失败静默，绝不影响阅读
      markFeedbackRead(feedbackId).catch(() => {});
    } catch {
      // keep whatever we had
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [feedbackId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.mutedText}>Feedback not available.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 12 }}>
            <Text style={styles.link}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const created = new Date(data.created_at);
  const createdValid = !Number.isNaN(created.getTime());
  const dateLabel = createdValid
    ? created.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Coach Feedback</Text>
          <Text style={styles.headerSub}>
            {[data.coach_name ?? 'Coach', dateLabel].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={COLORS.accent}
          />
        }
      >
        {data.assignment_title ? (
          <Text style={styles.assignmentTitle}>{data.assignment_title}</Text>
        ) : null}

        {data.video_url ? (
          <VideoWithMarkers
            videoUrl={data.video_url}
            annotations={data.annotations}
            headerTitle="YOUR SWING"
          />
        ) : (
          <View style={styles.noVideo}>
            <Ionicons name="videocam-off-outline" size={18} color={COLORS.muted} />
            <Text style={styles.noVideoText}>
              The video for this swing is no longer stored. The timestamps below are kept
              for reference.
            </Text>
          </View>
        )}

        {data.audio_url ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VOICE NOTE</Text>
            <AudioBar url={data.audio_url} durationSec={data.audio_duration_sec} />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            TIMESTAMPED NOTES ({(data.annotations ?? []).length})
          </Text>
          {(data.annotations ?? []).length === 0 ? (
            <Text style={styles.mutedText}>No timestamped notes.</Text>
          ) : (
            (data.annotations ?? []).map((a, i) => (
              <View key={`${a.time_sec}-${i}`} style={styles.annRow}>
                <View style={styles.timeChip}>
                  <Text style={styles.timeChipText}>{formatClock(a.time_sec)}</Text>
                </View>
                <Text style={styles.annText}>{a.text}</Text>
              </View>
            ))
          )}
        </View>

        {data.overall_note ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>OVERALL FEEDBACK</Text>
            <Text style={styles.noteText}>{data.overall_note}</Text>
          </View>
        ) : null}

        <Text style={styles.footnote}>
          {[data.read_at ? 'Marked as read' : 'New', dateLabel ? `sent ${dateLabel}` : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </ScrollView>
    </SafeAreaView>
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  headerSub: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  content: { padding: 16, paddingBottom: 40 },
  assignmentTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  noVideo: {
    flexDirection: 'row',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 4,
  },
  noVideoText: { color: COLORS.muted, fontSize: 13, flex: 1, lineHeight: 19 },
  section: {
    marginTop: 18,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  annRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  timeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  timeChipText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  annText: { color: COLORS.text, fontSize: 13, flex: 1, lineHeight: 19 },
  noteText: { color: COLORS.text, fontSize: 14, lineHeight: 21 },
  mutedText: { color: COLORS.muted, fontSize: 13 },
  link: { color: COLORS.accent, fontSize: 14, fontWeight: '700' },
  audioBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderRadius: 12,
    padding: 12,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioLabel: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  audioTime: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  audioError: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 17,
  },
  footnote: {
    color: COLORS.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 24,
  },
});
