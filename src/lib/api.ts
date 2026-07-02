import axios from 'axios';
import { supabase } from './supabase';

const BASE_URL = 'https://nextsport-sensforge.vercel.app';

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

  // ── Step 1: Get a signed upload URL from the backend ──────────────────────
  // The backend expects videoPath (Supabase Storage path), not a raw video file.
  // We first request a signed upload URL, upload the video directly to Supabase
  // Storage, then call /api/analyze with the storage path.
  const uploadUrlResponse = await axios.post(
    `${BASE_URL}/api/analyze/upload-url`,
    { fileName: 'swing.mp4', contentType: videoMimeType },
    { headers, timeout: 15000 }
  );

  const { uploadUrl, filePath } = uploadUrlResponse.data as {
    uploadUrl: string;
    token: string;
    filePath: string;
  };

  // ── Step 2: Upload the video directly to Supabase Storage via signed URL ──
  // Use XMLHttpRequest for upload progress tracking (fetch doesn't support it).
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', videoMimeType);
    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        // Report up to 90% during upload — last 10% is for the AI call
        onProgress(Math.min((event.loaded / event.total) * 0.9, 0.9));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Upload network error'));

    // React Native XHR can send a local file URI as the body directly
    xhr.send({ uri: videoUri, type: videoMimeType, name: 'swing.mp4' } as any);
  });

  // Signal upload complete — now waiting for AI
  onProgress?.(0.95);

  // ── Step 3: Trigger AI analysis with the storage path ─────────────────────
  const response = await axios.post(
    `${BASE_URL}/api/analyze`,
    {
      videoPath: filePath,
      duration: durationSeconds ?? 15,
    },
    {
      headers: { ...headers, 'Content-Type': 'application/json' },
      timeout: 120000, // 2 min timeout for AI processing
    }
  );

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
