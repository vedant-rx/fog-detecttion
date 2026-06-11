/**
 * api.ts
 * ======
 * API helper for fetching live data from the Flask backend.
 *
 * IMPORTANT: If the backend port (in app.py) changes, update API_BASE_URL below.
 */

// ===========================================================================
// CHANGE THIS if the backend port changes
// ===========================================================================
export const API_BASE_URL = 'http://localhost:5001';

export const POLL_INTERVAL_MS = 3000;

// ===========================================================================
// JSON returned by GET /api/latest
// ===========================================================================
export interface LatestCapture {
  available: boolean;
  timestamp?: string;
  temperature_c?: number;
  humidity_percent?: number;
  fog_detected?: boolean;
  image_filename?: string;
  dehazed_filename?: string;
  processing_time_ms?: number;
  original_url?: string;
  dehazed_url?: string;
  message?: string;
  // Quality metrics
  entropy_hazy?: number;
  entropy_dehazed?: number;
  entropy_gain?: number;
  ssim?: number;
  map?: number;             // NEW: Object Detection mAP (HOG-based)
}

export async function fetchLatest(): Promise<LatestCapture | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/latest`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('fetchLatest failed:', e);
    return null;
  }
}

export function secondsSince(timestamp: string | undefined): number {
  if (!timestamp) return 0;
  const t = new Date(timestamp.replace(' ', 'T'));
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - t.getTime()) / 1000));
}