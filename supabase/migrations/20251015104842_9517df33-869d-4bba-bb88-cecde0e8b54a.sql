-- Ensure rematch_requests is realtime-enabled and RLS allows recipients to receive INSERT events

-- 1) Add table to realtime publication (idempotent) and set REPLICA IDENTITY FULL
DO $$
BEGIN
  -- Add to publication if not already present
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rematch_requests;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  -- Ensure full replica identity for complete row data
  BEGIN
    ALTER TABLE public.rematch_requests REPLICA IDENTITY FULL;
  EXCEPTION WHEN others THEN
    -- Ignore if already set
    NULL;
  END;
END $$;

-- 2) Enable RLS (idempotent)
ALTER TABLE public.rematch_requests ENABLE ROW LEVEL SECURITY;

-- 3) Policies: allow sender/recipient to see and update their own requests, and sender to insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'rematch_requests' AND policyname = 'Rematch select own'
  ) THEN
    CREATE POLICY "Rematch select own"
    ON public.rematch_requests
    FOR SELECT
    USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'rematch_requests' AND policyname = 'Rematch insert by sender'
  ) THEN
    CREATE POLICY "Rematch insert by sender"
    ON public.rematch_requests
    FOR INSERT
    WITH CHECK (auth.uid() = from_user_id AND auth.uid() <> to_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'rematch_requests' AND policyname = 'Rematch update own'
  ) THEN
    CREATE POLICY "Rematch update own"
    ON public.rematch_requests
    FOR UPDATE
    USING (auth.uid() = from_user_id OR auth.uid() = to_user_id)
    WITH CHECK (auth.uid() = from_user_id OR auth.uid() = to_user_id);
  END IF;
END $$;