/**
 * Compact, PII-safe snapshots for crash breadcrumb logging.
 * Avoids logging full feedback text or signed URLs.
 */
import type { Analysis } from './api';

function lenOrType(v: unknown): string | number {
  if (v == null) return 'null';
  if (typeof v === 'string') return v.length;
  if (Array.isArray(v)) return v.length;
  return typeof v;
}

export function summarizeAnalysisForLog(a: Analysis | Record<string, unknown> | null | undefined) {
  if (a == null) {
    return { present: false as const };
  }
  const strengths = (a as Analysis).strengths;
  const improvements = (a as Analysis).improvements;
  const feedback = (a as Analysis).feedback;
  const rv = (a as Analysis).result_video_url;
  return {
    present: true as const,
    id: String((a as Analysis).id ?? ''),
    status: (a as Analysis).status,
    strengthsLen: lenOrType(strengths),
    improvementsLen: lenOrType(improvements),
    firstStrengthType:
      Array.isArray(strengths) && strengths.length > 0 ? typeof strengths[0] : 'n/a',
    firstImprovementType:
      Array.isArray(improvements) && improvements.length > 0 ? typeof improvements[0] : 'n/a',
    feedbackLen: typeof feedback === 'string' ? feedback.length : lenOrType(feedback),
    resultVideoUrlKind: rv == null || rv === '' ? 'empty' : typeof rv,
    /** String length only (no URL contents logged). */
    resultVideoUrlLen: typeof rv === 'string' ? rv.length : 0,
  };
}
