
-- Fix all weekly_stats records where week_start is NOT a Monday (DOW=1)
-- Shift them back 1 day to Monday, merging with existing Monday records if present

DO $$
DECLARE
  r RECORD;
  correct_monday DATE;
  existing RECORD;
BEGIN
  FOR r IN
    SELECT id, user_id, week_start, total_score, games_played, games_won, total_words, avg_score, best_game_score
    FROM weekly_stats
    WHERE EXTRACT(ISODOW FROM week_start) != 1  -- not Monday
    ORDER BY week_start
  LOOP
    -- Calculate the correct Monday (shift back to Monday)
    correct_monday := DATE_TRUNC('week', r.week_start)::DATE;
    
    -- Check if a correct Monday record already exists for this user
    SELECT id, total_score, games_played, games_won, total_words, best_game_score
    INTO existing
    FROM weekly_stats
    WHERE user_id = r.user_id AND week_start = correct_monday;
    
    IF FOUND THEN
      -- Merge into the existing Monday record
      UPDATE weekly_stats SET
        total_score = existing.total_score + r.total_score,
        games_played = existing.games_played + r.games_played,
        games_won = existing.games_won + r.games_won,
        total_words = existing.total_words + r.total_words,
        best_game_score = GREATEST(existing.best_game_score, r.best_game_score),
        avg_score = (existing.total_score + r.total_score) / (existing.games_played + r.games_played),
        updated_at = NOW()
      WHERE id = existing.id;
      
      -- Delete the orphan
      DELETE FROM weekly_stats WHERE id = r.id;
      
      RAISE NOTICE 'Merged user % week % into %', r.user_id, r.week_start, correct_monday;
    ELSE
      -- Just fix the date
      UPDATE weekly_stats SET week_start = correct_monday, updated_at = NOW() WHERE id = r.id;
      
      RAISE NOTICE 'Shifted user % week % to %', r.user_id, r.week_start, correct_monday;
    END IF;
  END LOOP;
END $$;
