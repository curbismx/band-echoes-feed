-- LANDSCAPE VIDEO SQUARE CROP: Add aspect_ratio column to videos table
ALTER TABLE videos ADD COLUMN aspect_ratio text;

COMMENT ON COLUMN videos.aspect_ratio IS 'Stores video aspect ratio: portrait, landscape, or square. Used for display optimization.';
