import axios from 'axios';
import { supabase } from './supabase';
import { logger } from './logger';
import { summarizeAnalysisForLog } from './analysisDebug';

const TAG = 'API';
const BASE_URL = 'https://nextsport-ruizhi1201s-projects.vercel.app';

async function getAuthHeaders() {
  logger.info(TAG, 'getAuthHeaders: fetching active session');
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    logger.error(TAG, 'getAuthHeaders: supabase.auth.getSession() returned error', error);
    throw error;
  }
  if (!session?.access_token) {
    logger.warn(TAG, 'getAuthHeaders: no active session — user not authenticated');
    throw new Error('Not authenticated');
  }
  logger.info(TAG, 'getAuthHeaders: session found', {
    userId: session.user?.id,
    expiresAt: session.expires_at,
  });
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
  result_video_url: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  strengths: string[] | null;
  improvements: string[] | null;
  recommended_drills: string[] | null;
}

export interface SubmitAnalysisResponse {
  id?: string;
  analysisId?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  raw_analysis?: string | null;
  result_video_url?: string | null;
  strengths?: string[];
  improvements?: string[];
  recommended_drills?: string[];
}

export async function getProfile(): Promise<Profile> {
  logger.info(TAG, 'getProfile: requesting /api/profile');
  const headers = await getAuthHeaders();
  const response = await axios.get(`${BASE_URL}/api/profile`, { headers });
  // API returns { profile: {...}, user: {...} } — extract the nested profile object
  const profileData = response.data?.profile ?? response.data;
  logger.info(TAG, 'getProfile: received profile', {
    id: profileData?.id,
    tokens_remaining: profileData?.tokens_remaining,
    subscription_status: profileData?.subscription_status,
  });
  return profileData;
}

export async function getAnalyses(): Promise<Analysis[]> {
  logger.info(TAG, 'getAnalyses: requesting /api/analyses');
  const headers = await getAuthHeaders();
  const response = await axios.get(`${BASE_URL}/api/analyses`, { headers });
  logger.info(TAG, `getAnalyses: received ${response.data?.length ?? 0} analyses`);
  return response.data;
}

export async function getAnalysis(id: string): Promise<Analysis> {
  logger.info(TAG, `getAnalysis: requesting /api/analyses/${id}`);
  const headers = await getAuthHeaders();
  const response = await axios.get(`${BASE_URL}/api/analyses/${id}`, { headers });
  const a = response.data as Analysis;
  logger.info(TAG, `getAnalysis: id=${id} status=${a.status} score=${a.score}`, summarizeAnalysisForLog(a));
  return a;
}

export async function getReferral(): Promise<{ referral_code: string; referred_count: number }> {
  logger.info(TAG, 'getReferral: requesting /api/referral');
  const headers = await getAuthHeaders();
  const response = await axios.get(`${BASE_URL}/api/referral`, { headers });
  logger.info(TAG, 'getReferral: success', response.data);
  return response.data;
}

