-- Create a separate table for sensitive profile data
CREATE TABLE IF NOT EXISTS public.profiles_private (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on the private table
ALTER TABLE public.profiles_private ENABLE ROW LEVEL SECURITY;

-- Migrate existing sensitive data from profiles to profiles_private
INSERT INTO public.profiles_private (id, email, created_by, created_at, updated_at)
SELECT id, email, created_by, created_at, updated_at
FROM public.profiles
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for profiles_private - only owner and admins can access
CREATE POLICY "Users can view their own private data" 
ON public.profiles_private 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Admins can view all private data" 
ON public.profiles_private 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own private data" 
ON public.profiles_private 
FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own private data" 
ON public.profiles_private 
FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Admins can update all private data" 
ON public.profiles_private 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_profiles_private_updated_at
  BEFORE UPDATE ON public.profiles_private
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Remove sensitive columns from public profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS created_by;

-- Update the handle_new_user function to also create private profile data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert into public profiles
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  
  -- Insert into private profiles
  INSERT INTO public.profiles_private (id, email)
  VALUES (new.id, new.email);
  
  RETURN new;
END;
$$;