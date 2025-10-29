-- Allow users to leave tournaments by deleting their own participant row
-- and ensure realtime delete events are emitted with full row data

-- Safe drop in case it exists
DROP POLICY IF EXISTS "Kullanıcılar turnuvadan ayrılabilir" ON public.tournament_participants;

-- RLS policy: users can delete their own participant record
CREATE POLICY "Kullanıcılar turnuvadan ayrılabilir"
ON public.tournament_participants
FOR DELETE
USING (((auth.uid())::text = user_id));

-- Ensure realtime delivers full row data for DELETE
ALTER TABLE public.tournament_participants REPLICA IDENTITY FULL;

-- Add table to supabase_realtime publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'tournament_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_participants;
  END IF;
END$$;