import axios from 'axios';
import { supabase } from './supabase';

const BASE_URL = 'https://nextsport-six.vercel.app';

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
  roles: string[];
  is_coach: boolean;
  // Coach relationship (player side)
  my_coach_id: string | null;
  my_coach_name: string | null;
  my_coach_relationship_id: string | null;
}

export interface Analysis {
  id: string;
  created_at: string;
  score: number | null;
  feedback: string | null;
  audio_url: string | null;
  video_url: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  strengths: string[];
  improvements: Array<{ fix?: string; [key: string]: string | undefined }>;
  recommended_drills: string[];
  scores: Record<string, number> | null;
  swing_result: string | null;
}

export async function getProfile(): Promise<Profile> {
  const headers = await getAuthHeaders();
  const response = await axios.get(`${BASE_URL}/api/profile`, { headers });
  return response.data;
}

export async function updateProfile(full_name: string): Promise<{ full_name: string }> {
  const headers = await getAuthHeaders();
  const response = await axios.patch(`${BASE_URL}/api/profile`, { full_name }, { headers });
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
    xhr.timeout = 300000; // 5 min timeout for large video uploads
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
    xhr.ontimeout = () => reject(new Error('Upload timed out — please check your connection and try again'));

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

export async function pollAnalysis(
  id: string,
  maxAttempts = 60,
  onProgress?: (attempt: number) => void,
): Promise<Analysis> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const analysis = await getAnalysis(id);
    if (analysis.status === 'completed' || analysis.status === 'failed') {
      return analysis;
    }
    onProgress?.(attempt + 1);
  }
  throw new Error('Analysis timed out');
}

// ─── AI Coach ────────────────────────────────────────────────────────────────

export interface Assignment {
  id: string;
  drill_id: string | null;
  drill_name: string;
  title: string;
  description: string | null;
  reps: number | null;
  sets: number | null;
  due_date: string | null;
  status: 'pending' | 'completed' | 'skipped';
  ai_summary: string | null;
  source: 'ai' | 'human';
  created_at: string;
  analysis_id: string | null;
  coach_name?: string | null;
}

/**
 * Silently trigger AI Coach to generate assignments after an analysis completes.
 * Never throws — failures are logged as warnings only so the caller is never blocked.
 */
export async function triggerAiCoachGenerate(analysisId: string): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    await axios.post(
      `${BASE_URL}/api/ai-coach/generate`,
      { analysis_id: analysisId },
      { headers, timeout: 30000 },
    );
  } catch (e) {
    // Intentionally silent — AI Coach generation is a background enhancement,
    // never block the user flow on its failure.
    console.warn('[AI Coach] generate failed (silent):', e);
  }
}

/**
 * Fetch current user's assignments.
 * @param status  'pending' | 'completed' | 'skipped' | 'all'  (default: 'pending')
 * @param playerId  Optional player ID for coaches to view a specific athlete's assignments
 */
export async function getAssignments(
  status: 'pending' | 'completed' | 'skipped' | 'all' = 'pending',
  playerId?: string,
): Promise<Assignment[]> {
  const headers = await getAuthHeaders();
  let url = `${BASE_URL}/api/ai-coach/assignments?status=${status}&limit=20`;
  if (playerId) {
    url += `&player_id=${playerId}`;
  }
  const response = await axios.get(url, { headers });
  return response.data.assignments ?? [];
}

/**
 * Mark an assignment as completed or skipped.
 */
export async function updateAssignmentStatus(
  id: string,
  status: 'completed' | 'skipped' | 'pending',
): Promise<void> {
  const headers = await getAuthHeaders();
  await axios.patch(
    `${BASE_URL}/api/ai-coach/assignments/${id}`,
    { status },
    { headers },
  );
}

// ─── Coach API ────────────────────────────────────────────────────────────────

export interface Athlete {
  relationship_id: string;
  player_id: string;
  player_name: string;
  age_group: string | null;
  sport: string | null;
  level: string | null;
  latest_analysis: string | null;
  pending_assignments_count: number;
}

export interface PendingInvite {
  id: string;
  invite_code: string;
  invite_expires_at: string;
  share_url: string;
}

export interface CoachAssignmentData {
  player_id: string;
  title: string;
  description?: string;
  drill_name?: string;
  reps?: number;
  sets?: number;
  due_date?: string;
  coach_note?: string;
}

/**
 * Enable or disable coach mode for the current user.
 */
export async function enableCoachMode(enabled: boolean): Promise<void> {
  const headers = await getAuthHeaders();
  await axios.patch(
    `${BASE_URL}/api/profile/coach-mode`,
    { enabled },
    { headers },
  );
}

/**
 * Create a new invite code for the coach to share with an athlete.
 */
export async function createInvite(): Promise<PendingInvite> {
  const headers = await getAuthHeaders();
  const response = await axios.post(`${BASE_URL}/api/coach/invite`, {}, { headers });
  return response.data;
}

/**
 * Accept a coach invite by code (athlete side).
 */
export async function acceptInvite(code: string): Promise<void> {
  const headers = await getAuthHeaders();
  await axios.post(
    `${BASE_URL}/api/coach/invite/accept`,
    { invite_code: code },
    { headers },
  );
}

/**
 * Preview an invite (get coach info before accepting).
 */
export async function getInvitePreview(code: string): Promise<{ coach_name: string; coach_id: string }> {
  const headers = await getAuthHeaders();
  const response = await axios.get(
    `${BASE_URL}/api/coach/invite/preview?code=${encodeURIComponent(code)}`,
    { headers },
  );
  return response.data;
}

/**
 * Get all athletes linked to the current coach.
 */
export async function getAthletes(): Promise<{ athletes: Athlete[]; pending_invites: PendingInvite[] }> {
  const headers = await getAuthHeaders();
  const response = await axios.get(`${BASE_URL}/api/coach/athletes`, { headers });
  return response.data;
}

/**
 * Get all analyses for a specific athlete.
 */
export async function getAthleteAnalyses(playerId: string): Promise<Analysis[]> {
  const headers = await getAuthHeaders();
  const response = await axios.get(
    `${BASE_URL}/api/coach/athletes/${playerId}/analyses`,
    { headers },
  );
  return response.data.analyses ?? [];
}

/**
 * Create an assignment for an athlete (coach side).
 */
export async function createCoachAssignment(data: CoachAssignmentData): Promise<Assignment> {
  const headers = await getAuthHeaders();
  const response = await axios.post(
    `${BASE_URL}/api/coach/assignments`,
    data,
    { headers },
  );
  return response.data;
}

/**
 * Remove a coach-athlete relationship.
 */
export async function removeRelationship(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  await axios.delete(`${BASE_URL}/api/coach/relationships/${id}`, { headers });
}

