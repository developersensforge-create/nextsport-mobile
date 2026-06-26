import { useState, useEffect, useCallback } from 'react';
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

  const fetchProfile = useCallback(async () => {
    if (!session) {
      setState({ profile: null, loading: false, error: null });
      return;
    }
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
    }
  }, [session]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { ...state, refetch: fetchProfile };
}
