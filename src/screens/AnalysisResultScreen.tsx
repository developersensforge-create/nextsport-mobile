import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useVideoPlayer, VideoView } from 'expo-video';
import { getAnalysis, pollAnalysis, Analysis } from '../lib/api';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { mp } from '../lib/mixpanel';

type ResultNavProp = StackNavigationProp<RootStackParamList, 'AnalysisResult'>;
type ResultRouteProp = RouteProp<RootStackParamList, 'AnalysisResult'>;

// ─── Score Gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  function getColor() {
    if (score >= 80) return COLORS.accent;
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  }
  function getLabel() {
    if (score >= 90) return 'Elite';
    if (score >= 80) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Average';
    if (score >= 50) return 'Below Average';
    return 'Needs Work';
  }
  const color = getColor();
  return (
    <View style={gaugeStyles.container}>
      <View style={[gaugeStyles.circle, { borderColor: color }]}>
        <Text style={[gaugeStyles.number, { color }]}>{score}</Text>
        <Text style={[gaugeStyles.outOf, { color }]}>/100</Text>
      </View>
      <Text style={[gaugeStyles.label, { color }]}>{getLabel()}</Text>
    </View>
  );
}

const gaugeStyles = StyleSheet.create({
  container: { alignItems: 'center', marginVertical: 24 },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  number: { fontSize: 40, fontWeight: '900' },
  outOf: { fontSize: 13, fontWeight: '500', marginTop: -4 },
  label: { fontSize: 16, fontWeight: '700', marginTop: 8 },
});

// ─── Annotated Video Card ─────────────────────────────────────────────────────

function SwingVideoCard({ videoUrl }: { videoUrl: string }) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
  });
  return (
    <View style={styles.videoCard}>
      <View style={styles.videoCardHeader}>
        <Text style={styles.videoCardTitle}>🎬 Your Annotated Swing</Text>
        <Text style={styles.videoCardSubtitle}>Slow motion with coaching cues</Text>
      </View>
      <VideoView
        player={player}
        style={styles.videoPlayer}
        contentFit="contain"
        nativeControls
      />
    </View>
  );
}

// ─── Scores Section ───────────────────────────────────────────────────────────

