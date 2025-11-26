-- Remove the aspect_ratio column that's no longer needed
-- Videos are now physically cropped during upload instead
ALTER TABLE videos DROP COLUMN IF EXISTS aspect_ratio;