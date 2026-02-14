DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications" ON public.notifications FOR INSERT WITH CHECK (
  (auth.uid() = user_id)
  OR ((type = 'private_message') AND (user_id IS DISTINCT FROM auth.uid()))
  OR ((type = 'room_invite') AND (user_id IS DISTINCT FROM auth.uid()))
  OR ((type = 'friend_request') AND (user_id IS DISTINCT FROM auth.uid()))
  OR ((type = 'invite_response') AND (user_id IS DISTINCT FROM auth.uid()))
  OR (type = 'badge_earned')
);