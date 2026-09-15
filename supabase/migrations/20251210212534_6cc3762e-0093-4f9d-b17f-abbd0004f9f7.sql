
-- game_participants tablosunda DELETE event'lerinde eski satır verisi gelsin
ALTER TABLE public.game_participants REPLICA IDENTITY FULL;

-- Tabloyu realtime publication'a ekle (eğer yoksa)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'game_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.game_participants;
  END IF;
END $$;
