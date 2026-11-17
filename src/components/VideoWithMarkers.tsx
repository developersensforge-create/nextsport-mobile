import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { COLORS } from '../theme';

export interface MarkerAnnotation {
  time_sec: number;
  text: string;
}

export function formatClock(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface Props {
  videoUrl: string;
  annotations?: MarkerAnnotation[];
  /** 传入后显示「在此处批注」按钮，点击时回传播放器当前时间 */
  onAddAnnotation?: (timeSec: number) => void;
  addLabel?: string;
  headerTitle?: string;
}

/**
 * 可点击跳转的时间轴播放器。
 * ⚠️ 轨道比例用 player.duration（播放器真实时长），不用服务端上报值 —— 上报值不准会让标记整体偏移。
 */
export default function VideoWithMarkers({
  videoUrl,
  annotations = [],
  onAddAnnotation,
  addLabel = 'Add note at this point',
  headerTitle,
}: Props) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
  });

  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (player.duration > 0) {
      setDuration(player.duration);
    }
    const id = setInterval(() => {
      if (player.duration > 0) {
        setDuration(player.duration);
        clearInterval(id);
      }
    }, 400);
    return () => clearInterval(id);
  }, [player]);

  const seekTo = (t: number) => {
    const d = player.duration || duration;
    player.currentTime = Math.min(Math.max(t, 0), Math.max(d - 0.3, 0));
    player.play();
  };

  return (
    <View style={styles.wrap}>
      {headerTitle ? <Text style={styles.headerTitle}>{headerTitle}</Text> : null}

      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls
      />

      {duration > 0 && annotations.length > 0 && (
        <View style={styles.track}>
          {annotations.map((a, i) => (
            <TouchableOpacity
              key={`m-${i}`}
              style={[
                styles.marker,
                { left: `${Math.min(Math.max(a.time_sec / duration, 0), 1) * 100}%` },
              ]}
              onPress={() => seekTo(a.time_sec)}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
            />
          ))}
        </View>
      )}

      {onAddAnnotation ? (
        <TouchableOpacity
          style={styles.addBtn}
          activeOpacity={0.8}
          onPress={() => onAddAnnotation(player.currentTime ?? 0)}
        >
          <Ionicons name="add-circle-outline" size={16} color={COLORS.accent} />
          <Text style={styles.addBtnText}>{addLabel}</Text>
          <Text style={styles.addBtnTime}>{formatClock(player.currentTime ?? 0)}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  headerTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    borderRadius: 12,
  },
  track: {
    height: 10,
    marginTop: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center',
  },
  marker: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    backgroundColor: COLORS.accent,
    borderWidth: 2,
    borderColor: '#0a0f1e',
  },
  addBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.45)',
    backgroundColor: 'rgba(34,197,94,0.10)',
  },
  addBtnText: { color: COLORS.accent, fontSize: 13, fontWeight: '700', flex: 1 },
  addBtnTime: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
