-- Ensure realtime delivers full row data for updates
ALTER TABLE public.game_participants REPLICA IDENTITY FULL;
ALTER TABLE public.game_rooms REPLICA IDENTITY FULL;

-- Make sure both tables are part of the realtime publication (idempotent)
DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.game_participants';
  EXCEPTION WHEN duplicate_object THEN
    -- already added
    NULL;
  END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms';
  EXCEPTION WHEN duplicate_object THEN
    -- already added
    NULL;
  END;
END$$;