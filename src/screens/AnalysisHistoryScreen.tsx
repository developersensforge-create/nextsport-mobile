import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { getAnalyses, deleteAnalysis, Analysis } from '../lib/api';
import { useAthletes } from '../hooks/useAthletes';
import AnalysisCard from '../components/AnalysisCard';
import { COLORS } from '../theme';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { deletedAnalysisIds as _deletedAnalysisIds, persistDeletedId } from '../lib/deletedAnalyses';

type HistoryNavProp = StackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 20;

export default function AnalysisHistoryScreen() {
  const navigation = useNavigation<HistoryNavProp>();
  const { activeAthleteId } = useAthletes();

  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const fetchInFlight = useRef(false);

  const fetchPage = useCallback(async (reset = false) => {
    if (fetchInFlight.current) return;
    fetchInFlight.current = true;
    const offset = reset ? 0 : offsetRef.current;
    try {
      const data = await getAnalyses(activeAthleteId ?? undefined, offset, PAGE_SIZE);
      const filtered = data.filter(a => !_deletedAnalysisIds.has(a.id));
      if (reset) {
        setAnalyses(filtered);
        offsetRef.current = filtered.length;
      } else {
        setAnalyses(prev => [...prev, ...filtered]);
        offsetRef.current = offset + filtered.length;
      }
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
      fetchInFlight.current = false;
    }
  }, [activeAthleteId]);

  React.useEffect(() => {
    fetchPage(true);
  }, [fetchPage]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchPage(true);
  }

  async function handleLoadMore() {
    if (!hasMore || loadingMore || fetchInFlight.current) return;
    setLoadingMore(true);
    await fetchPage(false);
  }

  async function handleDelete(id: string) {
    setAnalyses(prev => prev.filter(a => a.id !== id));
    try {
      await deleteAnalysis(id);
      await persistDeletedId(id);
    } catch {
      // Restore on failure
      await fetchPage(true);
      Alert.alert('Error', 'Failed to delete analysis. Please try again.');
    }
  }

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Analysis History</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : analyses.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="baseball-outline" size={48} color={COLORS.muted} />
          <Text style={styles.emptyText}>No analyses yet</Text>
        </View>
      ) : (
        <FlatList
          data={analyses}
          keyExtractor={a => a.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <AnalysisCard
              analysis={item}
              onPress={() => navigation.navigate('AnalysisResult', { analysisId: item.id })}
              onDelete={handleDelete}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.accent}
              colors={[COLORS.accent]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  list: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { color: COLORS.muted, fontSize: 15 },
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
});
