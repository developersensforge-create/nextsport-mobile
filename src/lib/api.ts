import axios from 'axios';
import { supabase } from './supabase';

const BASE_URL = 'https://nextsport-ruizhi1201s-projects.vercel.app';

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  tokens_remaining: number;
  subscription_status: 'free' | 'premium';
  token_reset_date: string | null;
  referral_code: string | null;
}

export interface Analysis {
  id: string;
  created_at: string;
  score: number | null;
  feedback: string | null;
  audio_url: string | null;
  video_url: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export async function getProfile(): Promise<Profile> {
  const headers = await getAuthHeaders();
  const response = await axios.get(`${BASE_URL}/api/profile`, { headers });
  return response.data;
}

export async function getAnalyses(): Promise<Analysis[]> {
  const headers = await getAuthHeaders();
  const response = await axios.get(`${BASE_URL}/api/analyses`, { headers });
  return response.data;
}

export async function getAnalysis(id: string): Promise<Analysis> {
  const headers = await getAuthHeaders();
  const response = await axios.get(`${BASE_URL}/api/analyses/${id}`, { headers });
  return response.data;
}

export async function getReferral(): Promise<{ referral_code: string; referred_count: number }> {
  const headers = await getAuthHeaders();
  const response = await axios.get(`${BASE_URL}/api/referral`, { headers });
  return response.data;
}

export async function submitAnalysis(
  videoUri: string,
  videoMimeType: string = 'video/mp4',
  onProgress?: (progress: number) => void,
  durationSeconds?: number
): Promise<{ id: string; analysisId?: string }> {
  const headers = await getAuthHeaders();

  const formData = new FormData();
  formData.append('video', {
    uri: videoUri,
    type: videoMimeType,
    name: 'swing.mp4',
  } as any);

  // Always send duration so server can calculate token cost correctly
  formData.append('duration', String(durationSeconds ?? 15));

  const response = await axios.post(`${BASE_URL}/api/analyze`, formData, {
    headers: {
      ...headers,
      'Content-Type': 'multipart/form-data',
    },
    timeout: 120000, // 2 min timeout for AI processing
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = progressEvent.loaded / progressEvent.total;
        onProgress(Math.min(progress, 0.95));
      }
    },
  });

  return response.data;
}

export async function pollAnalysis(id: string, maxAttempts = 30): Promise<Analysis> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const analysis = await getAnalysis(id);
    if (analysis.status === 'completed' || analysis.status === 'failed') {
      return analysis;
    }
  }
  throw new Error('Analysis timed out');
}
