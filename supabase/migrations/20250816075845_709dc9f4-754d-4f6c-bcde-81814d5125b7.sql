-- Önce geçersiz kayıtları temizle, sonra FK'leri ekle

-- 1) Geçersiz tournament_matches kayıtlarını temizle
DELETE FROM tournament_matches 
WHERE player1_id IS NOT NULL 
  AND player1_id NOT IN (SELECT id FROM profiles);

DELETE FROM tournament_matches 
WHERE player2_id IS NOT NULL 
  AND player2_id NOT IN (SELECT id FROM profiles);

DELETE FROM tournament_matches 
WHERE winner_id IS NOT NULL 
  AND winner_id NOT IN (SELECT id FROM profiles);

-- 2) Geçersiz tournament_participants kayıtlarını temizle
DELETE FROM tournament_participants 
WHERE user_id IS NOT NULL 
  AND user_id NOT IN (SELECT id FROM profiles);

-- 3) Şimdi FK'leri güvenle ekle
DO $$
BEGIN
  -- tournament_participants.user_id -> profiles.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'tournament_participants' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'tournament_participants_user_id_fkey') THEN
    ALTER TABLE public.tournament_participants
    ADD CONSTRAINT tournament_participants_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  -- tournament_matches FK'leri
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'tournament_matches' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'tournament_matches_player1_id_fkey') THEN
    ALTER TABLE public.tournament_matches
    ADD CONSTRAINT tournament_matches_player1_id_fkey
    FOREIGN KEY (player1_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'tournament_matches' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'tournament_matches_player2_id_fkey') THEN
    ALTER TABLE public.tournament_matches
    ADD CONSTRAINT tournament_matches_player2_id_fkey
    FOREIGN KEY (player2_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'tournament_matches' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'tournament_matches_winner_id_fkey') THEN
    ALTER TABLE public.tournament_matches
    ADD CONSTRAINT tournament_matches_winner_id_fkey
    FOREIGN KEY (winner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;