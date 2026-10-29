import { useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Profile, getProfile } from '../lib/api';
import { setSharedIsCoach } from '../lib/coachState';

WebBrowser.maybeCompleteAuthSession();

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: Profile | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
    profile: null,
  });

  useEffect(() => {
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        let profile: Profile | null = null;
        if (session) {
          try {
profile = await getProfile();
          setSharedIsCoach(profile?.is_coach ?? false);
        } catch {
          // profile fetch failure is non-fatal
        }
      }
      setState({
        session,
        user: session?.user ?? null,
        loading: false,
        profile,
      });
    })
    .catch((err) => {
      console.error('[useAuth] getSession failed:', err);
      setState({ session: null, user: null, loading: false, profile: null });
    });

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (_event, session) => {
    let profile: Profile | null = null;
    if (session) {
      try {
        profile = await getProfile();
        setSharedIsCoach(profile?.is_coach ?? false);
        } catch {
          // profile fetch failure is non-fatal
        }
      }
      setState({
        session,
        user: session?.user ?? null,
        loading: false,
        profile,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    []
  );

  const signUpWithEmail = useCallback(async (email: string, password: string, referralCode?: string) => {
    // Use our backend API to create user with auto email confirmation (no verification email needed)
    const response = await fetch('https://nextsport-six.vercel.app/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, ...(referralCode ? { referralCode } : {}) }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Sign up failed');

    // Now sign in with the confirmed account
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = Linking.createURL('/auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    if (error) throw error;
    if (!data.url) throw new Error('No OAuth URL returned');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) {
      const url = new URL(result.url);
      const accessToken = url.searchParams.get('access_token');
      const refreshToken = url.searchParams.get('refresh_token');
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    // scope: 'local' — only clear local session, skip server revoke call
    // Prevents errors when token is already expired or invalid
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await getProfile();
      setState((prev) => ({ ...prev, profile }));
      setSharedIsCoach(profile?.is_coach ?? false);
    } catch {
      // profile fetch failure is non-fatal
    }
  }, []);

  const isCoach = state.profile?.is_coach ?? false;

  return {
    ...state,
    isCoach,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    refreshProfile,
  };
}
