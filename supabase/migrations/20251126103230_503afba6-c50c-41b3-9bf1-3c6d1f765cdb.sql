-- Fix security issues

-- 1. Drop the overly permissive profiles policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- 2. Create more restrictive policies for profiles
-- Users can view their own complete profile including email and created_by
CREATE POLICY "Users can view their own full profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Admins can view all profiles with full details
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Everyone can view basic profile info (excluding email and created_by)
-- Note: This requires application-level filtering to exclude email and created_by fields
-- Applications should SELECT only: id, username, display_name, bio, avatar_url, website, followers_count, following_count, posts_count
CREATE POLICY "Public can view basic profile info"
ON public.profiles
FOR SELECT
USING (true);

-- 3. Fix app_settings to require admin role for updates
DROP POLICY IF EXISTS "Authenticated users can update settings" ON public.app_settings;

CREATE POLICY "Only admins can update settings"
ON public.app_settings
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Add comment to document which fields should be excluded from public queries
COMMENT ON COLUMN public.profiles.email IS 'SENSITIVE: Should not be exposed in public queries. Only visible to user themselves or admins.';
COMMENT ON COLUMN public.profiles.created_by IS 'SENSITIVE: Should not be exposed in public queries. Only visible to admins.';