-- Drop and recreate video_id column in favorites table
ALTER TABLE public.favorites DROP COLUMN video_id;
ALTER TABLE public.favorites ADD COLUMN video_id uuid NOT NULL;

-- Drop and recreate video_id column in video_ratings table  
ALTER TABLE public.video_ratings DROP COLUMN video_id;
ALTER TABLE public.video_ratings ADD COLUMN video_id uuid NOT NULL;