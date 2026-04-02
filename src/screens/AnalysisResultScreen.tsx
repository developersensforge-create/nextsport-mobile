import React, { useState, useEffect, useRef } from 'react';
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
import { Audio, Video, ResizeMode } from 'expo-av';
import * as Sharing from 'expo-sharing';
import { getAnalysis, pollAnalysis, Analysis } from '../lib/api';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type ResultNavProp = StackNavigationProp<RootStackParamList, 'AnalysisResult'>;
type ResultRouteProp = RouteProp<RootStackParamList, 'AnalysisResult'>;

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

export default function AnalysisResultScreen() {
  const navigation = useNavigation<ResultNavProp>();
  const route = useRoute<ResultRouteProp>();
  const { analysisId, poll } = route.params;

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (poll) {
          const result = await pollAnalysis(analysisId);
          setAnalysis(result);
        } else {
          const result = await getAnalysis(analysisId);
          setAnalysis(result);
        }
      } catch (err: any) {
        setError(err.message ?? 'Failed to load analysis.');
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [analysisId, poll]);

  async function toggleAudio() {
    if (!analysis?.audio_url) return;

    if (sound) {
      if (isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
      return;
    }

    setAudioLoading(true);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: analysis.audio_url },
        { shouldPlay: true }
      );
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
      setSound(newSound);
      setIsPlaying(true);
    } catch (err: any) {
      Alert.alert('Audio Error', 'Could not play audio feedback.');
    } finally {
      setAudioLoading(false);
    }
  }

  async function handleShare() {
    if (!analysis) return;
    const scoreText = analysis.score ? `Score: ${analysis.score}/100` : '';
    const message = `🏈 My NextSport swing analysis is in!\n${scoreText}\n\nGet your own AI swing analysis at nextsport.vercel.app`;
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

  // Parse feedback sections
  const feedbackSections = parseFeedback(analysis.feedback);

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
        {/* Annotated video */}
        {analysis.result_video_url && (
          <View style={styles.videoSection}>
            <Text style={styles.videoLabel}>📹 Your Annotated Swing</Text>
            <Text style={styles.videoSubLabel}>Slow motion with coaching cues</Text>
            <Video
              source={{ uri: analysis.result_video_url }}
              style={styles.swingVideo}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={false}
              isLooping={false}
            />
          </View>
        )}

        {/* Score */}
        {analysis.score !== null && <ScoreGauge score={analysis.score} />}

        {/* Audio feedback */}
        {analysis.audio_url && (
          <TouchableOpacity
            style={styles.audioCard}
            onPress={toggleAudio}
            activeOpacity={0.85}
          >
            {audioLoading ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause-circle' : 'play-circle'}
                size={36}
                color={COLORS.accent}
              />
            )}
            <View style={styles.audioInfo}>
              <Text style={styles.audioTitle}>Audio Feedback</Text>
              <Text style={styles.audioSubtitle}>
                {isPlaying ? 'Playing…' : 'Tap to listen to your coaching feedback'}
              </Text>
            </View>
            <Ionicons name="volume-high" size={20} color={COLORS.muted} />
          </TouchableOpacity>
        )}

        {/* Feedback sections */}
        {feedbackSections.length > 0 ? (
          feedbackSections.map((section, i) => (
            <View key={i} style={styles.feedbackCard}>
              {section.title ? (
                <Text style={styles.feedbackTitle}>{section.title}</Text>
              ) : null}
              <Text style={styles.feedbackBody}>{section.body}</Text>
            </View>
          ))
        ) : analysis.feedback ? (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackBody}>{analysis.feedback}</Text>
          </View>
        ) : null}

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

function parseFeedback(feedback: string | null): Array<{ title?: string; body: string }> {
  if (!feedback) return [];

  // Try to detect sections with headers like "**Title:**" or "## Title"
  const headerRegex = /\*\*(.+?)\*\*[:\n]/g;
  const matches = [...feedback.matchAll(headerRegex)];

  if (matches.length === 0) {
    // No structured headers — split by double newlines into paragraphs
    const paragraphs = feedback.split(/\n\n+/).filter((p) => p.trim().length > 0);
    return paragraphs.map((p) => ({ body: p.trim() }));
  }

  const sections: Array<{ title?: string; body: string }> = [];
  let lastIndex = 0;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const matchIndex = match.index ?? 0;
    const title = match[1];

    const bodyStart = matchIndex + match[0].length;
    const bodyEnd = i + 1 < matches.length ? (matches[i + 1].index ?? feedback.length) : feedback.length;
    const body = feedback.slice(bodyStart, bodyEnd).trim();

    if (body) {
      sections.push({ title, body });
    }
  }

  return sections;
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
  audioCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
    marginBottom: 16,
  },
  audioInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  audioTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  audioSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 2,
  },
  feedbackCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  feedbackTitle: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feedbackBody: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 23,
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
