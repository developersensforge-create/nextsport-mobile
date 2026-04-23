import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import { COLORS } from '../theme';

interface VideoTrimSliderProps {
  duration: number; // total video duration in seconds
  startTime: number;
  endTime: number;
  onStartChange: (t: number) => void;
  onEndChange: (t: number) => void;
  minClip?: number; // minimum clip length in seconds (default 2)
}

const THUMB_SIZE = 24;
const TRACK_HEIGHT = 4;
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

  // Convert time → x position within track
  const timeToX = useCallback(
    (t: number) => (t / duration) * trackWidth.current,
    [duration]
  );

  // Convert x position → clamped time
  const xToTime = useCallback(
    (x: number) => Math.max(0, Math.min(duration, (x / trackWidth.current) * duration)),
    [duration]
  );

  // Start thumb pan
  const startX = useRef(0);
  const startPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startX.current = timeToX(startTime);
      },
      onPanResponderMove: (_e, gs) => {
        const newX = startX.current + gs.dx;
        let newTime = xToTime(newX);
        // Clamp: must be >= 0 and leave minClip before endTime
        newTime = Math.max(0, Math.min(newTime, endTime - minClip));
        onStartChange(parseFloat(newTime.toFixed(1)));
      },
    })
  ).current;

  // End thumb pan
  const endX = useRef(0);
  const endPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        endX.current = timeToX(endTime);
      },
      onPanResponderMove: (_e, gs) => {
        const newX = endX.current + gs.dx;
        let newTime = xToTime(newX);
        // Clamp: must be <= duration and minClip after startTime
        newTime = Math.min(duration, Math.max(newTime, startTime + minClip));
        onEndChange(parseFloat(newTime.toFixed(1)));
      },
    })
  ).current;

  const onTrackLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  const startPct = duration > 0 ? startTime / duration : 0;
  const endPct = duration > 0 ? endTime / duration : 1;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.labelText}>Trim: {formatSec(startTime)} → {formatSec(endTime)}</Text>
        <Text style={styles.durationText}>{formatSec(endTime - startTime)} selected</Text>
      </View>

      {/* Track area */}
      <View style={styles.trackWrapper} onLayout={onTrackLayout}>
        {/* Full track (grey) */}
        <View style={styles.track} />

        {/* Selected range (orange) */}
        <View
          style={[
            styles.selectedRange,
            {
              left: `${startPct * 100}%`,
              right: `${(1 - endPct) * 100}%`,
            },
          ]}
        />

        {/* Start thumb */}
        <View
          style={[styles.thumb, styles.thumbStart, { left: `${startPct * 100}%` }]}
          {...startPan.panHandlers}
        >
          <View style={styles.thumbInner} />
        </View>

        {/* End thumb */}
        <View
          style={[styles.thumb, styles.thumbEnd, { left: `${endPct * 100}%` }]}
          {...endPan.panHandlers}
        >
          <View style={styles.thumbInner} />
        </View>
      </View>

      <View style={styles.tickRow}>
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
    marginBottom: 10,
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
    height: THUMB_SIZE + 8,
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
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    // Center vertically on track
    marginTop: -(THUMB_SIZE / 2) + TRACK_HEIGHT / 2,
  },
  thumbStart: {
    marginLeft: -(THUMB_SIZE / 2),
  },
  thumbEnd: {
    marginLeft: -(THUMB_SIZE / 2),
  },
  thumbInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  tickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  tickText: {
    color: COLORS.muted,
    fontSize: 11,
  },
});