function ScoresSection({ scores }: { scores: Record<string, number> }) {
  const entries = Object.entries(scores);
  if (entries.length === 0) return null;

  function scoreColor(val: number) {
    if (val >= 4) return COLORS.accent;
    if (val >= 3) return '#f59e0b';
    return '#ef4444';
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>SWING SCORES</Text>
      <View style={styles.scoresGrid}>
        {entries.map(([key, val]) => {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          const color = scoreColor(val);
          return (
            <View key={key} style={styles.scoreItem}>
              <Text style={[styles.scoreValue, { color }]}>{val}<Text style={styles.scoreMax}>/5</Text></Text>
              <Text style={styles.scoreLabel}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Strengths Section ────────────────────────────────────────────────────────

function StrengthsSection({ strengths }: { strengths: string[] }) {
  if (!strengths || strengths.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>✅ STRENGTHS</Text>
      <Text style={styles.sectionSubtitle}>What's working well in your swing.</Text>
      {strengths.map((item, i) => (
        <View key={i} style={styles.strengthItem}>
          <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} style={{ marginTop: 2 }} />
          <Text style={styles.strengthText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Parse raw_analysis JSON ─────────────────────────────────────────────────

/**
 * raw_analysis (feedback字段) 是标准 JSON 字符串，结构：
 * {
 *   "scores": { "stance_load": 3, ... },
 *   "areas-to-improve-fix": [{ "Title": "desc", "fix": "..." }, ...],
 *   "training-priorities": "...",
 *   "comments-and-annotations": [...]
 * }
 *
 * improvements 字段存的是 Python str(dict)，解析不可靠。
 * 统一改为从 feedback (raw_analysis) 里解析。
 */
function parseRawAnalysis(feedback: string | null): {
  improvements: Improvement[];
  scores: Record<string, number> | null;
} {
  if (!feedback) return { improvements: [], scores: null };
  try {
    const d = JSON.parse(feedback);
    const improvements: Improvement[] = (d['areas-to-improve-fix'] ?? []).map((item: any) => item as Improvement);
    const scores = d['scores'] ?? null;
    return { improvements, scores };
  } catch {
    return { improvements: [], scores: null };
  }
}

// ─── Improvements Section ─────────────────────────────────────────────────────

type Improvement = { fix?: string; [key: string]: string | undefined };

/**
 * 后端存储时用了 Python str(dict)，导致单引号格式，无法直接 JSON.parse。
 * 例: "{'Bat Drag': \"desc\", 'fix': 'do this'}"
 * 策略：把单引号 key/value 转成双引号，再 JSON.parse。
 */
function parsePythonDictString(raw: string): Improvement | null {
  try {
    // 如果已经是对象直接返回
    if (typeof raw === 'object' && raw !== null) return raw as Improvement;
    if (typeof raw !== 'string') return null;
    // 替换 Python dict 格式 → JSON 格式
    // 1. 把 \' 占位避免影响后续替换
    let s = raw.trim();
    // 把外层花括号内的单引号 key 换成双引号
    // 思路：用 JSON 宽容解析 — 先把单引号换成双引号，双引号内的单引号保护
    s = s
      .replace(/'/g, '"')           // 全部单引号换双引号
      .replace(/"{2,}/g, '"')       // 连续双引号缩为一个（处理已有双引号的值）
      .replace(/\\"/g, "'");         // 还原原来的转义双引号（变回单引号在值里）
    return JSON.parse(s) as Improvement;
  } catch {
    // 解析失败：用正则直接抽取 key/value/fix
    try {
      const titleMatch = raw.match(/[{,]\s*['"](.+?)['"]\s*:\s*['"](.*?)['"]\s*[,}]/);
      const fixMatch = raw.match(/['"]fix['"]\s*:\s*['"](.+?)['"]\s*[}]/s);
      if (titleMatch) {
        const result: Improvement = { [titleMatch[1]]: titleMatch[2] };
        if (fixMatch) result.fix = fixMatch[1];
        return result;
      }
    } catch { /* ignore */ }
    return null;
  }
}

function ImprovementsSection({ improvements }: { improvements: any[] }) {
  if (!improvements || improvements.length === 0) return null;

  // 统一转成 Improvement 对象
  const parsed: Improvement[] = improvements.map((item) =>
    typeof item === 'string' ? (parsePythonDictString(item) ?? {}) : (item as Improvement)
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🎯 AREAS TO IMPROVE</Text>
      <Text style={styles.sectionSubtitle}>Focus on these next to make the biggest difference.</Text>
      {parsed.map((item, i) => {
        const keys = Object.keys(item).filter((k) => k !== 'fix');
        const title = keys[0] ?? `Issue ${i + 1}`;
        const description = item[title] ?? '';
        const fix = item.fix ?? null;

        return (
          <View key={i} style={styles.improvementCard}>
            <View style={styles.improvementHeader}>
              <View style={styles.improvementBadge}>
                <Text style={styles.improvementBadgeText}>{i + 1}</Text>
              </View>
              <Text style={styles.improvementTitle}>{title}</Text>
            </View>
            {!!description && (
              <Text style={styles.improvementBody}>{description}</Text>
            )}
            {!!fix && (
              <View style={styles.fixBox}>
                <Text style={styles.fixLabel}>SUGGESTED FIX</Text>
                <Text style={styles.fixText}>{fix}</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Recommended Drills Section ───────────────────────────────────────────────

function DrillsSection({ drills }: { drills: string[] }) {
  if (!drills || drills.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🏋️ RECOMMENDED DRILLS</Text>
      {drills.map((drill, i) => (
        <View key={i} style={styles.drillItem}>
          <Ionicons name="fitness" size={16} color={COLORS.accent} style={{ marginTop: 2 }} />
          <Text style={styles.drillText}>{drill}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AnalysisResultScreen() {
  const navigation = useNavigation<ResultNavProp>();
  const route = useRoute<ResultRouteProp>();

  const params = route.params ?? {};
  const analysisId = (params as any).analysisId as string | undefined;
  const poll = (params as any).poll as boolean | undefined;

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!analysisId) {
        if (!cancelled) { setError('Invalid analysis ID.'); setLoading(false); }
        return;
      }
      if (!cancelled) { setLoading(true); setError(null); setTimedOut(false); setAttemptCount(0); }
      try {
        const result = poll
          ? await pollAnalysis(analysisId, 60, (attempt) => {
              if (!cancelled) setAttemptCount(attempt);
            })
          : await getAnalysis(analysisId);
        if (!cancelled) setAnalysis(result);
      } catch (err: any) {
        if (!cancelled) {
          const message = err.message ?? 'Failed to load analysis.';
          if (message === 'Analysis timed out') {
            setTimedOut(true);
            setLoading(false);
          } else {
            setError(message);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [analysisId, poll]);

  async function handleShare() {
    if (!analysis) return;
    const message = `🏈 My NextSport swing analysis is in!\n\nGet your own AI swing analysis at nextsport-sensforge.vercel.app`;
    try {
      mp.track("analysis_shared", { analysis_id: analysis.id });
      await Share.share({ message });
    } catch { /* user cancelled */ }
  }

  function handleAnalyzeAnother() {
    navigation.navigate('Record');
  }

  async function handleContinueWaiting() {
    if (!analysisId) return;
    setTimedOut(false);
    setLoading(true);
    setAttemptCount(0);
    try {
      const result = await pollAnalysis(analysisId, 60, (attempt) => {
        setAttemptCount(attempt);
      });
      setAnalysis(result);
    } catch (err: any) {
      const message = err.message ?? 'Failed to load analysis.';
      if (message === 'Analysis timed out') {
        setTimedOut(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Swing Analysis</Text>
          <View style={styles.shareButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingTitle}>
            {poll ? 'Analyzing your swing…' : 'Loading results…'}
          </Text>
          {poll && (
            <Text style={styles.loadingSubtitle}>
              {attemptCount >= 30
                ? `Still working… (${attemptCount * 2}s)\nHang tight — your video is being processed.`
                : 'Our AI is reviewing your technique.\nThis usually takes 20–60 seconds.'}
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Timed Out ──
  if (timedOut) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Swing Analysis</Text>
          <View style={styles.shareButton} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="time-outline" size={56} color="#f59e0b" />
          <Text style={styles.errorTitle}>Taking longer than usual</Text>
          <Text style={styles.errorText}>
            Your analysis is still processing on the server.{'\n'}You can keep waiting or check back later.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleContinueWaiting}>
            <Text style={styles.retryButtonText}>Continue Waiting</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: 'transparent', marginTop: 10 }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.retryButtonText, { color: COLORS.muted }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──
  if (error || !analysis) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={56} color={COLORS.danger} />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error ?? 'Could not load analysis.'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Failed ──
  if (analysis.status === 'failed') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.errorContainer}>
          <Ionicons name="close-circle" size={56} color={COLORS.danger} />
          <Text style={styles.errorTitle}>Analysis Failed</Text>
          <Text style={styles.errorText}>
            We couldn't process your video. Please try recording again with better lighting.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleAnalyzeAnother}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 从 feedback (raw_analysis JSON) 解析结构化数据，比 improvements 字段更可靠
  const { improvements, scores: parsedScores } = parseRawAnalysis(analysis.feedback);
  const scores = parsedScores ?? ((analysis as any).scores as Record<string, number> | null);
  const strengths = (analysis as any).strengths as string[] ?? [];
  const drills = (analysis as any).recommended_drills as string[] ?? [];
  const hasStructuredData = strengths.length > 0 || improvements.length > 0 || drills.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Swing Analysis</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
          <Ionicons name="share-outline" size={24} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Video — annotated swing */}
        {analysis.video_url && <SwingVideoCard videoUrl={analysis.video_url} />}

        {/* Video processing placeholder */}
        {!analysis.video_url && analysis.status === 'completed' && (
          <View style={styles.videoProcessingCard}>
            <Text style={styles.videoProcessingText}>
              🎬 Check back in 5–10 min — your annotated video is still processing.
            </Text>
          </View>
        )}

        {/* Score gauge */}
        {analysis.score !== null && <ScoreGauge score={analysis.score} />}

        {/* Structured sections */}
        {scores && Object.keys(scores).length > 0 && <ScoresSection scores={scores} />}
        {hasStructuredData ? (
          <>
            <StrengthsSection strengths={strengths} />
            <ImprovementsSection improvements={improvements} />
            <DrillsSection drills={drills} />
          </>
        ) : (
          // Fallback: raw text if structured data is missing
          analysis.feedback ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>COACHING FEEDBACK</Text>
              <Text style={styles.fallbackBody}>{analysis.feedback}</Text>
            </View>
          ) : null
        )}

        {/* Actions */}
        <TouchableOpacity
          style={styles.analyzeAnotherButton}
          onPress={handleAnalyzeAnother}
          activeOpacity={0.85}
        >
          <Ionicons name="videocam" size={20} color="#000" style={{ marginRight: 8 }} />
          <Text style={styles.analyzeAnotherText}>Analyze Another Swing</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareButtonBottom} onPress={handleShare} activeOpacity={0.85}>
          <Ionicons name="share-social-outline" size={20} color={COLORS.accent} style={{ marginRight: 8 }} />
          <Text style={styles.shareButtonBottomText}>Share Results</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: { padding: 8, width: 44 },
  topBarTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  shareButton: { padding: 8, width: 44, alignItems: 'flex-end' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  loadingTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginTop: 20, textAlign: 'center' },
  loadingSubtitle: { color: COLORS.muted, fontSize: 14, marginTop: 10, textAlign: 'center', lineHeight: 20 },

  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  errorTitle: { color: COLORS.text, fontSize: 20, fontWeight: '700', marginTop: 16 },
  errorText: { color: COLORS.muted, fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  retryButton: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  retryButtonText: { color: COLORS.text, fontSize: 15, fontWeight: '600' },

  // Video
  videoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  videoCardHeader: { padding: 14, paddingBottom: 10 },
  videoCardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  videoCardSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  videoPlayer: { width: '100%', height: 220 },
  videoProcessingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  videoProcessingText: { color: COLORS.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Generic section wrapper
  section: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },

  // Scores
  scoresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  scoreItem: { alignItems: 'center', minWidth: 70 },
  scoreValue: { fontSize: 26, fontWeight: '800' },
  scoreMax: { fontSize: 12, fontWeight: '400', color: COLORS.muted },
  scoreLabel: { color: COLORS.muted, fontSize: 11, marginTop: 2, textAlign: 'center' },

  // Strengths
  strengthItem: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'flex-start' },
  strengthText: { flex: 1, color: COLORS.text, fontSize: 14, lineHeight: 21 },

  // Improvements
  improvementCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  improvementHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  improvementBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  improvementBadgeText: { color: '#000', fontSize: 13, fontWeight: '800' },
  improvementTitle: { flex: 1, color: COLORS.accent, fontSize: 14, fontWeight: '700' },
  improvementBody: { color: COLORS.text, fontSize: 14, lineHeight: 21, marginBottom: 10 },
  fixBox: {
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  fixLabel: { color: COLORS.accent, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  fixText: { color: COLORS.text, fontSize: 13, lineHeight: 19 },

  // Drills
  drillItem: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'flex-start' },
  drillText: { flex: 1, color: COLORS.text, fontSize: 14, lineHeight: 21 },

  // Fallback raw text
  fallbackBody: { color: COLORS.text, fontSize: 14, lineHeight: 22, marginTop: 8 },

  // Buttons
  analyzeAnotherButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  analyzeAnotherText: { color: '#000', fontSize: 16, fontWeight: '800' },
  shareButtonBottom: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  shareButtonBottomText: { color: COLORS.accent, fontSize: 15, fontWeight: '600' },
});
