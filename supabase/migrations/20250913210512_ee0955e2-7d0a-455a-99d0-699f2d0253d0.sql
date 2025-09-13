-- Allow both players in a room to view all participants (fix random-match visibility)
DO $$ BEGIN
  -- Create permissive SELECT policy if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'game_participants' AND policyname = 'Players can view participants of their rooms'
  ) THEN
    CREATE POLICY "Players can view participants of their rooms"
    ON public.game_participants
    FOR SELECT
    USING (
      room_id IN (
        SELECT id FROM public.game_rooms 
        WHERE player1_id = auth.uid() OR player2_id = auth.uid()
      )
    );
  END IF;
END $$;