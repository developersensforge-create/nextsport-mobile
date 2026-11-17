import axios from 'axios';
import { supabase } from './supabase';

const BASE_URL = 'https://nextsport-six.vercel.app';

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface FeedbackAnnotation {
  id?: string;
  time_sec: number;
  text: string;
}

export interface SubmissionSummary {
  id: string;
  attempt_no: number;
  duration_sec: number | null;
  created_at: string;
  video_url: string | null;
}

export interface AthleteSubmission extends SubmissionSummary {
  assignment_id: string;
  assignment_title: string;
  drill_name: string | null;
  assignment_status: 'pending' | 'submitted' | 'reviewed' | 'completed' | 'skipped';
  reviewed: boolean;
}

export interface FeedbackSummary {
  id: string;
  source: 'analysis' | 'submission';
  created_at: string;
  read_at: string | null;
  coach_name: string | null;
  assignment_id: string | null;
  assignment_title: string | null;
  overall_note: string | null;
  video_url: string | null;
  audio_url: string | null;
  audio_duration_sec: number | null;
  audio_start_sec: number | null;
  annotations: FeedbackAnnotation[];
}

export interface FeedbackDetail extends FeedbackSummary {
  analysis_id: string | null;
  submission_id: string | null;
  player_name: string | null;
  updated_at: string;
}

export interface CreateFeedbackPayload {
  source: 'analysis' | 'submission';
  submission_id?: string;
  analysis_id?: string;
  overall_note?: string | null;
  annotations?: Array<{ time_sec: number; text: string }>;
}

// ─────────────────────────────────────────────────────────────
// Upload helper — same XHR pattern as submitAnalysis so that RN can
// stream a local file:// URI straight to the signed storage URL.
// ─────────────────────────────────────────────────────────────

export function uploadFileToSignedUrl(
  uploadUrl: string,
  fileUri: string,
  contentType: string,
  fileName: string,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.timeout = 120000; // 2 分钟——音频文件最大 60 秒，给网络波动留余量
    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress(Math.min(event.loaded / event.total, 1));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Upload network error'));
    xhr.ontimeout = () =>
      reject(new Error('Upload timed out — check your connection and try again'));
    xhr.onabort = () =>
      reject(new Error('Upload cancelled'));
    xhr.send({ uri: fileUri, type: contentType, name: fileName } as any);
  });
}

function friendlyError(err: any, fallback: string): Error {
  const message = err?.response?.data?.error;
  if (typeof message === 'string' && message.length > 0) {
    if (message === 'submission_limit_reached') {
      return new Error('This task already has 3 submitted videos.');
    }
    if (message === 'daily_submission_limit_reached') {
      return new Error('You have reached 3 video submissions today. Try again tomorrow.');
    }
    if (message === 'edit_window_expired (24h)') {
      return new Error('You can only edit feedback within 24 hours of sending it.');
    }
    return new Error(message);
  }
  return new Error(fallback);
}

// ─────────────────────────────────────────────────────────────
// Player side — assignment submissions
// ─────────────────────────────────────────────────────────────

export async function getAssignmentUploadUrl(
  assignmentId: string,
  contentType: string,
  durationSec: number,
): Promise<{ upload_url: string; token: string; file_path: string; attempt_no: number; attempts_left: number }> {
  const headers = await getAuthHeaders();
  try {
    const res = await axios.post(
      `${BASE_URL}/api/assignments/${assignmentId}/upload-url`,
      { content_type: contentType, duration_sec: durationSec },
      { headers, timeout: 20000 },
    );
    return res.data;
  } catch (err) {
    throw friendlyError(err, 'Could not start the upload. Please try again.');
  }
}

export async function submitAssignment(
  assignmentId: string,
  videoPath: string,
  durationSec: number,
): Promise<{ submission_id: string; attempt_no: number; attempts_left: number }> {
  const headers = await getAuthHeaders();
  try {
    const res = await axios.post(
      `${BASE_URL}/api/assignments/${assignmentId}/submit`,
      { video_path: videoPath, duration_sec: durationSec },
      { headers, timeout: 30000 },
    );
    return res.data;
  } catch (err) {
    throw friendlyError(err, 'Could not submit your video. Please try again.');
  }
}

