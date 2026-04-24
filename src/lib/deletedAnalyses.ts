import AsyncStorage from '@react-native-async-storage/async-storage';

const DELETED_IDS_KEY = 'nextsport_deleted_analysis_ids';

// Module-level tombstone — persists across re-renders and focus cycles
export const deletedAnalysisIds = new Set<string>();

// Load persisted IDs from storage on module init
AsyncStorage.getItem(DELETED_IDS_KEY).then(val => {
  if (val) {
    try {
      const ids: string[] = JSON.parse(val);
      ids.forEach(id => deletedAnalysisIds.add(id));
    } catch {}
  }
}).catch(() => {});

export async function persistDeletedId(id: string) {
  deletedAnalysisIds.add(id);
  try {
    await AsyncStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(deletedAnalysisIds)));
  } catch {}
}

export async function unpersistDeletedId(id: string) {
  deletedAnalysisIds.delete(id);
  try {
    await AsyncStorage.setItem(DELETED_IDS_KEY, JSON.stringify(Array.from(deletedAnalysisIds)));
  } catch {}
}
