-- Create video_ratings table to store all user ratings
CREATE TABLE public.video_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id INTEGER NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  user_session TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(video_id, user_session)
);

-- Enable Row Level Security
ALTER TABLE public.video_ratings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read ratings (to calculate averages)
CREATE POLICY "Anyone can view ratings" 
ON public.video_ratings 
FOR SELECT 
USING (true);

-- Allow anyone to insert their own rating
CREATE POLICY "Anyone can insert ratings" 
ON public.video_ratings 
FOR INSERT 
WITH CHECK (true);

-- Allow users to update their own rating
CREATE POLICY "Users can update their own ratings" 
ON public.video_ratings 
FOR UPDATE 
USING (true);

-- Create index for faster queries
CREATE INDEX idx_video_ratings_video_id ON public.video_ratings(video_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_video_ratings_updated_at
BEFORE UPDATE ON public.video_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();