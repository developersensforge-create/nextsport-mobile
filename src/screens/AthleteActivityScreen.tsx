import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { getAthleteAnalyses, Analysis } from '../lib/api';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Nav = StackNavigationProp<RootStackParamList, 'AthleteActivity'>;
type Rt = RouteProp<RootStackParamList, 'AthleteActivity'>;

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function calcAvgScore(scores: Record<string, number> | null): number | null {
  if (!scores) return null;
  const vals = Object.values(scores);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((sum, v) => sum + v, 0) / vals.length);
}

export default function AthleteActivityScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { playerId, playerName } = route.params;

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getAthleteAnalyses(playerId);
      setAnalyses(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [playerId]);

  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load]),
  );

  function renderItem({ item }: { item: Analysis }) {
    const avgScore = calcAvgScore(item.scores);
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() =>
          navigation.navigate('AnalysisResult', { analysisId: item.id })
        }
        activeOpacity={0.75}
      >
        <View style={styles.rowInfo}>
          <Text style={styles.rowDate}>{formatDate(item.created_at)}</Text>
          <Text style={styles.rowType}>
            {avgScore !== null ? `Swing · Score ${avgScore}` : 'Swing analysis'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header title="Activity" subtitle={playerName} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Header
        title="Activity"
        subtitle={`${playerName} · ${analyses.length} entries`}
        onBack={() => navigation.goBack()}
      />

      <FlatList
        data={analyses}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          analyses.length === 0 && styles.emptyContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={44} color={COLORS.muted} />
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptyHint}>
              Swing analyses will appear here once recorded.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function Header({ title, subtitle, onBack }: { title: string; subtitle: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} hitSlop={12}>
        <Ionicons name="chevron-back" size={24} color={COLORS.text} />
      </TouchableOpacity>
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  headerSub: { color: COLORS.muted, fontSize: 12, marginTop: 2 },

  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  emptyContent: { flex: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowInfo: { flex: 1 },
  rowDate: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  rowType: { color: COLORS.muted, fontSize: 12 },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700', marginTop: 16 },
  emptyHint: { color: COLORS.muted, fontSize: 13, textAlign: 'center', marginTop: 8 },
});