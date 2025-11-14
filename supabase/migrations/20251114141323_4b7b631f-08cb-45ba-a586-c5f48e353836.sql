-- Create video views tracking table
CREATE TABLE public.video_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_session TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT video_views_video_id_fkey FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX idx_video_views_user_id ON public.video_views(user_id);
CREATE INDEX idx_video_views_user_session ON public.video_views(user_session);
CREATE INDEX idx_video_views_video_id ON public.video_views(video_id);

-- Enable RLS
ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own video views"
  ON public.video_views
  FOR SELECT
  USING (auth.uid() = user_id OR user_session IS NOT NULL);

CREATE POLICY "Anyone can insert video views"
  ON public.video_views
  FOR INSERT
  WITH CHECK (true);

-- Add watched factor to algorithm settings
INSERT INTO public.algorithm_settings (factor_id, priority, enabled)
VALUES ('watched', 0, true)
ON CONFLICT DO NOTHING;