import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  InteractionManager,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { CameraType } from 'expo-camera/build/Camera.types';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
// Audio permission is handled by expo-camera during video recording
import { VideoView, useVideoPlayer } from 'expo-video';
import { submitAnalysis } from '../lib/api';
import { summarizeAnalysisForLog } from '../lib/analysisDebug';
import { logger } from '../lib/logger';
import LoadingOverlay from '../components/LoadingOverlay';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type RecordNavProp = StackNavigationProp<RootStackParamList, 'Record'>;
type RecordRouteProp = RouteProp<RootStackParamList, 'Record'>;

const TOKEN_COST = 10;

function getVideoFileExtension(uri: string, mimeType: string | null | undefined) {
  const normalizedMime = (mimeType ?? '').toLowerCase();
  if (normalizedMime.includes('quicktime')) return '.mov';
  if (normalizedMime.includes('3gpp')) return '.3gp';
  if (normalizedMime.includes('mp4')) return '.mp4';
  if (normalizedMime.includes('mpeg')) return '.mpeg';

  const extMatch = uri.match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
  return extMatch ? `.${extMatch[1].toLowerCase()}` : '.mp4';
}

async function materializeAndroidVideoForPreview(uri: string, mimeType: string | null | undefined) {
  const extension = getVideoFileExtension(uri, mimeType);
  const targetUri = `${FileSystem.cacheDirectory}picked-preview-${Date.now()}${extension}`;
  await FileSystem.copyAsync({ from: uri, to: targetUri });
  return targetUri;
}

function SelectedVideoPreview({
  url,
  onError,
}: {
  url: string;
  onError: () => void;
}) {
  const VideoViewComponent = VideoView as unknown as React.ComponentType<any>;
  const player = useVideoPlayer(url, (videoPlayer) => {
    videoPlayer.loop = false;
  });

  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ error }) => {
      if (error) {
        onError();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player, onError]);

  return (
    <VideoViewComponent
      player={player}
      style={styles.videoPreview}
      nativeControls
      contentFit="contain"
      surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
    />
  );
}