export async function getAssignmentSubmissions(assignmentId: string): Promise<{
  submissions: SubmissionSummary[];
  attempts_used: number;
}> {
  const headers = await getAuthHeaders();
  const res = await axios.get(`${BASE_URL}/api/assignments/${assignmentId}/submissions`, {
    headers,
  });
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// Coach side
// ─────────────────────────────────────────────────────────────

export async function getAthleteSubmissions(
  playerId: string,
  pendingOnly = false,
): Promise<{ submissions: AthleteSubmission[]; pending_review_count: number }> {
  const headers = await getAuthHeaders();
  const res = await axios.get(
    `${BASE_URL}/api/coach/athletes/${playerId}/submissions${pendingOnly ? '?pending_review=1' : ''}`,
    { headers },
  );
  return res.data;
}

export async function createFeedback(
  payload: CreateFeedbackPayload,
): Promise<{ feedback_id: string; annotation_count: number }> {
  const headers = await getAuthHeaders();
  try {
    const res = await axios.post(`${BASE_URL}/api/coach/feedback`, payload, {
      headers,
      timeout: 30000,
    });
    return res.data;
  } catch (err) {
    throw friendlyError(err, 'Could not send feedback. Please try again.');
  }
}

export async function getFeedbackAudioUrl(
  feedbackId: string,
  contentType: string,
  durationSec: number,
): Promise<{ upload_url: string; token: string; file_path: string }> {
  const headers = await getAuthHeaders();
  try {
    const res = await axios.post(
      `${BASE_URL}/api/coach/feedback/${feedbackId}/audio-url`,
      { content_type: contentType, duration_sec: durationSec },
      { headers, timeout: 20000 },
    );
    return res.data;
  } catch (err) {
    throw friendlyError(err, 'Could not prepare the voice upload.');
  }
}

export async function attachFeedbackAudio(
  feedbackId: string,
  audioPath: string,
  durationSec: number,
  startSec: number | null,
): Promise<void> {
  const headers = await getAuthHeaders();
  try {
    await axios.patch(
      `${BASE_URL}/api/coach/feedback/${feedbackId}`,
      {
        audio_path: audioPath,
        audio_duration_sec: durationSec,
        audio_start_sec: startSec,
      },
      { headers, timeout: 20000 },
    );
  } catch (err) {
    throw friendlyError(err, 'Voice upload finished but could not be attached.');
  }
}

export async function updateFeedback(
  feedbackId: string,
  payload: {
    overall_note?: string | null;
    annotations?: Array<{ time_sec: number; text: string }>;
  },
): Promise<void> {
  const headers = await getAuthHeaders();
  try {
    await axios.patch(`${BASE_URL}/api/coach/feedback/${feedbackId}`, payload, {
      headers,
      timeout: 20000,
    });
  } catch (err) {
    throw friendlyError(err, 'Could not update feedback.');
  }
}

// ─────────────────────────────────────────────────────────────
// Coach side — feedback given BY this coach
// ─────────────────────────────────────────────────────────────

export async function getCoachFeedback(assignmentId?: string): Promise<{
  feedback: FeedbackSummary[];
}> {
  const headers = await getAuthHeaders();
  const params = assignmentId ? `?assignment_id=${assignmentId}` : '';
  const res = await axios.get(`${BASE_URL}/api/coach/feedback/given${params}`, {
    headers,
  });
  return res.data;
}

// ─────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────

export async function getMyFeedback(): Promise<{
  feedback: FeedbackSummary[];
  unread_count: number;
}> {
  try {
    const headers = await getAuthHeaders();
    const res = await axios.get(`${BASE_URL}/api/coach/feedback/mine`, { headers, timeout: 15000 });
    return res.data;
  } catch (err) {
    throw friendlyError(err, 'Could not load your feedback.');
  }
}

export async function getFeedbackDetail(feedbackId: string): Promise<{
  feedback: FeedbackDetail;
  viewer: 'coach' | 'player';
  can_edit: boolean;
}> {
  try {
    const headers = await getAuthHeaders();
    const res = await axios.get(`${BASE_URL}/api/coach/feedback/${feedbackId}`, { headers, timeout: 15000 });
    return res.data;
  } catch (err) {
    throw friendlyError(err, 'Could not load feedback details.');
  }
}

/** 标记已读。失败静默 —— 绝不能因为打点失败挡住用户看反馈。 */
export async function markFeedbackRead(feedbackId: string): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    await axios.post(`${BASE_URL}/api/coach/feedback/${feedbackId}/read`, {}, { headers });
  } catch {
    // ignore
  }
}
