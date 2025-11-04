-- Fix search path security issue by recreating function with proper settings
DROP TRIGGER IF EXISTS update_video_ratings_updated_at ON public.video_ratings;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;

-- Recreate the trigger
CREATE TRIGGER update_video_ratings_updated_at
BEFORE UPDATE ON public.video_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();