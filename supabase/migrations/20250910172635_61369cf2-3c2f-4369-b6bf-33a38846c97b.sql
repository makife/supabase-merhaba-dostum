-- Enable realtime updates for matchmaking to ensure clients receive room status changes promptly
DO $$
BEGIN
  -- Ensure full row data is published on UPDATE for realtime
  BEGIN
    EXECUTE 'ALTER TABLE public.matchmaking_rooms REPLICA IDENTITY FULL';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'REPLICA IDENTITY change skipped: %', SQLERRM;
  END;

  -- Add table to supabase_realtime publication (idempotent with NOTICE on duplicates)
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.matchmaking_rooms';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Publication add skipped: %', SQLERRM;
  END;
END $$;