-- Create app settings table for admin controls
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings
CREATE POLICY "Anyone can view app settings"
  ON public.app_settings
  FOR SELECT
  USING (true);

-- Only authenticated users can update settings (we'll add admin role later)
CREATE POLICY "Authenticated users can update settings"
  ON public.app_settings
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Insert default settings
INSERT INTO public.app_settings (setting_key, setting_value)
VALUES 
  ('video_compression_enabled', '{"enabled": true, "quality": "high"}'::jsonb),
  ('compression_quality', '{"preset": "high", "crf": 23}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();