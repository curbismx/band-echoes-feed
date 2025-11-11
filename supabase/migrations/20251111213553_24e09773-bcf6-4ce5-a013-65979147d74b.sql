-- Create table to store algorithm settings
CREATE TABLE IF NOT EXISTS public.algorithm_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factor_id text NOT NULL UNIQUE,
  priority integer NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.algorithm_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage algorithm settings
CREATE POLICY "Admins can manage algorithm settings"
ON public.algorithm_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view algorithm settings (needed for feed generation)
CREATE POLICY "Anyone can view algorithm settings"
ON public.algorithm_settings
FOR SELECT
USING (true);

-- Insert default algorithm priorities
INSERT INTO public.algorithm_settings (factor_id, priority, enabled) VALUES
  ('category', 1, true),
  ('favorites', 2, true),
  ('rating', 3, true),
  ('recency', 4, true),
  ('views', 5, true),
  ('following', 6, true),
  ('engagement', 7, true),
  ('random', 8, true)
ON CONFLICT (factor_id) DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_algorithm_settings_updated_at
  BEFORE UPDATE ON public.algorithm_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();