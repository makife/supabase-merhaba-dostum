-- LAZY START: Her iki oyuncu da hazır olunca countdown başlasın

-- 1. game_participants tablosuna is_ready kolonu ekle
ALTER TABLE public.game_participants 
ADD COLUMN IF NOT EXISTS is_ready boolean DEFAULT false;

-- 2. tournament_participants tablosuna da is_ready ekle (turnuva modları için)
ALTER TABLE public.tournament_participants
ADD COLUMN IF NOT EXISTS is_ready boolean DEFAULT false;

-- 3. Trigger fonksiyonu: Her iki oyuncu ready olunca countdown başlat
CREATE OR REPLACE FUNCTION public.check_players_ready_and_start_countdown()
RETURNS TRIGGER AS $$
DECLARE
  ready_count integer;
  total_players integer;
  room_status text;
  room_countdown text;
BEGIN
  -- Sadece is_ready true olduğunda çalış
  IF NEW.is_ready = false THEN
    RETURN NEW;
  END IF;

  -- Oda durumunu kontrol et
  SELECT status, countdown_started_at INTO room_status, room_countdown
  FROM game_rooms 
  WHERE id = NEW.room_id;

  -- Countdown zaten başladıysa çık
  IF room_countdown IS NOT NULL THEN
    RAISE LOG 'Countdown already started for room %', NEW.room_id;
    RETURN NEW;
  END IF;

  -- Oda waiting veya active değilse çık
  IF room_status NOT IN ('waiting', 'active') THEN
    RETURN NEW;
  END IF;

  -- Kaç oyuncu ready?
  SELECT COUNT(*) INTO ready_count
  FROM game_participants
  WHERE room_id = NEW.room_id AND is_ready = true AND is_bot = false;

  -- Toplam gerçek oyuncu sayısı
  SELECT COUNT(*) INTO total_players
  FROM game_participants
  WHERE room_id = NEW.room_id AND is_bot = false;

  RAISE LOG 'Ready check: room=%, ready=%, total=%', NEW.room_id, ready_count, total_players;

  -- Her iki oyuncu da ready ise countdown başlat
  IF ready_count >= 2 AND total_players >= 2 THEN
    UPDATE game_rooms
    SET 
      countdown_started_at = NOW(),
      status = 'active'
    WHERE id = NEW.room_id
    AND countdown_started_at IS NULL;

    RAISE LOG '🚀 LAZY START: Countdown started for room % - all players ready!', NEW.room_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Trigger oluştur
DROP TRIGGER IF EXISTS trigger_check_players_ready ON game_participants;
CREATE TRIGGER trigger_check_players_ready
AFTER UPDATE OF is_ready ON game_participants
FOR EACH ROW
EXECUTE FUNCTION check_players_ready_and_start_countdown();

-- 5. Tournament için benzer trigger
CREATE OR REPLACE FUNCTION public.check_tournament_players_ready()
RETURNS TRIGGER AS $$
DECLARE
  ready_count integer;
  match_record RECORD;
BEGIN
  IF NEW.is_ready = false THEN
    RETURN NEW;
  END IF;

  -- Bu kullanıcının aktif maçını bul
  SELECT tm.* INTO match_record
  FROM tournament_matches tm
  WHERE tm.tournament_id = NEW.tournament_id
    AND tm.status IN ('pending', 'in_progress')
    AND (tm.player1_id = NEW.user_id OR tm.player2_id = NEW.user_id)
    AND tm.countdown_started_at IS NULL
  LIMIT 1;

  IF match_record IS NULL THEN
    RETURN NEW;
  END IF;

  -- Her iki oyuncunun da ready olup olmadığını kontrol et
  SELECT COUNT(*) INTO ready_count
  FROM tournament_participants tp
  WHERE tp.tournament_id = NEW.tournament_id
    AND tp.is_ready = true
    AND (tp.user_id = match_record.player1_id OR tp.user_id = match_record.player2_id);

  RAISE LOG 'Tournament ready check: match=%, ready=%', match_record.id, ready_count;

  -- Her iki oyuncu da ready ise countdown başlat
  IF ready_count >= 2 THEN
    UPDATE tournament_matches
    SET 
      countdown_started_at = NOW(),
      status = 'in_progress'
    WHERE id = match_record.id
    AND countdown_started_at IS NULL;

    RAISE LOG '🚀 TOURNAMENT LAZY START: Countdown started for match %', match_record.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_check_tournament_players_ready ON tournament_participants;
CREATE TRIGGER trigger_check_tournament_players_ready
AFTER UPDATE OF is_ready ON tournament_participants
FOR EACH ROW
EXECUTE FUNCTION check_tournament_players_ready();