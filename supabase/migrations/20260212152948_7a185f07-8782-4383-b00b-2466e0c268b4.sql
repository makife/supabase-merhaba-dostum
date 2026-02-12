
-- Fix RLS: Allow room_invite notifications to be inserted for other users
DROP POLICY IF EXISTS "Users can insert notifications for others" ON public.notifications;

CREATE POLICY "Users can insert notifications for others"
ON public.notifications
FOR INSERT
WITH CHECK (
  (user_id = auth.uid())
  OR ((user_id IS DISTINCT FROM auth.uid()) AND (type = 'private_message'))
  OR ((user_id IS DISTINCT FROM auth.uid()) AND (type = 'room_invite'))
  OR (auth.uid() = '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Create table to track rejected room invites
CREATE TABLE IF NOT EXISTS public.room_invite_rejections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code text NOT NULL,
  rejected_by uuid NOT NULL,
  rejected_from uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.room_invite_rejections ENABLE ROW LEVEL SECURITY;

-- Anyone can see rejections (needed to check before sending invite)
CREATE POLICY "Users can view rejections involving them"
ON public.room_invite_rejections
FOR SELECT
USING (auth.uid() = rejected_by OR auth.uid() = rejected_from);

-- Users can insert their own rejections
CREATE POLICY "Users can insert their own rejections"
ON public.room_invite_rejections
FOR INSERT
WITH CHECK (auth.uid() = rejected_by);
