-- Update profiles on each inserted game word to keep longest/highest stats accurate in real-time
CREATE OR REPLACE FUNCTION public.update_profile_on_word_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  curr_longest_len integer;
  curr_highest_score integer;
BEGIN
  -- Lock the profile row to avoid race conditions
  SELECT longest_word_length, highest_word_score
  INTO curr_longest_len, curr_highest_score
  FROM public.profiles
  WHERE id = NEW.player_id
  FOR UPDATE;

  -- Update longest word if this one is longer
  IF NEW.word IS NOT NULL AND LENGTH(NEW.word) > COALESCE(curr_longest_len, 0) THEN
    UPDATE public.profiles
    SET 
      longest_word = NEW.word,
      longest_word_length = LENGTH(NEW.word),
      updated_at = NOW()
    WHERE id = NEW.player_id;
  END IF;

  -- Update highest scoring word if this one scores more
  IF NEW.points IS NOT NULL AND NEW.points > COALESCE(curr_highest_score, 0) THEN
    UPDATE public.profiles
    SET 
      highest_word = NEW.word,
      highest_word_score = NEW.points,
      updated_at = NOW()
    WHERE id = NEW.player_id;
  END IF;

  -- Increment total words and refresh average length using game_words
  UPDATE public.profiles p
  SET 
    total_words_created = COALESCE(p.total_words_created, 0) + 1,
    average_word_length = (
      SELECT COALESCE(AVG(LENGTH(gw.word))::NUMERIC(4,2), 0)
      FROM public.game_words gw
      WHERE gw.player_id = NEW.player_id
    ),
    updated_at = NOW()
  WHERE p.id = NEW.player_id;

  RETURN NEW;
END;
$$;

-- Create trigger on game_words insert
DROP TRIGGER IF EXISTS trg_update_profile_on_word_insert ON public.game_words;
CREATE TRIGGER trg_update_profile_on_word_insert
AFTER INSERT ON public.game_words
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_on_word_insert();

-- Performance: index on game_words(player_id) to speed up avg calculations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname = 'idx_game_words_player'
  ) THEN
    CREATE INDEX idx_game_words_player ON public.game_words(player_id);
  END IF;
END$$;