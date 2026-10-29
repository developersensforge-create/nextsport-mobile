import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { createCoachAssignment } from '../lib/api';
import { COLORS } from '../theme';

interface Props {
  visible: boolean;
  playerId: string;
  playerName: string;
  onClose: () => void;
  onSuccess: () => void;
}

function getDefaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AssignDrillModal({ visible, playerId, playerName, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reps, setReps] = useState('10');
  const [sets, setSets] = useState('3');
  const [dueDate, setDueDate] = useState(getDefaultDueDate());
  const [coachNote, setCoachNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setTitle('');
      setDescription('');
      setReps('10');
      setSets('3');
      setDueDate(getDefaultDueDate());
      setCoachNote('');
    }
  }, [visible]);

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Please fill in the drill name');
      return;
    }

    setSubmitting(true);
    try {
      await createCoachAssignment({
        player_id: playerId,
        title: trimmedTitle,
        description: description.trim() || undefined,
        drill_name: trimmedTitle,
        reps: reps ? parseInt(reps, 10) : undefined,
        sets: sets ? parseInt(sets, 10) : undefined,
        due_date: dueDate || undefined,
        coach_note: coachNote.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert('Assignment failed', err?.response?.data?.error ?? err?.message ?? 'Please try again');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Assign Drill to {playerName}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.form}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title */}
            <Text style={styles.label}>Drill Name *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Golf swing arm drill"
              placeholderTextColor={COLORS.muted}
            />

            {/* Description */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={description}
              onChangeText={setDescription}
              placeholder="Detailed training goals and key points..."
              placeholderTextColor={COLORS.muted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Reps / Sets */}
            <View style={styles.rowFields}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Reps</Text>
                <TextInput
                  style={styles.input}
                  value={reps}
                  onChangeText={setReps}
                  placeholder="10"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Sets</Text>
                <TextInput
                  style={styles.input}
                  value={sets}
                  onChangeText={setSets}
                  placeholder="3"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            {/* Due date */}
            <Text style={styles.label}>Due Date</Text>
            <TextInput
              style={styles.input}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.muted}
              keyboardType="numbers-and-punctuation"
            />

            {/* Coach note */}
            <Text style={styles.label}>Coach Note</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={coachNote}
              onChangeText={setCoachNote}
              placeholder="Special tips or encouragement for the athlete..."
              placeholderTextColor={COLORS.muted}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />

            {/* Spacer */}
            <View style={{ height: 12 }} />
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.btnCancel}
              onPress={onClose}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={styles.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnConfirm, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#000" style={{ marginRight: 6 }} />
                  <Text style={styles.btnConfirmText}>Assign</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  form: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  label: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    fontSize: 15,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  inputMulti: {
    minHeight: 72,
    paddingTop: 12,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  btnCancel: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  btnCancelText: {
    color: COLORS.muted,
    fontSize: 16,
    fontWeight: '600',
  },
  btnConfirm: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnConfirmText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
});
