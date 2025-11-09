-- Add created_by column to profiles to track which admin created each user
ALTER TABLE public.profiles 
ADD COLUMN created_by UUID REFERENCES auth.users(id);

-- Create index for faster queries
CREATE INDEX idx_profiles_created_by ON public.profiles(created_by);

COMMENT ON COLUMN public.profiles.created_by IS 'The admin user who created this account';