export default function RecordScreen() {
  const navigation = useNavigation<RecordNavProp>();
  const route = useRoute<RecordRouteProp>();
  const initialMode = route.params?.mode ?? 'record';

  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<'record' | 'upload'>(initialMode);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('back');
  const [isRecording, setIsRecording] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoMime, setVideoMime] = useState<string>('video/mp4');
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null);
  const [videoSizeBytes, setVideoSizeBytes] = useState<number | null>(null);
  const [previewPlayable, setPreviewPlayable] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle');
  const cameraRef = useRef<any>(null);
  const latestRef = useRef({
    mode: initialMode as 'record' | 'upload',
    hasVideoUri: false,
    uploading: false,
    uploadPhase: 'idle' as 'idle' | 'uploading' | 'processing' | 'done',
    uploadProgress: 0,
    isRecording: false,
  });

  const TAG = 'RecordScreen';
  const hasAutoPickedRef = React.useRef(false);

  // Auto-launch gallery picker when entering upload mode
  React.useEffect(() => {
    if (initialMode === 'upload' && !hasAutoPickedRef.current && !videoUri) {
      hasAutoPickedRef.current = true;
      // Small delay so screen renders first
      const t = setTimeout(() => pickVideo(), 300);
      return () => clearTimeout(t);
    }
  }, []);

  function formatBytes(bytes: number | null) {
    if (!bytes || bytes <= 0) return 'Unknown size';
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatDuration(ms: number | null) {
    if (!ms || ms <= 0) return 'Unknown duration';
    return `${(ms / 1000).toFixed(1)}s`;
  }

  useEffect(() => {
    latestRef.current = {
      mode,
      hasVideoUri: !!videoUri,
      uploading,
      uploadPhase,
      uploadProgress,
      isRecording,
    };
  }, [mode, videoUri, uploading, uploadPhase, uploadProgress, isRecording]);

  useEffect(() => {
    logger.info(TAG, 'mounted', {
      initialMode,
      hasVideoUri: !!videoUri,
    });
    return () => {
      logger.info(TAG, 'unmounted', latestRef.current);
    };
  }, []);

  useEffect(() => {
    logger.info(TAG, 'lifecycle: videoUri changed', {
      hasVideoUri: !!videoUri,
      uriPrefix: videoUri ? videoUri.slice(0, 80) : null,
    });
  }, [videoUri]);

  useEffect(() => {
    setPreviewPlayable(true);
  }, [videoUri]);

  useEffect(() => {
    logger.info(TAG, 'lifecycle: upload state changed', {
      uploading,
      uploadPhase,
      uploadProgress: Math.round(uploadProgress * 100),
    });
  }, [uploading, uploadPhase, uploadProgress]);

  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => {
      logger.info(TAG, 'nav event: focus');
    });
    const unsubBlur = navigation.addListener('blur', () => {
      logger.info(TAG, 'nav event: blur');
    });
    const unsubBeforeRemove = navigation.addListener('beforeRemove', (e: any) => {
      logger.info(TAG, 'nav event: beforeRemove', {
        actionType: e?.data?.action?.type,
      });
    });
    const unsubTransitionStart = navigation.addListener('transitionStart' as never, (e: any) => {
      logger.info(TAG, 'nav event: transitionStart', {
        closing: e?.data?.closing,
      });
    });
    const unsubTransitionEnd = navigation.addListener('transitionEnd' as never, (e: any) => {
      logger.info(TAG, 'nav event: transitionEnd', {
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
  }, [navigation]);

  const requestCameraPermission = useCallback(async () => {
    logger.info(TAG, 'requestCameraPermission: requesting camera permission');
    const result = await requestPermission();
    logger.info(TAG, `requestCameraPermission: granted=${result.granted}`);
    if (!result.granted) {
      logger.warn(TAG, 'requestCameraPermission: permission DENIED by user');
      Alert.alert(
        'Camera Permission Required',
        'Please allow camera access in Settings to record your swing.',
        [{ text: 'OK' }]
      );
    }
  }, [requestPermission]);

  async function startRecording() {
    if (!cameraRef.current) {
      logger.warn(TAG, 'startRecording: cameraRef is null — camera not ready');
      return;
    }

    // Microphone permission is handled automatically by expo-camera when recording video

    setIsRecording(true);
    logger.info(TAG, 'startRecording: calling cameraRef.recordAsync()', { maxDuration: 30 });
    try {
      const video = await cameraRef.current.recordAsync({ maxDuration: 30 });
      logger.info(TAG, 'startRecording: recording completed', { uri: video.uri });
      setVideoUri(video.uri);
      setVideoDurationMs(null);
      try {
        const info = await FileSystem.getInfoAsync(video.uri);
        setVideoSizeBytes((info as any)?.size ?? null);
      } catch {
        setVideoSizeBytes(null);
      }
    } catch (err: any) {
      logger.error(TAG, 'startRecording: recordAsync threw an error', err);
      Alert.alert('Recording failed', 'Could not record video. Try uploading from your gallery instead.');
      setMode('upload');
    } finally {
      setIsRecording(false);
    }
  }

  function stopRecording() {
    logger.info(TAG, 'stopRecording: stopping camera recording');
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
    }
  }

  async function pickVideo() {
    logger.info(TAG, 'pickVideo: launching image library picker');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
      legacy: Platform.OS === 'android',
    });

    if (result.canceled) {
      logger.info(TAG, 'pickVideo: user cancelled picker');
      return;
    }

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      let resolvedUri = asset.uri;

      if (Platform.OS === 'android') {
        try {
          resolvedUri = await materializeAndroidVideoForPreview(asset.uri, asset.mimeType);
          logger.info(TAG, 'pickVideo: copied Android video into app cache for preview', {
            sourceUriPrefix: asset.uri.slice(0, 80),
            resolvedUriPrefix: resolvedUri.slice(0, 80),
          });
        } catch (copyErr) {
          logger.warn(TAG, 'pickVideo: failed to copy Android video into app cache, falling back to picker URI', {
            sourceUriPrefix: asset.uri.slice(0, 80),
            error: copyErr,
          });
        }
      }

      let resolvedSizeBytes = (asset as any).fileSize ?? null;
      if (!resolvedSizeBytes) {
        try {
          const info = await FileSystem.getInfoAsync(resolvedUri);
          resolvedSizeBytes = (info as any)?.size ?? null;
        } catch {
          resolvedSizeBytes = null;
        }
      }

      logger.info(TAG, 'pickVideo: video selected', {
        uri: asset.uri,
        uriScheme: typeof asset.uri === 'string' ? asset.uri.split(':')[0] : null,
        resolvedUri: resolvedUri,
        resolvedUriScheme: typeof resolvedUri === 'string' ? resolvedUri.split(':')[0] : null,
        mimeType: asset.mimeType,
        fileSize: resolvedSizeBytes,
        duration: asset.duration,
        width: asset.width,
        height: asset.height,
      });
      setVideoUri(resolvedUri);
      setVideoMime(asset.mimeType ?? 'video/mp4');
      setVideoDurationMs(asset.duration ?? null);
      setVideoSizeBytes(resolvedSizeBytes);
    }
  }

  async function handleAnalyze() {
    if (!videoUri) {
      logger.warn(TAG, 'handleAnalyze: called with no videoUri — ignoring');
      return;
    }

    logger.info(TAG, '=== handleAnalyze: START ===', { videoUri, videoMime });

    // Check file size before uploading (50MB limit for Vercel)
    try {
      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      logger.info(TAG, 'handleAnalyze: file info', fileInfo);
      if (fileInfo.exists && (fileInfo as any).size) {
        const sizeMB = ((fileInfo as any).size / (1024 * 1024)).toFixed(2);
        logger.info(TAG, `handleAnalyze: video size = ${sizeMB} MB`);
        if ((fileInfo as any).size > 50 * 1024 * 1024) {
          logger.warn(TAG, `handleAnalyze: video too large (${sizeMB} MB) — aborting`);
          Alert.alert(
            'Video Too Large',
            'Please use a video under 50MB. Try recording a shorter clip (under 30 seconds).',
            [{ text: 'OK' }]
          );
          return;
        }
      }
    } catch (sizeErr) {
      logger.warn(TAG, 'handleAnalyze: could not check file size — proceeding anyway', sizeErr);
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadPhase('uploading');

    try {
      logger.info(TAG, 'handleAnalyze: calling submitAnalysis()');
      const result = await submitAnalysis(videoUri, videoMime, (progress) => {
        // Cap at 95% during upload — the last 5% is server-side handoff
        setUploadProgress(Math.min(progress, 0.95));
      });

      logger.info(TAG, 'handleAnalyze: submitAnalysis() returned', {
        analysisId: result?.analysisId ?? result?.id ?? null,
        status: result?.status ?? null,
        strengthsLen: Array.isArray(result?.strengths) ? result.strengths.length : null,
        improvementsLen: Array.isArray(result?.improvements) ? result.improvements.length : null,
        hasRawAnalysis: typeof result?.raw_analysis === 'string' && result.raw_analysis.length > 0,
        hasResultVideoUrl: typeof result?.result_video_url === 'string' && result.result_video_url.trim().length > 0,
      });

      // Guard: if result.id is missing the server-side handoff failed
      const analysisId = result?.analysisId ?? result?.id;
      if (!analysisId) {
        logger.error(TAG, 'handleAnalyze: no analysisId in response — server handoff failed', result);
        setUploadPhase('idle');
        setUploading(false);
        Alert.alert('Analysis Failed', 'Analysis failed — please try again.', [{ text: 'OK' }]);
        return;
      }

      // Upload complete — switch to processing phase
      logger.info(TAG, `handleAnalyze: navigating to AnalysisResult, analysisId=${analysisId}, status=${result?.status}`);
      setUploadProgress(1);
      setUploadPhase('processing');
      const shouldPoll = result?.status !== 'completed';

      // Do not unmount/swap the preview Video in-place (that has native-crashed on some devices).
      // Defer replace so the stack transition tears down Record (and its player) in one step.
      await new Promise<void>((resolve) => {
        logger.info(TAG, 'handleAnalyze: waiting for InteractionManager before navigation');
        InteractionManager.runAfterInteractions(() => {
          logger.info(TAG, 'handleAnalyze: InteractionManager callback fired');
          requestAnimationFrame(() => {
            logger.info(TAG, 'handleAnalyze: first requestAnimationFrame fired');
            requestAnimationFrame(() => {
              logger.info(TAG, 'handleAnalyze: second requestAnimationFrame fired');
              try {
                if (!shouldPoll) {
                  const prefetchedAnalysis = {
                    id: analysisId,
                    status: 'completed' as const,
                    score: null,
                    feedback: result?.raw_analysis ?? null,
                    audio_url: null,
                    video_url: result?.result_video_url ?? null,
                    result_video_url: result?.result_video_url ?? null,
                    created_at: new Date().toISOString(),
                    strengths: result?.strengths ?? [],
                    improvements: result?.improvements ?? [],
                    recommended_drills: result?.recommended_drills ?? [],
                  };
                  logger.info(TAG, 'handleAnalyze: status=completed — passing prefetchedData via params', {
                    summary: summarizeAnalysisForLog(prefetchedAnalysis),
                  });
                  navigation.replace('AnalysisResult', {
                    analysisId,
                    poll: false,
                    prefetchedData: prefetchedAnalysis,
                  });
                } else {
                  logger.info(TAG, 'handleAnalyze: navigating with poll (no prefetch)', {
                    analysisId,
                    poll: shouldPoll,
                  });
                  navigation.replace('AnalysisResult', { analysisId, poll: shouldPoll });
                }
                logger.info(TAG, 'handleAnalyze: navigation.replace dispatched');
              } finally {
                resolve();
              }
            });
          });
        });
      });
    } catch (err: any) {
      setUploadPhase('idle');
      setUploading(false);

      // Structured error log — replaces the old console.log
      logger.error(TAG, 'handleAnalyze: submitAnalysis() THREW', {
        code: err?.code,
        message: err?.message,
        responseStatus: err?.response?.status,
        responseData: err?.response?.data,
        stack: err?.stack,
      });

      // Network timeout (axios timeout = 120s)
      if (err?.code === 'ECONNABORTED' || err?.message?.toLowerCase().includes('timeout')) {
        Alert.alert(
          'Request Timed Out',
          'The server took too long to respond. Please check your connection and try again.',
          [{ text: 'Try Again' }]
        );
        return;
      }

      // Server-side error response
      if (err?.response) {
        const serverMsg = err.response?.data?.error ?? err.response?.data?.message;
        Alert.alert(
          'Upload Failed',
          serverMsg ?? err?.message ?? 'Failed to upload video. Please try a shorter clip.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Generic fallback — show actual error message
      Alert.alert(
        'Upload Failed',
        err?.response?.data?.error || err?.message || 'Failed to upload video. Please try a shorter clip.',
        [{ text: 'OK' }]
      );
    } finally {
      // Always dismiss loading overlay
      setUploading(false);
    }
  }

  function resetVideo() {
    setVideoUri(null);
    setVideoDurationMs(null);
    setVideoSizeBytes(null);
    setPreviewPlayable(true);
    setUploadProgress(0);
  }

  async function openSystemPreview() {
    if (!videoUri) return;
    logger.info(TAG, 'openSystemPreview: opening external player', {
      uriPrefix: videoUri.slice(0, 80),
    });
    try {
      if (Platform.OS === 'android') {
        const intentUri = videoUri.startsWith('file://')
          ? await FileSystem.getContentUriAsync(videoUri)
          : videoUri;
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: intentUri,
          type: videoMime || 'video/*',
          flags: 1,
        });
        return;
      }
      if (/^https?:\/\//i.test(videoUri)) {
        const canOpen = await Linking.canOpenURL(videoUri);
        if (canOpen) {
          await Linking.openURL(videoUri);
          return;
        }
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(videoUri, {
          mimeType: videoMime || 'video/*',
          dialogTitle: 'Open video preview',
        });
        return;
      }
      Alert.alert('Preview unavailable', 'No compatible video app is available on this device.');
    } catch (err) {
      logger.warn(TAG, 'openSystemPreview: failed to open external player', err);
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(videoUri, {
            mimeType: videoMime || 'video/*',
            dialogTitle: 'Open video preview',
          });
          return;
        }
      } catch (shareErr) {
        logger.warn(TAG, 'openSystemPreview: sharing fallback also failed', shareErr);
      }
      Alert.alert('Preview unavailable', 'Could not open video preview on this device.');
    }
  }

  // --- Video preview state ---
  if (videoUri) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingOverlay
          visible={uploading}
          message={
            uploadPhase === 'processing'
              ? 'Processing your swing…\n\nOur AI is analyzing your video.\nThis takes 20–40 seconds.'
              : `Uploading video… ${Math.round(uploadProgress * 100)}%\n\nPlease keep the app open.`
          }
        />
        <View style={styles.previewHeader}>
          <TouchableOpacity onPress={resetVideo} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Preview</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.videoPreviewContainer}>
          {previewPlayable ? (
            <SelectedVideoPreview
              url={videoUri}
              onError={() => {
                logger.error(TAG, 'Selected preview video failed to load', {
                  uriPrefix: videoUri.slice(0, 80),
                });
                setPreviewPlayable(false);
              }}
            />
          ) : (
            <View style={styles.videoPreviewPlaceholder}>
              <Ionicons name="warning-outline" size={44} color="rgba(255,255,255,0.8)" />
              <Text style={styles.previewHintTitle}>Preview unavailable in-app</Text>
              <Text style={styles.previewHintText}>
                This clip could not be previewed on this device. You can still open it externally or continue to
                analysis.
              </Text>
              <TouchableOpacity style={styles.previewOpenButton} onPress={openSystemPreview}>
                <Text style={styles.previewOpenButtonText}>Open Preview Externally</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.previewFooter}>
          <Text style={styles.previewFooterMetaText}>
            Selected: {formatDuration(videoDurationMs)} • {formatBytes(videoSizeBytes)}
          </Text>
          <View style={styles.tokenRow}>
            <Ionicons name="flash" size={16} color={COLORS.accent} />
            <Text style={styles.tokenText}>This analysis costs {TOKEN_COST} tokens</Text>
          </View>
          <TouchableOpacity
            style={[styles.analyzeButton, uploading && styles.buttonDisabled]}
            onPress={handleAnalyze}
            disabled={uploading}
            activeOpacity={0.85}
          >
            <Ionicons name="analytics" size={22} color="#000" style={{ marginRight: 10 }} />
            <Text style={styles.analyzeButtonText}>Analyze My Swing</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.retakeButton} onPress={resetVideo}>
            <Text style={styles.retakeButtonText}>
              {mode === 'upload' ? 'Choose Different Video' : 'Retake'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- Upload mode ---
  if (mode === 'upload') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.previewHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload Video</Text>
          <TouchableOpacity onPress={() => setMode('record')} style={styles.modeToggle}>
            <Text style={styles.modeToggleText}>Camera</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.uploadContainer}>
          <TouchableOpacity style={styles.uploadPickerButton} onPress={pickVideo} activeOpacity={0.8}>
            <Ionicons name="cloud-upload" size={56} color={COLORS.accent} />
            <Text style={styles.uploadTitle}>Select a Video</Text>
            <Text style={styles.uploadSubtitle}>MP4, MOV, or AVI · Max 200 MB</Text>
          </TouchableOpacity>

          <View style={styles.tokenRow}>
            <Ionicons name="flash" size={16} color={COLORS.accent} />
            <Text style={styles.tokenText}>This analysis costs {TOKEN_COST} tokens</Text>
          </View>

          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Tips for best results</Text>
            {[
              'Film from the side or slightly behind',
              'Ensure good lighting',
              'Capture the full swing motion',
              '5–30 seconds is ideal',
            ].map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <Ionicons name="checkmark-circle" size={14} color={COLORS.accent} />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- Camera mode ---
  if (!permission) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centeredContent}>
          <Text style={styles.permissionText}>Checking camera permissions…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centeredContent}>
          <Ionicons name="camera-outline" size={60} color={COLORS.muted} />
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionSubtitle}>
            NextSport needs camera access to record your swing videos.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.switchToUploadButton}
            onPress={() => setMode('upload')}
          >
            <Text style={styles.switchToUploadText}>Upload a video instead</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={cameraFacing}
        mode="video"
      >
        {/* Top controls */}
        <SafeAreaView style={styles.cameraTopBar} edges={['top']}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cameraBackButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.cameraTopRight}>
            {isRecording && (
              <View style={styles.recordingBadge}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>REC</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => setMode('upload')}
              style={styles.cameraTopButton}
            >
              <Ionicons name="folder-open-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Bottom controls */}
        <View style={styles.cameraBottomBar}>
          <TouchableOpacity
            onPress={() => setCameraFacing((f) => (f === 'back' ? 'front' : 'back'))}
            style={styles.flipButton}
          >
            <Ionicons name="camera-reverse-outline" size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shutterButton, isRecording && styles.shutterRecording]}
            onPress={isRecording ? stopRecording : startRecording}
            activeOpacity={0.8}
          >
            <View style={[styles.shutterInner, isRecording && styles.shutterInnerRecording]} />
          </TouchableOpacity>

          <View style={{ width: 60 }} />
        </View>

        {/* Hint */}
        {!isRecording && (
          <View style={styles.hintContainer}>
            <Text style={styles.hintText}>Tap the button to start recording</Text>
            <Text style={styles.hintSubText}>Max 30 seconds · {TOKEN_COST} tokens</Text>
          </View>
        )}
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  previewHeader: {
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
  headerTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  modeToggle: {
    padding: 8,
  },
  modeToggleText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  // Video preview
  videoPreviewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoPreview: {
    flex: 1,
  },
  videoPreviewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#000',
  },
  previewHintTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  previewHintText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
  previewMetaText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  previewFooterMetaText: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  previewOpenButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  previewOpenButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  previewFooter: {
    backgroundColor: COLORS.background,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  tokenText: {
    color: COLORS.muted,
    fontSize: 13,
    marginLeft: 6,
  },
  analyzeButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  analyzeButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  retakeButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  retakeButtonText: {
    color: COLORS.muted,
    fontSize: 15,
  },
  // Upload
  uploadContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  uploadPickerButton: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(34,197,94,0.3)',
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  uploadTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  uploadSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 6,
  },
  tipsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
  },
  tipsTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },
  tipText: {
    color: COLORS.muted,
    fontSize: 13,
    marginLeft: 8,
  },
  // Permission
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  permissionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center',
  },
  permissionSubtitle: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionText: {
    color: COLORS.muted,
    fontSize: 14,
  },
  permissionButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 24,
  },
  permissionButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  switchToUploadButton: {
    marginTop: 16,
    padding: 8,
  },
  switchToUploadText: {
    color: COLORS.accent,
    fontSize: 14,
  },
  // Camera
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cameraBackButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 22,
  },
  cameraTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.8)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 5,
  },
  recordingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  cameraTopButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 22,
  },
  cameraBottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  flipButton: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 30,
    marginRight: 32,
  },
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRecording: {
    borderColor: '#ef4444',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  shutterInnerRecording: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#ef4444',
  },
  hintContainer: {
    position: 'absolute',
    bottom: 130,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  hintSubText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 4,
  },
});
