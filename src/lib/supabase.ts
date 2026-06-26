import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://kpahmlhkvmasyobwrewy.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwYWhtbGhrdm1hc3lvYndyZXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTg4OTEsImV4cCI6MjA5MDM5NDg5MX0.lO86m8Ivo8fSMFCGkAzY-36brJmcn8REde6WDNcGYko';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
