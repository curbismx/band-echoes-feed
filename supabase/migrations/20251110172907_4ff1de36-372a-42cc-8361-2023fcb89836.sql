-- Create admin messages table
CREATE TABLE public.admin_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  max_displays INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMP WITH TIME ZONE
);

-- Create message views tracking table
CREATE TABLE public.admin_message_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.admin_messages(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_message_views ENABLE ROW LEVEL SECURITY;

-- Policies for admin_messages
CREATE POLICY "Admins can create messages"
ON public.admin_messages
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all messages"
ON public.admin_messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own messages"
ON public.admin_messages
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can acknowledge their messages"
ON public.admin_messages
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policies for message views
CREATE POLICY "Users can insert their own views"
ON public.admin_message_views
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.admin_messages 
  WHERE id = message_id AND user_id = auth.uid()
));

CREATE POLICY "Users can view their own message views"
ON public.admin_message_views
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.admin_messages 
  WHERE id = message_id AND user_id = auth.uid()
));

CREATE POLICY "Admins can view all message views"
ON public.admin_message_views
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add indexes for performance
CREATE INDEX idx_admin_messages_user_id ON public.admin_messages(user_id);
CREATE INDEX idx_admin_messages_acknowledged ON public.admin_messages(acknowledged);
CREATE INDEX idx_admin_message_views_message_id ON public.admin_message_views(message_id);