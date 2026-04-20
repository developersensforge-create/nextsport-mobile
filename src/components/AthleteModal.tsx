import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { Athlete } from '../lib/api';

const AGE_GROUPS = ['8U', '10U', '12U', '14U', '16U', '18U', 'Adult'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const SPORTS = ['Baseball', 'Softball'];

interface AthleteFormData {
  name: string;
  age_group: string;
  level: string;
  sport: string;
}

interface AthleteModalProps {
  visible: boolean;
  athlete?: Athlete | null; // if provided, edit mode
  onSave: (data: AthleteFormData) => Promise<void>;
  onCancel: () => void;
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AthleteModal({
  visible,
  athlete,
  onSave,
  onCancel,
}: AthleteModalProps) {
  const isEdit = !!athlete;
  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState('Adult');
  const [level, setLevel] = useState('Beginner');
  const [sport, setSport] = useState('Baseball');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (visible) {
      setName(athlete?.name ?? '');
      setAgeGroup(athlete?.age_group ?? 'Adult');
      setLevel(athlete?.level ?? 'Beginner');
      setSport(athlete?.sport ?? 'Baseball');
      setNameError('');
      setSaving(false);
    }
  }, [visible, athlete]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Name is required');
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: trimmed, age_group: ageGroup, level, sport });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Title */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {isEdit ? 'Edit Athlete' : 'Add Athlete'}
            </Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Name */}
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={[styles.input, nameError ? styles.inputError : null]}
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (nameError) setNameError('');
              }}
              placeholder="e.g. Alex Johnson"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="words"
              returnKeyType="done"
            />
            {!!nameError && <Text style={styles.errorText}>{nameError}</Text>}

            {/* Age Group */}
            <Text style={styles.label}>Age Group</Text>
            <View style={styles.chipRow}>
              {AGE_GROUPS.map((ag) => (
                <Chip
                  key={ag}
                  label={ag}
                  selected={ageGroup === ag}
                  onPress={() => setAgeGroup(ag)}
                />
              ))}
            </View>

            {/* Level */}
            <Text style={styles.label}>Level</Text>
            <View style={styles.chipRow}>
              {LEVELS.map((lv) => (
                <Chip
                  key={lv}
                  label={lv}
                  selected={level === lv}
                  onPress={() => setLevel(lv)}
                />
              ))}
            </View>

            {/* Sport */}
            <Text style={styles.label}>Sport</Text>
            <View style={styles.chipRow}>
              {SPORTS.map((sp) => (
                <Chip
                  key={sp}
                  label={sp}
                  selected={sport === sp}
                  onPress={() => setSport(sp)}
                />
              ))}
            </View>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onCancel}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  label: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderColor: COLORS.accent,
  },
  chipText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: COLORS.accent,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelButtonText: {
    color: COLORS.muted,
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800',
  },
});
