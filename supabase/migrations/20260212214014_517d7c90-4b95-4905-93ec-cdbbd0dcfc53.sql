
-- Mevcut RESTRICTIVE INSERT politikalarını kaldır
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications for others" ON public.notifications;

-- PERMISSIVE INSERT politikası oluştur (room_invite ve private_message için başkasına yazılabilir)
CREATE POLICY "Users can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (
  (auth.uid() = user_id)
  OR (type = 'private_message' AND user_id IS DISTINCT FROM auth.uid())
  OR (type = 'room_invite' AND user_id IS DISTINCT FROM auth.uid())
  OR (type = 'badge_earned')
);
