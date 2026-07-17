/**
 * drillVideos.ts
 *
 * Fetches drill video metadata from the backend API (/api/drills/videos).
 * Videos are stored in Supabase `drill_videos` table and served via the
 * NextSport backend — this allows updating video URLs without a new app release.
 *
 * Graceful degradation: if the request fails for any reason, returns an empty
 * Map so DrillsScreen still renders normally (just without video thumbnails/players).
 */

const API_URL = 'https://nextsport-sensforge.vercel.app/api/drills/videos';

export interface DrillVideo {
  drill_id: string;
  youtube_url: string;
  title: string;
  creator: string;
  note?: string;
  is_embeddable: boolean;
}

type DrillVideoMap = Map<string, DrillVideo>;

// Module-level cache — only fetched once per app session
let _cache: DrillVideoMap | null = null;

export async function fetchDrillVideos(): Promise<DrillVideoMap> {
  if (_cache !== null) return _cache;

  try {
    const res = await fetch(API_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { videos: DrillVideo[] };
    const map = new Map(data.videos.map((v) => [v.drill_id, v]));
    // Only cache if we got a non-empty response — failed/empty responses should
    // not be cached so the next render will retry the fetch.
    if (map.size > 0) {
      _cache = map;
    }
    return map;
  } catch (err) {
    console.warn('[drillVideos] Failed to fetch drill videos, degrading gracefully:', err);
    // Do NOT set _cache — leave it null so the next call retries the fetch.
    return new Map();
  }
}
