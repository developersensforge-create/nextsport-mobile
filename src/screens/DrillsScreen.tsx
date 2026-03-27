import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  Pressable,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import {
  DRILLS,
  TOPICS,
  TOPIC_ICONS,
  TOPIC_COLORS,
  LEVEL_COLORS,
  Drill,
  DrillLevel,
  DrillTopic,
} from '../data/drills';

export default function DrillsScreen() {
  const [selectedTopic, setSelectedTopic] = useState<DrillTopic>('Batting');
  const [selectedLevel, setSelectedLevel] = useState<DrillLevel | 'All'>('All');
  const [selectedDrill, setSelectedDrill] = useState<Drill | null>(null);

  const filtered = DRILLS.filter((d) => {
    const topicOk = d.topic === selectedTopic;
    const lvlOk = selectedLevel === 'All' || d.level === selectedLevel;
    return topicOk && lvlOk;
  });

  async function handleWatchVideo(url: string) {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Cannot open link', 'Please check your YouTube app is installed.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>At-Home Drills</Text>
        <Text style={styles.subtitle}>{filtered.length} drills • tap any to see how</Text>
      </View>

      {/* Topic tabs */}
      <View style={styles.topicRow}>
        {TOPICS.map((topic) => {
          const active = selectedTopic === topic;
          const color = TOPIC_COLORS[topic];
          return (
            <TouchableOpacity
              key={topic}
              style={[
                styles.topicTab,
                active && { backgroundColor: color + '22', borderColor: color },
              ]}
              onPress={() => setSelectedTopic(topic)}
              activeOpacity={0.78}
            >
              <Ionicons
                name={TOPIC_ICONS[topic] as any}
                size={16}
                color={active ? color : COLORS.muted}
              />
              <Text style={[styles.topicTabText, active && { color }]}>{topic}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Level filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {(['All', 'Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => (
          <TouchableOpacity
            key={lvl}
            style={[
              styles.levelChip,
              selectedLevel === lvl && (lvl === 'All'
                ? styles.levelChipActiveAll
                : { backgroundColor: LEVEL_COLORS[lvl as DrillLevel] + '22', borderColor: LEVEL_COLORS[lvl as DrillLevel] }),
            ]}
            onPress={() => setSelectedLevel(lvl)}
            activeOpacity={0.75}
          >
            {lvl !== 'All' && (
              <View style={[styles.levelDot, { backgroundColor: LEVEL_COLORS[lvl as DrillLevel] }]} />
            )}
            <Text style={[
              styles.levelChipText,
              selectedLevel === lvl && styles.levelChipTextActive,
            ]}>
              {lvl}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Drill list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="baseball-outline" size={48} color={COLORS.muted} />
            <Text style={styles.emptyText}>No drills match your filters</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => setSelectedDrill(item)}
            activeOpacity={0.82}
          >
            <View style={[styles.iconBox, { backgroundColor: TOPIC_COLORS[item.topic] + '18' }]}>
              <Ionicons name={item.icon as any} size={22} color={TOPIC_COLORS[item.topic]} />
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                <View style={[styles.levelBadge, { borderColor: LEVEL_COLORS[item.level] }]}>
                  <Text style={[styles.levelBadgeText, { color: LEVEL_COLORS[item.level] }]}>
                    {item.level}
                  </Text>
                </View>
              </View>
              <View style={styles.cardMeta}>
                <Ionicons name="time-outline" size={12} color={COLORS.muted} />
                <Text style={styles.cardMetaText}>{item.duration}</Text>
                {item.equipment && (
                  <>
                    <Text style={styles.cardMetaDot}>·</Text>
                    <Ionicons name="construct-outline" size={12} color={COLORS.muted} />
                    <Text style={styles.cardMetaText} numberOfLines={1}>{item.equipment}</Text>
                  </>
                )}
                {item.referenceVideo && (
                  <>
                    <Text style={styles.cardMetaDot}>·</Text>
                    <Ionicons name="play-circle-outline" size={13} color={COLORS.accent} />
                    <Text style={[styles.cardMetaText, { color: COLORS.accent }]}>Video</Text>
                  </>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </TouchableOpacity>
        )}
      />

      {/* ── Drill Detail Modal ── */}
      <Modal
        visible={!!selectedDrill}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedDrill(null)}
      >
        {selectedDrill && (
          <View style={styles.modal}>
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
              {/* Modal top bar */}
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setSelectedDrill(null)} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={COLORS.text} />
                </Pressable>
                <View style={[styles.levelBadge, { borderColor: LEVEL_COLORS[selectedDrill.level] }]}>
                  <View style={[styles.levelDot, { backgroundColor: LEVEL_COLORS[selectedDrill.level] }]} />
                  <Text style={[styles.levelBadgeText, { color: LEVEL_COLORS[selectedDrill.level] }]}>
                    {selectedDrill.level}
                  </Text>
                </View>
              </View>

              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                {/* Title block */}
                <View style={styles.modalTitleRow}>
                  <View style={[styles.modalIconBox, { backgroundColor: TOPIC_COLORS[selectedDrill.topic] + '20' }]}>
                    <Ionicons name={selectedDrill.icon as any} size={32} color={TOPIC_COLORS[selectedDrill.topic]} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.modalTitle}>{selectedDrill.title}</Text>
                    <View style={styles.modalTopicBadge}>
                      <View style={[styles.topicDot, { backgroundColor: TOPIC_COLORS[selectedDrill.topic] }]} />
                      <Text style={[styles.modalTopicText, { color: TOPIC_COLORS[selectedDrill.topic] }]}>
                        {selectedDrill.topic}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Meta row */}
                <View style={styles.modalMetaRow}>
                  <View style={styles.modalMetaItem}>
                    <Ionicons name="time-outline" size={20} color={COLORS.accent} />
                    <Text style={styles.modalMetaValue}>{selectedDrill.duration}</Text>
                    <Text style={styles.modalMetaLabel}>Duration</Text>
                  </View>
                  <View style={styles.modalMetaDivider} />
                  <View style={styles.modalMetaItem}>
                    <Ionicons name="repeat-outline" size={20} color={COLORS.accent} />
                    <Text style={[styles.modalMetaValue, { textAlign: 'center' }]} numberOfLines={2}>{selectedDrill.reps}</Text>
                    <Text style={styles.modalMetaLabel}>Sets / Reps</Text>
                  </View>
                  {selectedDrill.equipment && (
                    <>
                      <View style={styles.modalMetaDivider} />
                      <View style={styles.modalMetaItem}>
                        <Ionicons name="construct-outline" size={20} color={COLORS.accent} />
                        <Text style={[styles.modalMetaValue, { textAlign: 'center', fontSize: 11 }]} numberOfLines={2}>{selectedDrill.equipment}</Text>
                        <Text style={styles.modalMetaLabel}>Equipment</Text>
                      </View>
                    </>
                  )}
                </View>

                {/* Description */}
                <Text style={styles.sectionLabel}>Overview</Text>
                <Text style={styles.descriptionText}>{selectedDrill.description}</Text>

                {/* Steps */}
                <Text style={styles.sectionLabel}>How To Do It</Text>
                {selectedDrill.steps.map((step, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}

                {/* Coach tip */}
                <View style={styles.tipCard}>
                  <Ionicons name="bulb-outline" size={20} color="#f59e0b" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.tipLabel}>Coach's Tip</Text>
                    <Text style={styles.tipText}>{selectedDrill.coachTip}</Text>
                  </View>
                </View>

                {/* Reference Video button */}
                {selectedDrill.referenceVideo && (
                  <View style={styles.videoSection}>
                    <Text style={styles.sectionLabel}>Reference Video</Text>
                    <View style={styles.videoCard}>
                      <View style={styles.videoInfo}>
                        <Ionicons name="logo-youtube" size={22} color="#ff0000" />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.videoTitle} numberOfLines={2}>
                            {selectedDrill.referenceVideo.title}
                          </Text>
                          <Text style={styles.videoCreator}>
                            {selectedDrill.referenceVideo.creator}
                          </Text>
                          {selectedDrill.referenceVideo.note && (
                            <Text style={styles.videoNote}>
                              ⏱ {selectedDrill.referenceVideo.note}
                            </Text>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.watchBtn}
                        onPress={() => handleWatchVideo(selectedDrill.referenceVideo!.url)}
                        activeOpacity={0.82}
                      >
                        <Ionicons name="play" size={16} color="#000" />
                        <Text style={styles.watchBtnText}>Watch Now</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>
            </SafeAreaView>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { color: COLORS.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: COLORS.muted, fontSize: 13, marginTop: 2 },

  // Topic tabs
  topicRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  topicTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    gap: 5,
  },
  topicTabText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },

  // Level filter
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
    flexDirection: 'row',
  },
  levelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    gap: 5,
  },
  levelChipActiveAll: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  levelDot: { width: 7, height: 7, borderRadius: 4 },
  levelChipText: { color: COLORS.muted, fontSize: 13, fontWeight: '500' },
  levelChipTextActive: { color: COLORS.text, fontWeight: '700' },

  // Drill list
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 4 },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700', flex: 1 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap' },
  cardMetaText: { color: COLORS.muted, fontSize: 11 },
  cardMetaDot: { color: COLORS.muted, fontSize: 11, marginHorizontal: 2 },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  levelBadgeText: { fontSize: 10, fontWeight: '700' },
  emptyState: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { color: COLORS.muted, fontSize: 15 },

  // Modal
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  modalIconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { color: COLORS.text, fontSize: 22, fontWeight: '800', lineHeight: 28 },
  modalTopicBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 5 },
  topicDot: { width: 8, height: 8, borderRadius: 4 },
  modalTopicText: { fontSize: 13, fontWeight: '600' },
  modalMetaRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
  },
  modalMetaItem: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4 },
  modalMetaValue: { color: COLORS.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  modalMetaLabel: { color: COLORS.muted, fontSize: 11 },
  modalMetaDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  sectionLabel: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  descriptionText: { color: COLORS.muted, fontSize: 14, lineHeight: 22, marginBottom: 24 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: { color: COLORS.accent, fontSize: 13, fontWeight: '700' },
  stepText: { flex: 1, color: COLORS.text, fontSize: 14, lineHeight: 22 },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    padding: 16,
    marginTop: 24,
    alignItems: 'flex-start',
  },
  tipLabel: { color: '#f59e0b', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  tipText: { color: COLORS.muted, fontSize: 14, lineHeight: 20 },

  // Video section
  videoSection: { marginTop: 28 },
  videoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 14,
  },
  videoInfo: { flexDirection: 'row', alignItems: 'flex-start' },
  videoTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  videoCreator: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  videoNote: { color: COLORS.accent, fontSize: 12, marginTop: 4, fontWeight: '500' },
  watchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  watchBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
});
