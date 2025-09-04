-- Allow recipients to mark their private messages as read
CREATE POLICY "Users can update own received messages"
ON public.private_messages
FOR UPDATE
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());