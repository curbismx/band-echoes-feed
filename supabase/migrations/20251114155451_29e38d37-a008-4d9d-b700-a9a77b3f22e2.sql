-- Ensure the videos bucket supports HTTP range requests for streaming
-- Update bucket configuration for optimal video streaming
UPDATE storage.buckets
SET 
  file_size_limit = 524288000, -- 500MB limit for videos
  allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm']
WHERE id = 'videos';

-- Ensure objects table supports range requests by having proper metadata
-- Note: Supabase Storage automatically handles range requests, but we ensure the configuration is optimal