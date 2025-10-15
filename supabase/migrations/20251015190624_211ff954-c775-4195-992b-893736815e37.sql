-- Rematch requests RLS and realtime publication, plus secure notification RPC

-- Ensure RLS is enabled
ALTER TABLE public.rematch_requests ENABLE ROW LEVEL SECURITY;

-- Policies for rematch_requests
DROP POLICY IF EXISTS "rematch_requests_select_from_to" ON public.rematch_requests;
CREATE POLICY "rematch_requests_select_from_to"
ON public.rematch_requests
FOR SELECT
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

DROP POLICY IF EXISTS "rematch_requests_insert_sender" ON public.rematch_requests;
CREATE POLICY "rematch_requests_insert_sender"
ON public.rematch_requests
FOR INSERT
WITH CHECK (auth.uid() = from_user_id);

DROP POLICY IF EXISTS "rematch_requests_update_receiver" ON public.rematch_requests;
CREATE POLICY "rematch_requests_update_receiver"
ON public.rematch_requests
FOR UPDATE
USING (auth.uid() = to_user_id)
WITH CHECK (auth.uid() = to_user_id);

-- Realtime publication and replica identity for full row payloads
ALTER TABLE public.rematch_requests REPLICA IDENTITY FULL;
DO $$
BEGIN
IF NOT EXISTS (
  SELECT 1 FROM pg_publication_tables 
  WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'rematch_requests'
) THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rematch_requests;
END IF;
END $$;

-- Notifications: ensure RLS select policy so recipients can read their notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select_owner" ON public.notifications;
CREATE POLICY "notifications_select_owner"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Secure function to create notifications bypassing insert RLS safely
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_message text,
  p_related_id text DEFAULT NULL
)
RETURNS public.notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  new_row public.notifications;
BEGIN
  INSERT INTO public.notifications (user_id, type, message, related_id, is_read)
  VALUES (p_user_id, p_type, p_message, p_related_id, false)
  RETURNING * INTO new_row;
  RETURN new_row;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text) TO anon, authenticated;