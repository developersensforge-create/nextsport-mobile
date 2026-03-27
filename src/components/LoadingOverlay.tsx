import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { COLORS } from '../theme';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: number; // 0–1
}

export default function LoadingOverlay({ visible, message, progress }: LoadingOverlayProps) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          {message ? (
            <Text style={styles.message}>{message}</Text>
          ) : null}
          {progress !== undefined && progress > 0 && progress < 1 ? (
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${Math.min(progress * 100, 100)}%` }]} />
            </View>
          ) : null}
          <Text style={styles.doNotClose}>Keep the app open</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minWidth: 260,
    maxWidth: 300,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  message: {
    color: COLORS.text,
    fontSize: 15,
    marginTop: 16,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 3,
  },
  doNotClose: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 12,
  },
});
