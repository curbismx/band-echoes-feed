-- Function to update video views count
CREATE OR REPLACE FUNCTION public.update_video_views_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos
    SET views_count = views_count + 1
    WHERE id = NEW.video_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Function to update video likes count
CREATE OR REPLACE FUNCTION public.update_video_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos
    SET likes_count = likes_count + 1
    WHERE id = NEW.video_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos
    SET likes_count = likes_count - 1
    WHERE id = OLD.video_id;
    RETURN OLD;
  END IF;
END;
$$;

-- Create trigger for video views
DROP TRIGGER IF EXISTS on_video_view_created ON public.video_views;
CREATE TRIGGER on_video_view_created
  AFTER INSERT ON public.video_views
  FOR EACH ROW
  EXECUTE FUNCTION public.update_video_views_count();

-- Create trigger for video likes/favorites
DROP TRIGGER IF EXISTS on_favorite_created ON public.favorites;
CREATE TRIGGER on_favorite_created
  AFTER INSERT ON public.favorites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_video_likes_count();

DROP TRIGGER IF EXISTS on_favorite_deleted ON public.favorites;
CREATE TRIGGER on_favorite_deleted
  AFTER DELETE ON public.favorites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_video_likes_count();

-- Recalculate existing counts for all videos
UPDATE public.videos v
SET views_count = (
  SELECT COUNT(*) FROM public.video_views WHERE video_id = v.id
);

UPDATE public.videos v
SET likes_count = (
  SELECT COUNT(*) FROM public.favorites WHERE video_id = v.id
);