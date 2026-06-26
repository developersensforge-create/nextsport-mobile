import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://czfwjtkntetqgodndhmc.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6ZndqdGtudGV0cWdvZG5kaG1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTg5MDMsImV4cCI6MjA4OTg5NDkwM30.XQv5-7a1GXV7OseXaFDlhH9dPg9nZZCGDcJNbRWaQ54';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
