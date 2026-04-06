import { useState, useEffect, useCallback, useRef } from 'react';
import { Profile, getProfile } from '../lib/api';
import { useAuth } from './useAuth';

interface ProfileState {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

export function useProfile() {
  const { session } = useAuth();
  const [state, setState] = useState<ProfileState>({
    profile: null,
    loading: true,
    error: null,
  });
  // Guard against duplicate simultaneous fetches (re-render storms)
  const fetchInFlight = useRef(false);

  const fetchProfile = useCallback(async () => {
    if (!session) {
      setState({ profile: null, loading: false, error: null });
      return;
    }
    // Skip if a fetch is already in progress
    if (fetchInFlight.current) return;
    fetchInFlight.current = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const profile = await getProfile();
      setState({ profile, loading: false, error: null });
    } catch (err: any) {
      setState({
        profile: null,
        loading: false,
        error: err?.message ?? 'Failed to load profile',
      });
    } finally {
      fetchInFlight.current = false;
    }
  }, [session]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { ...state, refetch: fetchProfile };
}
