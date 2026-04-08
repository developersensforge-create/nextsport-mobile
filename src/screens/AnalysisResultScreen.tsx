import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Video, ResizeMode } from 'expo-av';
import { getAnalysis, pollAnalysis, Analysis } from '../lib/api';
import { summarizeAnalysisForLog } from '../lib/analysisDebug';
import { logger } from '../lib/logger';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type ResultNavProp = StackNavigationProp<RootStackParamList, 'AnalysisResult'>;
type ResultRouteProp = RouteProp<RootStackParamList, 'AnalysisResult'>;

export default function AnalysisResultScreen() {
  const navigation = useNavigation<ResultNavProp>();
  const route = useRoute<ResultRouteProp>();
  const { analysisId, poll, prefetchedData } = route.params;

  // Initialize directly from prefetchedData if available — avoids async state update crash
  const [analysis, setAnalysis] = useState<Analysis | null>(prefetchedData ?? null);
  const [loading, setLoading] = useState(!prefetchedData);
  const [error, setError] = useState<string | null>(null);
  const [videoPlayable, setVideoPlayable] = useState(true);
  const [videoRefreshLoading, setVideoRefreshLoading] = useState(false);

  const TAG = 'AnalysisResultScreen';
  const loadGeneration = useRef(0);
  const renderCount = useRef(0);
  const autoRefreshFired = useRef(false);
  const refreshInFlight = useRef(false);

  renderCount.current += 1;

  const resultVideoUrl = useMemo(() => {
    const raw = analysis?.result_video_url;
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
      return null;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      logger.warn(TAG, 'result video URL is not a valid http(s) URL', {
        result_video_url_len: trimmed.length,
        result_video_url_prefix: trimmed.slice(0, 24),
      });
      return null;
    }
    return trimmed;
  }, [analysis]);

  const refreshResultVideo = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setVideoRefreshLoading(true);
    try {
      logger.info(TAG, 'refreshResultVideo: fetching latest analysis', { analysisId });
      const latest = await getAnalysis(analysisId);
      setAnalysis(latest);
      logger.info(TAG, 'refreshResultVideo: latest fetched', {
        summary: summarizeAnalysisForLog(latest),
      });
    } catch (err) {
      logger.warn(TAG, 'refreshResultVideo: failed', err);
    } finally {
      refreshInFlight.current = false;
      setVideoRefreshLoading(false);
    }
  }, [analysisId]);

  useEffect(() => {
    setVideoPlayable(true);
  }, [resultVideoUrl]);

  useEffect(() => {
    if (!prefetchedData || resultVideoUrl || autoRefreshFired.current) return;
    autoRefreshFired.current = true;
    const t = setTimeout(() => {
      refreshResultVideo();
    }, 1500);
    return () => clearTimeout(t);
  }, [prefetchedData, resultVideoUrl, refreshResultVideo]);

  useEffect(() => {
    logger.info(TAG, 'screen lifecycle: committed render', {
      renderCount: renderCount.current,
      loading,
      hasError: !!error,
      hasAnalysis: !!analysis,
      status: analysis?.status ?? null,
    });
  });

  useEffect(() => {
    logger.info(TAG, 'mounted', {
      analysisId,
      poll: poll ?? false,
      hasPrefetch: !!prefetchedData,
      prefetchSummary: summarizeAnalysisForLog(prefetchedData ?? null),
    });
    return () => {
      logger.info(TAG, 'unmounted', {
        analysisId,
        renderCount: renderCount.current,
      });
    };
  }, [analysisId, poll, prefetchedData]);

  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => {
      logger.info(TAG, 'nav event: focus', { analysisId });
    });
    const unsubBlur = navigation.addListener('blur', () => {
      logger.info(TAG, 'nav event: blur', { analysisId });
    });
    const unsubBeforeRemove = navigation.addListener('beforeRemove', (e: any) => {
      logger.info(TAG, 'nav event: beforeRemove', {
        analysisId,
        actionType: e?.data?.action?.type,
      });
    });
    const unsubTransitionStart = navigation.addListener('transitionStart' as never, (e: any) => {
      logger.info(TAG, 'nav event: transitionStart', {
        analysisId,
        closing: e?.data?.closing,
      });
    });
    const unsubTransitionEnd = navigation.addListener('transitionEnd' as never, (e: any) => {
      logger.info(TAG, 'nav event: transitionEnd', {
        analysisId,
        closing: e?.data?.closing,
      });
    });
    return () => {
      unsubFocus();
      unsubBlur();
      unsubBeforeRemove();
      unsubTransitionStart();
      unsubTransitionEnd();
    };
  }, [navigation, analysisId]);

  useEffect(() => {
    if (loading) {
      logger.info(TAG, 'render→loading', { analysisId, poll: poll ?? false });
      return;
    }
    if (error || !analysis) {
      logger.info(TAG, 'render→error or missing analysis', {
        analysisId,
        error,
        summary: summarizeAnalysisForLog(analysis ?? null),
      });
      return;
    }
    if (analysis.status === 'failed') {
      logger.info(TAG, 'render→failed status', {
        analysisId,
        summary: summarizeAnalysisForLog(analysis),
      });
      return;
    }
    logger.info(TAG, 'render→success body', {
      analysisId,
      summary: summarizeAnalysisForLog(analysis),
      resolvedVideoUrl: !!resultVideoUrl,
      videoPlayable,
    });
  }, [loading, error, analysis, analysisId, poll, resultVideoUrl, videoPlayable]);

  useLayoutEffect(() => {
    if (loading || error || !analysis || analysis.status === 'failed') return;
    logger.info(TAG, 'layout: main result UI (sync, before paint)', {
      analysisId,
      summary: summarizeAnalysisForLog(analysis),
      showVideoPlayer: !!(resultVideoUrl && videoPlayable),
      resultVideoUrlResolved: !!resultVideoUrl,
      videoPlayable,
    });
  }, [loading, error, analysis, analysisId, resultVideoUrl, videoPlayable]);

  useEffect(() => {
    if (!analysis || analysis.status === 'failed') return;
    const check = (label: 'strengths' | 'improvements', arr: unknown) => {
      if (!Array.isArray(arr)) {
        logger.warn(TAG, `${label} is not an array`, { type: typeof arr });
        return;
      }
      const bad = arr.findIndex((x) => typeof x !== 'string');
      if (bad >= 0) {
        logger.warn(TAG, `${label} contains non-string at index ${bad}`, {
          types: arr.slice(0, 10).map((x) => typeof x),
        });
      }
    };
    check('strengths', analysis.strengths);
    check('improvements', analysis.improvements);
  }, [analysis]);

  useEffect(() => {
    async function load() {
      const gen = ++loadGeneration.current;
      setLoading(true);
      setError(null);
      logger.info(TAG, `load: starting — analysisId=${analysisId} poll=${poll} hasPrefetch=${!!prefetchedData} gen=${gen}`);
      try {
        // If prefetched data was passed via navigation params, use it directly
        // to avoid a redundant API call (which can cause crashes under memory pressure)
        if (prefetchedData) {
          logger.info(TAG, 'load: using prefetchedData — skipping getAnalysis call', {
            gen,
            summary: summarizeAnalysisForLog(prefetchedData),
          });
          if (gen !== loadGeneration.current) return;
          setAnalysis(prefetchedData);
          setLoading(false);
          logger.info(TAG, 'load: prefetch path done', { gen, summary: summarizeAnalysisForLog(prefetchedData) });
          return;
        }
        if (poll) {
          logger.info(TAG, 'load: entering pollAnalysis loop', { gen });
          const result = await pollAnalysis(analysisId);
          logger.info(TAG, 'load: pollAnalysis complete', {
            gen,
            status: result.status,
            summary: summarizeAnalysisForLog(result),
          });
          if (gen !== loadGeneration.current) return;
          setAnalysis(result);
        } else {
          logger.info(TAG, 'load: fetching single analysis', { gen });
          const result = await getAnalysis(analysisId);
          logger.info(TAG, 'load: getAnalysis done', {
            gen,
            status: result.status,
            summary: summarizeAnalysisForLog(result),
          });
          if (gen !== loadGeneration.current) return;
          setAnalysis(result);
        }
      } catch (err: any) {
        logger.error(TAG, `load: FAILED to load analysis (gen=${gen})`, err);
        if (gen !== loadGeneration.current) return;
        setError(err.message ?? 'Failed to load analysis.');
      } finally {
        if (gen === loadGeneration.current) {
          setLoading(false);
          logger.info(TAG, 'load: finally — loading=false', { gen });
        }
      }
    }
    load();
  }, [analysisId, poll, prefetchedData]);

  async function handleShare() {
    if (!analysis) return;
    const message = `🏈 My NextSport swing analysis is in!\n\nGet your own AI swing analysis at nextsport.vercel.app`;
    try {
      await Share.share({ message });
    } catch {
      // user cancelled or error
    }
  }

  function handleAnalyzeAnother() {
    navigation.navigate('Record');
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.loadingTitle}>
            {poll ? 'Analyzing your swing…' : 'Loading results…'}
          </Text>
          {poll && (
            <Text style={styles.loadingSubtitle}>
              Our AI is reviewing your technique.{'\n'}This usually takes 20–60 seconds.
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

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

  const strengths = analysis.strengths ?? [];
  const improvements = analysis.improvements ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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
        {/* Annotated video — null-guarded */}
        {!!resultVideoUrl && videoPlayable && (
          <View style={styles.videoSection}>
            <Text style={styles.videoLabel}>📹 Your Annotated Swing</Text>
            <Text style={styles.videoSubLabel}>Slow motion with coaching cues</Text>
            <Video
              source={{ uri: resultVideoUrl }}
              style={styles.swingVideo}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={false}
              isLooping={false}
              onError={(videoErr) => {
                logger.error(TAG, 'Result video failed to load', {
                  result_video_url: resultVideoUrl,
                  error: videoErr,
                });
                setVideoPlayable(false);
              }}
            />
          </View>
        )}

        {!!resultVideoUrl && !videoPlayable && (
          <View style={styles.feedbackCard}>
            <Text style={styles.cardTitle}>Video Unavailable</Text>
            <Text style={styles.feedbackBody}>
              We could not load the annotated video on this device. Your analysis text is still available below.
            </Text>
          </View>
        )}

        {!resultVideoUrl && (
          <View style={styles.feedbackCard}>
            <Text style={styles.cardTitle}>Annotated Video Not Ready</Text>
            <Text style={styles.feedbackBody}>
              Your analysis is complete, but no annotated result video URL is available yet.
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, videoRefreshLoading && { opacity: 0.6 }]}
              onPress={refreshResultVideo}
              disabled={videoRefreshLoading}
            >
              <Text style={styles.retryButtonText}>{videoRefreshLoading ? 'Checking...' : 'Check Again'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Raw analysis text */}
        {!!analysis.feedback && (
          <View style={styles.feedbackCard}>
            <Text style={styles.cardTitle}>📋 Raw Analysis</Text>
            <Text style={styles.feedbackBody}>{analysis.feedback}</Text>
          </View>
        )}

        {/* Strengths */}
        {strengths.length > 0 && (
          <View style={styles.feedbackCard}>
            <Text style={styles.cardTitle}>Strengths 💪</Text>
            {strengths.map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Areas to Improve */}
        {improvements.length > 0 && (
          <View style={styles.feedbackCard}>
            <Text style={styles.cardTitle}>Areas to Improve 🎯</Text>
            {improvements.map((item, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Empty state if nothing to show */}
        {!analysis.feedback && strengths.length === 0 && improvements.length === 0 && (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackBody}>
              Analysis complete. Detailed feedback will appear here once available.
            </Text>
          </View>
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
    width: 44,
  },
  topBarTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  shareButton: {
    padding: 8,
    width: 44,
    alignItems: 'flex-end',
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  errorText: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  retryButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  feedbackCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feedbackBody: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 23,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bullet: {
    color: COLORS.accent,
    fontSize: 16,
    marginRight: 8,
    lineHeight: 23,
  },
  bulletText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 23,
    flex: 1,
  },
  analyzeAnotherButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  analyzeAnotherText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
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
  shareButtonBottomText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  videoSection: {
    marginBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  videoLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  videoSubLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
  },
  swingVideo: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    backgroundColor: '#000',
  },
});
