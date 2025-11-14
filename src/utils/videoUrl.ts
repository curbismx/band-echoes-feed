// Simple passthrough: use the original Supabase MP4 URL directly.
// Do NOT call ffmpeg, do NOT proxy through any edge function.
export function getStreamingVideoUrl(url: string): string {
  return url;
}
