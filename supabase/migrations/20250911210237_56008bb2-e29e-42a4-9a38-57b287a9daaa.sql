-- Turnuva kazananları profile istatistiklerine ekleyen fonksiyon
CREATE OR REPLACE FUNCTION public.update_tournament_winner_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Eğer turnuva completed statüsüne geçtiyse
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Final maçının kazananını bul
    DECLARE
      final_winner TEXT;
    BEGIN
      SELECT winner_id INTO final_winner
      FROM tournament_matches 
      WHERE tournament_id = NEW.id 
      AND round = 3 
      AND status = 'completed'
      LIMIT 1;
      
      -- Eğer kazanan gerçek bir oyuncuysa (bot değilse)
      IF final_winner IS NOT NULL AND final_winner NOT LIKE 'bot_%' THEN
        -- Profile istatistiklerini güncelle
        UPDATE profiles
        SET 
          tournament_wins = COALESCE(tournament_wins, 0) + 1,
          total_games = COALESCE(total_games, 0) + 1,
          wins = COALESCE(wins, 0) + 1,
          updated_at = NOW()
        WHERE id = final_winner::uuid;
        
        -- Badge kontrolü için async çağrı
        PERFORM check_and_award_badges_simple(final_winner::uuid);
      END IF;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Profillere tournament_wins sütunu ekle
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tournament_wins integer DEFAULT 0;

-- Trigger oluştur
DROP TRIGGER IF EXISTS update_tournament_winner_stats_trigger ON tournaments;
CREATE TRIGGER update_tournament_winner_stats_trigger
  AFTER UPDATE ON tournaments
  FOR EACH ROW
  EXECUTE FUNCTION update_tournament_winner_stats();