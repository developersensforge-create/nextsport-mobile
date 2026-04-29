import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAthletes } from '../hooks/useAthletes';
import {
  TrainingFocus, STRUGGLE_LABELS, LEVEL_LABELS, COVERAGE_LABELS,
  StruggleKey, getTrainingFocus, saveTrainingFocus, defaultFocus, needsWeeklyCheckin,
} from '../lib/trainingFocus';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = StackNavigationProp<RootStackParamList>;

const STRUGGLES: StruggleKey[] = [
  'grounders', 'popups', 'swingmiss', 'weakcontact', 'outsidepitch', 'cantpull',
];

const STRUGGLE_BADGES: Partial<Record<StruggleKey, { label: string; color: string; bg: string }>> = {
  grounders: { label: 'Common', color: '#fbbf24', bg: 'rgba(245,158,11,0.15)' },
  popups: { label: 'Common', color: '#fbbf24', bg: 'rgba(245,158,11,0.15)' },
  swingmiss: { label: 'Common', color: '#fbbf24', bg: 'rgba(245,158,11,0.15)' },
  weakcontact: { label: 'Mechanics', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)' },
  outsidepitch: { label: 'Coverage', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)' },
  cantpull: { label: 'Mechanics', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)' },
};

export default function TrainingFocusScreen() {
  const navigation = useNavigation<Nav>();
  const { athletes, activeAthleteId, activeAthlete } = useAthletes();

  const [focus, setFocus] = useState<TrainingFocus | null>(null);
  const [isWeeklyMode, setIsWeeklyMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load existing focus for active athlete
  useEffect(() => {
    if (!activeAthleteId) return;
    getTrainingFocus(activeAthleteId).then(existing => {
      const weekly = needsWeeklyCheckin(existing);
      setIsWeeklyMode(!!existing && weekly);
      setFocus(existing || defaultFocus(activeAthleteId));
    });
  }, [activeAthleteId]);

  const update = useCallback((patch: Partial<TrainingFocus>) => {
    setFocus(prev => prev ? { ...prev, ...patch } : null);
  }, []);

  const toggleStruggle = (key: StruggleKey) => {
    if (!focus) return;
    const has = focus.struggles.includes(key);
    update({ struggles: has ? focus.struggles.filter(s => s !== key) : [...focus.struggles, key] });
  };

  const handleSave = async () => {
    if (!focus) return;
    setSaving(true);
    try {
      const saved: TrainingFocus = { ...focus, updatedAt: new Date().toISOString() };
      await saveTrainingFocus(saved);
      navigation.replace('MainTabs');
    } catch {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSame = async () => {
    if (!focus) return;
    // Just update timestamp without changing data
    const saved: TrainingFocus = { ...focus, updatedAt: new Date().toISOString() };
    await saveTrainingFocus(saved);
    navigation.replace('MainTabs');
  };

  if (!focus) return null;

  const firstName = activeAthlete?.name?.split(' ')[0] ?? 'your player';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{isWeeklyMode ? 'Weekly Check-in 📋' : 'Training Focus 🎯'}</Text>
            <Text style={styles.subtitle}>
              {isWeeklyMode
                ? `Week of ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${activeAthlete?.name ?? ''}`
                : 'Personalize your drill plan'}
            </Text>
          </View>
          <TouchableOpacity onPress={async () => {
            // Save default focus so weekly check-in timer starts (won't prompt again for 7 days)
            if (activeAthleteId) {
              const saved = { ...(focus || defaultFocus(activeAthleteId)), updatedAt: new Date().toISOString() };
              await saveTrainingFocus(saved);
            }
            navigation.replace('MainTabs');
          }}>
            <Text style={styles.skip}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Weekly confirm banner */}
        {isWeeklyMode && (
          <TouchableOpacity style={styles.confirmBanner} onPress={handleConfirmSame} activeOpacity={0.8}>
            <View style={styles.confirmLeft}>
              <Text style={styles.confirmIcon}>✅</Text>
              <View>
                <Text style={styles.confirmTitle}>Nothing changed this week?</Text>
                <Text style={styles.confirmSub}>Tap to confirm and get your drill plan</Text>
              </View>
            </View>
            <View style={styles.confirmBtn}>
              <Text style={styles.confirmBtnText}>Confirm →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Player selector */}
        <View style={styles.section}>
          <View style={styles.playerCard}>
            <View style={[styles.avatar, { backgroundColor: '#f97316' }]}>
              <Text style={styles.avatarText}>{(activeAthlete?.name ?? 'A')[0].toUpperCase()}</Text>
            </View>
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>
                {activeAthlete?.name ?? 'Select player'}
                {activeAthlete && <Text style={styles.activeBadge}> Active</Text>}
              </Text>
              <Text style={styles.playerMeta}>
                {[activeAthlete?.age_group, activeAthlete?.level, activeAthlete?.sport].filter(Boolean).join(' · ') || 'No profile set'}
              </Text>
            </View>
            <Text style={styles.chevron}>▾</Text>
          </View>
        </View>

        {/* Performance sliders */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Performance vs. Peers</Text>
          <View style={styles.card}>
            <SliderRow
              label="⚡ Contact Quality"
              value={focus.contactLevel}
              onChange={v => update({ contactLevel: v })}
            />
            <View style={styles.divider} />
            <SliderRow
              label="💪 Power / Bat Speed"
              value={focus.powerLevel}
              onChange={v => update({ powerLevel: v })}
            />
          </View>
        </View>

        {/* Struggles */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Common Struggles (select all)</Text>
          <View style={styles.card}>
            {STRUGGLES.map(key => {
              const selected = focus.struggles.includes(key);
              const badge = STRUGGLE_BADGES[key];
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.checkItem, selected && styles.checkItemSel]}
                  onPress={() => toggleStruggle(key)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.checkbox, selected && styles.checkboxSel]}>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={[styles.checkText, selected && styles.checkTextSel]}>
                    {STRUGGLE_LABELS[key]}
                  </Text>
                  {badge && (
                    <View style={[styles.checkBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.checkBadgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Plate coverage */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Plate Coverage</Text>
          <View style={styles.card}>
            {/* Handedness */}
            <View style={styles.handednessRow}>
              <Text style={styles.handLabel}>Batter stance</Text>
              <View style={styles.handToggle}>
                {(['R', 'L', 'S'] as const).map(h => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.handBtn, focus.handedness === h && styles.handBtnAct]}
                    onPress={() => update({ handedness: h })}
                  >
                    <Text style={[styles.handBtnText, focus.handedness === h && styles.handBtnTextAct]}>
                      {h === 'R' ? '⚾ RHB' : h === 'L' ? 'LHB' : 'Switch'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Zone + toggles */}
            <View style={styles.zoneRow}>
              <View style={styles.zoneLeft}>
                <Text style={styles.zoneTitle}>Strike Zone</Text>
                <View style={styles.zoneColLabels}>
                  <Text style={styles.zoneColLabel}>{focus.handedness === 'L' ? 'In' : 'Out'}</Text>
                  <Text style={styles.zoneColLabel}>Mid</Text>
                  <Text style={styles.zoneColLabel}>{focus.handedness === 'L' ? 'Out' : 'In'}</Text>
                </View>
                <View style={styles.zoneGrid}>
                  {getZoneCells(focus).map((cls, i) => (
                    <View key={i} style={[styles.zoneCell,
                      cls === 'hot' ? styles.zonehot : cls === 'mid' ? styles.zonemid : styles.zonecold
                    ]} />
                  ))}
                </View>
                <Text style={[styles.batterIcon, { textAlign: focus.handedness === 'L' ? 'left' : 'right' }]}>🧍</Text>
              </View>

              <View style={styles.coverageToggles}>
                {(['INSIDE', 'MIDDLE', 'OUTSIDE'] as const).map(zone => {
                  const field = `plateCoverage${zone.charAt(0) + zone.slice(1).toLowerCase()}` as keyof TrainingFocus;
                  const val = focus[field] as number;
                  return (
                    <View key={zone}>
                      <Text style={styles.covLabel}>{zone}</Text>
                      <View style={styles.covToggle}>
                        {(['Strong', 'Avg', 'Weak'] as const).map((lbl, idx) => {
                          const v = 2 - idx; // Strong=2, Avg=1, Weak=0
                          return (
                            <TouchableOpacity
                              key={lbl}
                              style={[styles.covOpt,
                                val === v && (lbl === 'Strong' ? styles.covOptStrong : lbl === 'Avg' ? styles.covOptAvg : styles.covOptWeak)
                              ]}
                              onPress={() => update({ [field]: v } as any)}
                            >
                              <Text style={[styles.covOptText, val === v && getCovTextStyle(lbl)]}>{lbl}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* Free text */}
        <View style={styles.section}>
          <Text style={styles.worryTitle}>What worries you most about {firstName}'s swing? 🤔</Text>
          <Text style={styles.worrySub}>In your own words — our AI reads this.</Text>
          <TextInput
            style={styles.notesInput}
            value={focus.notes}
            onChangeText={v => update({ notes: v })}
            placeholder={`"He always pulls off the ball before contact" or "Coach says he casts the bat" ...`}
            placeholderTextColor="#4b5563"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, saving && styles.ctaBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaBtnText}>
            {saving ? 'Saving…' : isWeeklyMode ? 'Save & Get Drill Plan →' : 'Get My Drill Plan →'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.ctaHint}>AI picks 3 targeted drills based on your inputs</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Slider sub-component ─────────────────────────────────────────────────────

function SliderRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <View style={styles.sliderValBadge}>
          <Text style={styles.sliderValText}>{LEVEL_LABELS[value]}</Text>
        </View>
      </View>
      <View style={styles.sliderTrack}>
        {[0, 1, 2, 3, 4].map(v => (
          <TouchableOpacity
            key={v}
            style={[styles.sliderSegment, v <= value && styles.sliderSegmentFill]}
            onPress={() => onChange(v)}
          />
        ))}
      </View>
      <View style={styles.sliderLabels}>
        {LEVEL_LABELS.map(l => <Text key={l} style={styles.sliderLabelTick}>{l.split(' ')[0]}</Text>)}
      </View>
    </View>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getZoneCells(focus: TrainingFocus): ('hot' | 'mid' | 'cold')[] {
  // RHB: Inside = right column. LHB: Inside = left column
  const inside = focus.plateCoverageInside;
  const middle = focus.plateCoverageMiddle;
  const outside = focus.plateCoverageOutside;
  const toColor = (v: number): 'hot' | 'mid' | 'cold' => v === 2 ? 'hot' : v === 1 ? 'mid' : 'cold';
  const inC = toColor(inside);
  const midC = toColor(middle);
  const outC = toColor(outside);
  // Columns: [left, mid, right]
  // RHB: left=out, mid=mid, right=in
  // LHB: left=in, mid=mid, right=out
  const [l, m, r] = focus.handedness === 'L' ? [inC, midC, outC] : [outC, midC, inC];
  return [l, m, r, l, m, r, l, m, r]; // 3 rows × 3 cols
}

function getCovTextStyle(lbl: string) {
  if (lbl === 'Strong') return { color: '#4ade80' };
  if (lbl === 'Avg') return { color: '#fbbf24' };
  return { color: '#f87171' };
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.muted, marginTop: 3 },
  skip: { color: COLORS.muted, fontSize: 14 },

  confirmBanner: {
    marginHorizontal: 16, marginBottom: 14, padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  confirmLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  confirmIcon: { fontSize: 16 },
  confirmTitle: { fontSize: 13, fontWeight: '700', color: '#4ade80' },
  confirmSub: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  confirmBtn: { backgroundColor: '#4ade80', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  confirmBtnText: { fontSize: 12, fontWeight: '800', color: '#0a0f1e' },

  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginVertical: 14 },

  playerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  activeBadge: { fontSize: 11, color: '#f97316', fontWeight: '600' },
  playerMeta: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  chevron: { fontSize: 16, color: COLORS.muted },

  // Slider
  sliderRow: { marginBottom: 4 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sliderLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  sliderValBadge: { backgroundColor: 'rgba(249,115,22,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  sliderValText: { fontSize: 12, fontWeight: '700', color: '#f97316' },
  sliderTrack: { flexDirection: 'row', gap: 4, marginBottom: 6 },
  sliderSegment: {
    flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sliderSegmentFill: { backgroundColor: '#f97316' },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabelTick: { fontSize: 10, color: '#4b5563' },

  // Struggles
  checkItem: {
    flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11,
    borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 6,
  },
  checkItemSel: { backgroundColor: 'rgba(249,115,22,0.1)', borderColor: 'rgba(249,115,22,0.35)' },
  checkbox: { width: 19, height: 19, borderRadius: 5, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  checkboxSel: { backgroundColor: '#f97316', borderColor: '#f97316' },
  checkmark: { fontSize: 11, color: '#fff', fontWeight: '700' },
  checkText: { fontSize: 13, fontWeight: '500', color: COLORS.text, flex: 1 },
  checkTextSel: { color: '#fb923c' },
  checkBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  checkBadgeText: { fontSize: 10, fontWeight: '700' },

  // Handedness
  handednessRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  handLabel: { fontSize: 13, color: COLORS.muted },
  handToggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 2, gap: 2 },
  handBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  handBtnAct: { backgroundColor: '#f97316' },
  handBtnText: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  handBtnTextAct: { color: '#fff' },

  // Zone
  zoneRow: { flexDirection: 'row', gap: 14 },
  zoneLeft: { width: 90, flexShrink: 0 },
  zoneTitle: { fontSize: 9, color: COLORS.muted, textAlign: 'center', marginBottom: 4 },
  zoneColLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  zoneColLabel: { fontSize: 9, color: COLORS.muted },
  zoneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, width: 90 },
  zoneCell: { width: 26, height: 26, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  zonehot: { backgroundColor: 'rgba(34,197,94,0.25)', borderColor: 'rgba(34,197,94,0.4)' },
  zonemid: { backgroundColor: 'rgba(245,158,11,0.2)', borderColor: 'rgba(245,158,11,0.3)' },
  zonecold: { backgroundColor: 'rgba(239,68,68,0.25)', borderColor: 'rgba(239,68,68,0.4)' },
  batterIcon: { fontSize: 14, width: 90, marginTop: 4 },

  // Coverage toggles
  coverageToggles: { flex: 1, gap: 10 },
  covLabel: { fontSize: 10, color: COLORS.muted, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase' as const },
  covToggle: { flexDirection: 'row', borderRadius: 7, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  covOpt: { flex: 1, paddingVertical: 8, alignItems: 'center' as const, justifyContent: 'center' as const },
  covOptStrong: { backgroundColor: 'rgba(34,197,94,0.15)' },
  covOptAvg: { backgroundColor: 'rgba(245,158,11,0.15)' },
  covOptWeak: { backgroundColor: 'rgba(239,68,68,0.15)' },
  covOptText: { fontSize: 10, fontWeight: '700', color: COLORS.muted },

  // Notes
  worryTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  worrySub: { fontSize: 12, color: COLORS.muted, marginBottom: 10 },
  notesInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', borderRadius: 12,
    padding: 13, color: COLORS.text, fontSize: 13, minHeight: 80,
    textAlignVertical: 'top' as const, lineHeight: 20,
  },

  // CTA
  ctaBtn: {
    marginHorizontal: 16, padding: 15, borderRadius: 14, alignItems: 'center' as const,
    backgroundColor: '#f97316', marginTop: 8,
  },
  ctaBtnDisabled: { opacity: 0.6 },
  ctaBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  ctaHint: { textAlign: 'center' as const, color: COLORS.muted, fontSize: 12, marginTop: 8 },
});
