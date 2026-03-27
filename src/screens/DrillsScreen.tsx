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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import {
  DRILLS,
  CATEGORIES,
  LEVEL_COLORS,
  Drill,
  DrillCategory,
  DrillLevel,
} from '../data/drills';

export default function DrillsScreen() {
  const [selectedCategory, setSelectedCategory] = useState<DrillCategory | 'All'>('All');
  const [selectedLevel, setSelectedLevel] = useState<DrillLevel | 'All'>('All');
  const [selectedDrill, setSelectedDrill] = useState<Drill | null>(null);

  const filtered = DRILLS.filter((d) => {
    const catOk = selectedCategory === 'All' || d.category === selectedCategory;
    const lvlOk = selectedLevel === 'All' || d.level === selectedLevel;
    return catOk && lvlOk;
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>At-Home Drills</Text>
        <Text style={styles.subtitle}>{filtered.length} drills available</Text>
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
              selectedLevel === lvl && styles.levelChipActive,
              lvl !== 'All' && selectedLevel === lvl && { backgroundColor: LEVEL_COLORS[lvl as DrillLevel] + '33', borderColor: LEVEL_COLORS[lvl as DrillLevel] },
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

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {(['All', ...CATEGORIES] as const).map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.catChip, selectedCategory === cat && styles.catChipActive]}
            onPress={() => setSelectedCategory(cat as DrillCategory | 'All')}
            activeOpacity={0.75}
          >
            <Text style={[styles.catChipText, selectedCategory === cat && styles.catChipTextActive]}>
              {cat}
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
            <View style={styles.cardLeft}>
              <View style={styles.iconBox}>
                <Ionicons name={item.icon as any} size={22} color={COLORS.accent} />
              </View>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={[styles.levelBadge, { borderColor: LEVEL_COLORS[item.level] }]}>
                  <Text style={[styles.levelBadgeText, { color: LEVEL_COLORS[item.level] }]}>
                    {item.level}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardCat}>{item.category}</Text>
              <View style={styles.cardMeta}>
                <Ionicons name="time-outline" size={12} color={COLORS.muted} />
                <Text style={styles.cardMetaText}>{item.duration}</Text>
                <Ionicons name="repeat-outline" size={12} color={COLORS.muted} style={{ marginLeft: 8 }} />
                <Text style={styles.cardMetaText}>{item.reps}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </TouchableOpacity>
        )}
      />

      {/* Drill Detail Modal */}
      <Modal
        visible={!!selectedDrill}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedDrill(null)}
      >
        {selectedDrill && (
          <View style={styles.modal}>
            <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
              {/* Modal header */}
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
                {/* Title section */}
                <View style={styles.modalIconRow}>
                  <View style={styles.modalIconBox}>
                    <Ionicons name={selectedDrill.icon as any} size={32} color={COLORS.accent} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={styles.modalTitle}>{selectedDrill.title}</Text>
                    <Text style={styles.modalCat}>{selectedDrill.category}</Text>
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
                    <Text style={styles.modalMetaValue}>{selectedDrill.reps}</Text>
                    <Text style={styles.modalMetaLabel}>Sets / Reps</Text>
                  </View>
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
  title: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 2,
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
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
  levelChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  levelDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  levelChipText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  levelChipTextActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  catChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  catChipText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  catChipTextActive: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 10,
  },
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
  cardLeft: {
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  cardCat: {
    color: COLORS.muted,
    fontSize: 12,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 3,
  },
  cardMetaText: {
    color: COLORS.muted,
    fontSize: 11,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  levelBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    gap: 12,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 15,
  },

  // Modal
  modal: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
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
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  modalIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  modalCat: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 3,
  },
  modalMetaRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
  },
  modalMetaItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 4,
  },
  modalMetaValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalMetaLabel: {
    color: COLORS.muted,
    fontSize: 11,
  },
  modalMetaDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  sectionLabel: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  descriptionText: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 22,
  },
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
  tipLabel: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  tipText: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
