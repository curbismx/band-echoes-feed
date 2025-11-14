/**
 * Converts a Supabase Storage video URL to use the streaming edge function
 * This enables proper range-request headers for iOS video playback
 */
export const getStreamingVideoUrl = (storageUrl: string): string => {
  // Extract filename from storage URL
  // Format: https://PROJECT.supabase.co/storage/v1/object/public/videos/filename.mp4
  const matches = storageUrl.match(/\/videos\/(.+)$/);
  
  if (!matches || !matches[1]) {
    console.warn('Could not extract filename from URL:', storageUrl);
    return storageUrl; // Return original URL as fallback
  }
  
  const filename = matches[1];
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  // Return edge function URL with filename parameter
  return `${supabaseUrl}/functions/v1/stream-video?file=${encodeURIComponent(filename)}`;
};