export async function submitAnalysis(
  videoUri: string,
  videoMimeType: string = 'video/mp4',
  onProgress?: (progress: number) => void,
  durationSeconds?: number
): Promise<SubmitAnalysisResponse> {
  logger.info(TAG, '=== submitAnalysis: START ===', {
    videoUri,
    videoMimeType,
    durationSeconds,
  });

  // ── Step 1: auth headers ────────────────────────────────────────────────
  logger.info(TAG, 'submitAnalysis [1/4]: acquiring auth headers');
  let headers: Record<string, string>;
  try {
    headers = await getAuthHeaders();
    logger.info(TAG, 'submitAnalysis [1/4]: auth headers acquired');
  } catch (err) {
    logger.error(TAG, 'submitAnalysis [1/4]: FAILED to acquire auth headers', err);
    throw err;
  }

  // ── Step 2: request signed upload URL ───────────────────────────────────
  onProgress?.(0.05);
  const fileName = `swing-${Date.now()}.mp4`;
  logger.info(TAG, 'submitAnalysis [2/4]: requesting signed upload URL', {
    fileName,
    contentType: videoMimeType,
    endpoint: `${BASE_URL}/api/analyze/upload-url`,
  });

  let uploadUrl: string;
  let filePath: string;
  try {
    const uploadUrlResp = await axios.post(
      `${BASE_URL}/api/analyze/upload-url`,
      { fileName, contentType: videoMimeType },
      { headers }
    );
    uploadUrl = uploadUrlResp.data.uploadUrl;
    filePath = uploadUrlResp.data.filePath;
    logger.info(TAG, 'submitAnalysis [2/4]: signed URL received', {
      filePath,
      uploadUrlPrefix: uploadUrl?.slice(0, 80),
    });
  } catch (err: any) {
    logger.error(TAG, 'submitAnalysis [2/4]: FAILED to get signed upload URL', {
      status: err?.response?.status,
      data: err?.response?.data,
      message: err?.message,
    });
    throw err;
  }

  // ── Step 3: upload video to Supabase Storage via XHR ────────────────────
  logger.info(TAG, 'submitAnalysis [3/4]: uploading video via XHR PUT');
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', videoMimeType);

    xhr.upload.onprogress = (event) => {
      if (event.total) {
        const pct = Math.round((event.loaded / event.total) * 100);
        logger.info(TAG, `submitAnalysis [3/4]: upload progress ${pct}%`, {
          loaded: event.loaded,
          total: event.total,
        });
        const progress = 0.1 + (event.loaded / event.total) * 0.85;
        onProgress?.(Math.min(progress, 0.95));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        logger.info(TAG, `submitAnalysis [3/4]: upload completed — XHR status ${xhr.status}`);
        resolve();
      } else {
        logger.error(TAG, `submitAnalysis [3/4]: upload FAILED — XHR status ${xhr.status}`, {
          responseText: xhr.responseText?.slice(0, 500),
        });
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = (e) => {
      logger.error(TAG, 'submitAnalysis [3/4]: XHR network error', {
        readyState: xhr.readyState,
        status: xhr.status,
      });
      reject(new Error('Network request failed during upload'));
    };

    xhr.ontimeout = () => {
      logger.error(TAG, 'submitAnalysis [3/4]: XHR timeout during upload');
      reject(new Error('Upload timed out'));
    };

    // Send the local file via blob reference (Android/iOS compatible)
    logger.info(TAG, 'submitAnalysis [3/4]: calling xhr.send()', { videoUri });
    xhr.send({ uri: videoUri, type: videoMimeType, name: 'swing.mp4' } as any);
  });

  onProgress?.(0.97);

  // ── Step 4: trigger server-side analysis ────────────────────────────────
  logger.info(TAG, 'submitAnalysis [4/4]: triggering server analysis', {
    endpoint: `${BASE_URL}/api/analyze`,
    videoPath: filePath,
    duration: durationSeconds ?? 15,
  });

  let analyzeResp;
  try {
    analyzeResp = await axios.post(
      `${BASE_URL}/api/analyze`,
      { videoPath: filePath, duration: durationSeconds ?? 15 },
      { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 120000 }
    );
    logger.info(TAG, 'submitAnalysis [4/4]: server analysis triggered', {
      status: analyzeResp.status,
      data: analyzeResp.data,
    });
  } catch (err: any) {
    logger.error(TAG, 'submitAnalysis [4/4]: FAILED to trigger server analysis', {
      code: err?.code,
      status: err?.response?.status,
      data: err?.response?.data,
      message: err?.message,
    });
    throw err;
  }

  logger.info(TAG, '=== submitAnalysis: DONE ===', analyzeResp.data);
  return analyzeResp.data;
}

export async function pollAnalysis(id: string, maxAttempts = 30): Promise<Analysis> {
  logger.info(TAG, `pollAnalysis: starting poll for id=${id} maxAttempts=${maxAttempts}`);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    logger.info(TAG, `pollAnalysis: attempt ${attempt + 1}/${maxAttempts} — waiting 2 s`);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    let analysis: Analysis;
    try {
      analysis = await getAnalysis(id);
    } catch (err) {
      logger.error(TAG, `pollAnalysis: attempt ${attempt + 1} — getAnalysis threw`, err);
      // Continue polling; transient network errors shouldn't abort
      continue;
    }

    logger.info(TAG, `pollAnalysis: attempt ${attempt + 1} — status=${analysis.status}`);
    if (analysis.status === 'completed' || analysis.status === 'failed') {
      logger.info(TAG, `pollAnalysis: DONE — final status=${analysis.status}`, {
        score: analysis.score,
        hasFeedback: !!analysis.feedback,
        hasAudio: !!analysis.audio_url,
        hasResultVideo: !!analysis.result_video_url,
        summary: summarizeAnalysisForLog(analysis),
      });
      return analysis;
    }
  }
  logger.error(TAG, `pollAnalysis: TIMED OUT after ${maxAttempts} attempts`);
  throw new Error('Analysis timed out');
}
