-- Allow users to insert friend_request notifications for other users
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert notifications" ON public.notifications
FOR INSERT
WITH CHECK (
  (auth.uid() = user_id) 
  OR ((type = 'private_message'::text) AND (user_id IS DISTINCT FROM auth.uid())) 
  OR ((type = 'room_invite'::text) AND (user_id IS DISTINCT FROM auth.uid())) 
  OR ((type = 'friend_request'::text) AND (user_id IS DISTINCT FROM auth.uid()))
  OR (type = 'badge_earned'::text)
);