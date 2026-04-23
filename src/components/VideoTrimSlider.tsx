import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { COLORS } from '../theme';

interface VideoTrimSliderProps {
  duration: number;
  startTime: number;
  endTime: number;
  onStartChange: (t: number) => void;
  onEndChange: (t: number) => void;
  minClip?: number;
}

const THUMB_SIZE = 36;      // bigger = easier to grab
const TRACK_HEIGHT = 6;
const MIN_CLIP_DEFAULT = 2;

function formatSec(s: number) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, '0');
  return m > 0 ? `${m}:${sec}` : `${s.toFixed(1)}s`;
}

export default function VideoTrimSlider({
  duration,
  startTime,
  endTime,
  onStartChange,
  onEndChange,
  minClip = MIN_CLIP_DEFAULT,
}: VideoTrimSliderProps) {
  const trackWidth = useRef(0);

  // Refs so PanResponder closures always see latest values
  const onStartRef = useRef(onStartChange);
  const onEndRef = useRef(onEndChange);
  const startRef = useRef(startTime);
  const endRef = useRef(endTime);
  const durRef = useRef(duration);
  const minRef = useRef(minClip);

  useEffect(() => { onStartRef.current = onStartChange; }, [onStartChange]);
  useEffect(() => { onEndRef.current = onEndChange; }, [onEndChange]);
  useEffect(() => { startRef.current = startTime; }, [startTime]);
  useEffect(() => { endRef.current = endTime; }, [endTime]);
  useEffect(() => { durRef.current = duration; }, [duration]);
  useEffect(() => { minRef.current = minClip; }, [minClip]);

  const timeToX = (t: number) => (t / durRef.current) * trackWidth.current;
  const xToTime = (x: number) =>
    Math.max(0, Math.min(durRef.current, (x / trackWidth.current) * durRef.current));

  // ── Start thumb ──────────────────────────────────────────────────────────
  const startDragX = useRef(0);
  const startPan = useRef(
    PanResponder.create({
      // Capture immediately so ScrollView / card TouchableOpacity can't steal
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        startDragX.current = timeToX(startRef.current);
      },
      onPanResponderMove: (_e, gs) => {
        let t = xToTime(startDragX.current + gs.dx);
        t = Math.max(0, Math.min(t, endRef.current - minRef.current));
        onStartRef.current(parseFloat(t.toFixed(1)));
      },
    })
  ).current;

  // ── End thumb ────────────────────────────────────────────────────────────
  const endDragX = useRef(0);
  const endPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        endDragX.current = timeToX(endRef.current);
      },
      onPanResponderMove: (_e, gs) => {
        let t = xToTime(endDragX.current + gs.dx);
        t = Math.min(durRef.current, Math.max(t, startRef.current + minRef.current));
        onEndRef.current(parseFloat(t.toFixed(1)));
      },
    })
  ).current;

  const onTrackLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  const startPct = duration > 0 ? startTime / duration : 0;
  const endPct = duration > 0 ? endTime / duration : 1;

  return (
    // pointerEvents="box-none" lets touches pass through the wrapper but
    // the thumbs themselves capture their own touches
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.labelRow} pointerEvents="none">
        <Text style={styles.labelText}>
          Trim: {formatSec(startTime)} → {formatSec(endTime)}
        </Text>
        <Text style={styles.durationText}>{formatSec(endTime - startTime)} selected</Text>
      </View>

      {/* Track + thumbs */}
      <View style={styles.trackWrapper} onLayout={onTrackLayout} pointerEvents="box-none">
        {/* Background track */}
        <View style={styles.track} pointerEvents="none" />

        {/* Selected range */}
        <View
          style={[
            styles.selectedRange,
            { left: `${startPct * 100}%`, right: `${(1 - endPct) * 100}%` },
          ]}
          pointerEvents="none"
        />

        {/* Start thumb — large hit area */}
        <View
          style={[styles.thumbHitArea, { left: `${startPct * 100}%` }]}
          {...startPan.panHandlers}
        >
          <View style={styles.thumb}>
            <View style={styles.thumbBar} />
            <View style={styles.thumbBar} />
          </View>
        </View>

        {/* End thumb — large hit area */}
        <View
          style={[styles.thumbHitArea, { left: `${endPct * 100}%` }]}
          {...endPan.panHandlers}
        >
          <View style={styles.thumb}>
            <View style={styles.thumbBar} />
            <View style={styles.thumbBar} />
          </View>
        </View>
      </View>

      <View style={styles.tickRow} pointerEvents="none">
        <Text style={styles.tickText}>0s</Text>
        <Text style={styles.tickText}>{formatSec(duration / 2)}</Text>
        <Text style={styles.tickText}>{formatSec(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginHorizontal: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  labelText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  durationText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  trackWrapper: {
    height: THUMB_SIZE + 16,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  selectedRange: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: COLORS.accent,
  },
  // Large invisible hit area centered on the thumb position
  thumbHitArea: {
    position: 'absolute',
    width: THUMB_SIZE + 20,
    height: THUMB_SIZE + 20,
    marginLeft: -((THUMB_SIZE + 20) / 2),
    marginTop: -((THUMB_SIZE + 20) / 2 - TRACK_HEIGHT / 2),
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  thumbBar: {
    width: 2.5,
    height: 12,
    borderRadius: 2,
    backgroundColor: COLORS.accent,
  },
  tickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  tickText: {
    color: COLORS.muted,
    fontSize: 11,
  },
});
