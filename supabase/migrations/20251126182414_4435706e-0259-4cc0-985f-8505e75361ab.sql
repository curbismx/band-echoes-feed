-- Sync emails from auth.users to profiles_private for existing users
UPDATE public.profiles_private pp
SET email = au.email
FROM auth.users au
WHERE pp.id = au.id 
  AND au.email IS NOT NULL
  AND (pp.email IS NULL OR pp.email = '');