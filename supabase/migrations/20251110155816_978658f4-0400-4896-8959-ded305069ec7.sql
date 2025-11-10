-- Ensure fresh admin update policy on videos
DROP POLICY IF EXISTS "Admins can update any videos" ON public.videos;
CREATE POLICY "Admins can update any videos"
ON public.videos
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));