-- Add website and email fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN website TEXT,
ADD COLUMN email TEXT;