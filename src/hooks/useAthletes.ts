import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Athlete,
  getAthletes,
  createAthlete,
  deleteAthlete as apiDeleteAthlete,
} from '../lib/api';
import { useProfile } from './useProfile';

const ACTIVE_ATHLETE_KEY = '@nextsport:activeAthleteId';

interface AthletesState {
  athletes: Athlete[];
  activeAthleteId: string | null;
  loading: boolean;
}

export function useAthletes() {
  const { profile } = useProfile();
  const [state, setState] = useState<AthletesState>({
    athletes: [],
    activeAthleteId: null,
    loading: true,
  });
  const fetchInFlight = useRef(false);

  const fetchAthletes = useCallback(async () => {
    if (fetchInFlight.current) return;
    fetchInFlight.current = true;
    try {
      let athletes = await getAthletes();

      // Auto-create a default athlete on first load if none exist
      if (athletes.length === 0) {
        const defaultName =
          profile?.full_name ?? 'Athlete 1';
        const created = await createAthlete({
          name: defaultName,
          age_group: undefined,
          level: undefined,
          sport: 'Baseball',
        });
        athletes = [created];
      }

      const storedId = await AsyncStorage.getItem(ACTIVE_ATHLETE_KEY);
      // Use stored id only if it still exists in the list
      const validId =
        storedId && athletes.find((a) => a.id === storedId)
          ? storedId
          : athletes[0]?.id ?? null;

      if (validId && validId !== storedId) {
        await AsyncStorage.setItem(ACTIVE_ATHLETE_KEY, validId);
      }

      setState({ athletes, activeAthleteId: validId, loading: false });
    } catch (err: any) {
      console.error('[useAthletes] fetchAthletes error:', err?.message || err);
      setState((prev) => ({ ...prev, loading: false }));
    } finally {
      fetchInFlight.current = false;
    }
  }, [profile]);

  useEffect(() => {
    fetchAthletes();
  }, [fetchAthletes]);

  const setActiveAthlete = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, activeAthleteId: id }));
    await AsyncStorage.setItem(ACTIVE_ATHLETE_KEY, id);
  }, []);

  const addAthlete = useCallback(
    async (data: { name: string; age_group?: string; level?: string; sport?: string }) => {
      const created = await createAthlete(data);
      setState((prev) => ({
        ...prev,
        athletes: [...prev.athletes, created],
        activeAthleteId: prev.activeAthleteId ?? created.id,
      }));
      return created;
    },
    [],
  );

  const removeAthlete = useCallback(async (id: string) => {
    await apiDeleteAthlete(id);
    setState((prev) => {
      const athletes = prev.athletes.filter((a) => a.id !== id);
      let activeAthleteId = prev.activeAthleteId;
      if (activeAthleteId === id) {
        activeAthleteId = athletes[0]?.id ?? null;
        if (activeAthleteId) {
          AsyncStorage.setItem(ACTIVE_ATHLETE_KEY, activeAthleteId);
        }
      }
      return { ...prev, athletes, activeAthleteId };
    });
  }, []);

  const activeAthlete =
    state.athletes.find((a) => a.id === state.activeAthleteId) ?? null;

  return {
    athletes: state.athletes,
    activeAthlete,
    activeAthleteId: state.activeAthleteId,
    loading: state.loading,
    setActiveAthlete,
    createAthlete: addAthlete,
    deleteAthlete: removeAthlete,
    refetch: fetchAthletes,
  };
}
