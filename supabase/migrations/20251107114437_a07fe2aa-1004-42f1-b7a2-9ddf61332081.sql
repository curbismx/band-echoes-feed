-- Add unique constraint for video_id and user_session to enable upsert
ALTER TABLE public.video_ratings 
ADD CONSTRAINT video_ratings_video_id_user_session_key 
UNIQUE (video_id, user_session);