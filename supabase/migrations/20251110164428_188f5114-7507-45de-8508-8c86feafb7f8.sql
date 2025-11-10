-- Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Everyone can view categories
CREATE POLICY "Anyone can view categories" 
ON public.categories 
FOR SELECT 
USING (true);

-- Only admins can create categories
CREATE POLICY "Admins can create categories" 
ON public.categories 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update categories
CREATE POLICY "Admins can update categories" 
ON public.categories 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete categories
CREATE POLICY "Admins can delete categories" 
ON public.categories 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create video_categories junction table (many-to-many relationship)
CREATE TABLE public.video_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(video_id, category_id)
);

-- Enable RLS
ALTER TABLE public.video_categories ENABLE ROW LEVEL SECURITY;

-- Anyone can view video categories
CREATE POLICY "Anyone can view video categories" 
ON public.video_categories 
FOR SELECT 
USING (true);

-- Users can add categories to their own videos
CREATE POLICY "Users can add categories to their videos" 
ON public.video_categories 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.videos 
    WHERE videos.id = video_id 
    AND videos.user_id = auth.uid()
  )
);

-- Users can remove categories from their own videos
CREATE POLICY "Users can remove categories from their videos" 
ON public.video_categories 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.videos 
    WHERE videos.id = video_id 
    AND videos.user_id = auth.uid()
  )
);

-- Create trigger for updated_at on categories
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();