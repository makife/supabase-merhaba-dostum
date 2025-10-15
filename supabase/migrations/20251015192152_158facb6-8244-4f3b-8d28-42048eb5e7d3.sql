-- Rematch requests RLS, realtime, and secure notification RPC (idempotent)

-- Enable RLS on rematch_requests
ALTER TABLE public.rematch_requests ENABLE ROW LEVEL SECURITY;

-- Policies for rematch_requests
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rematch_requests' AND policyname = 'rematch_requests_select_from_to'
  ) THEN
    DROP POLICY "rematch_requests_select_from_to" ON public.rematch_requests;
  END IF;
END $$;

CREATE POLICY "rematch_requests_select_from_to"
ON public.rematch_requests
FOR SELECT
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rematch_requests' AND policyname = 'rematch_requests_insert_sender'
  ) THEN
    DROP POLICY "rematch_requests_insert_sender" ON public.rematch_requests;
  END IF;
END $$;

CREATE POLICY "rematch_requests_insert_sender"
ON public.rematch_requests
FOR INSERT
WITH CHECK (auth.uid() = from_user_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rematch_requests' AND policyname = 'rematch_requests_update_receiver'
  ) THEN
    DROP POLICY "rematch_requests_update_receiver" ON public.rematch_requests;
  END IF;
END $$;

CREATE POLICY "rematch_requests_update_receiver"
ON public.rematch_requests
FOR UPDATE
USING (auth.uid() = to_user_id)
WITH CHECK (auth.uid() = to_user_id);

-- Realtime publication and replica identity
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

-- Ensure notifications are queryable by the owner and in realtime publication
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notifications_select_owner'
  ) THEN
    DROP POLICY "notifications_select_owner" ON public.notifications;
  END IF;
END $$;

CREATE POLICY "notifications_select_owner"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- Secure function to insert notifications (create or replace)
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