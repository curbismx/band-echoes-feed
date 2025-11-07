-- Add links column to videos table to store music platform links
ALTER TABLE public.videos 
ADD COLUMN links jsonb DEFAULT '[]'::jsonb;