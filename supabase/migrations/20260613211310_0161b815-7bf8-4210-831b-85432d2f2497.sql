CREATE OR REPLACE FUNCTION public.protect_tournament_wins_from_decrease()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.tournament_wins IS DISTINCT FROM OLD.tournament_wins
     AND COALESCE(NEW.tournament_wins, 0) < COALESCE(OLD.tournament_wins, 0) THEN
    NEW.tournament_wins := OLD.tournament_wins;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_tournament_wins_from_decrease_trigger ON public.profiles;
CREATE TRIGGER protect_tournament_wins_from_decrease_trigger
BEFORE UPDATE OF tournament_wins ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_tournament_wins_from_decrease();

CREATE OR REPLACE FUNCTION public.award_tournament_win_if_final(
  p_tournament_id uuid,
  p_winner_id uuid,
  p_final_match_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_real_winner boolean := false;
  v_is_final_match boolean := false;
  v_match_id uuid;
  v_inserted boolean := false;
  v_award_count integer := 0;
BEGIN
  IF p_tournament_id IS NULL OR p_winner_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.tournament_participants tp
    WHERE tp.tournament_id = p_tournament_id
      AND tp.user_id = p_winner_id
      AND COALESCE(tp.is_bot, false) = false
  ) INTO v_is_real_winner;

  IF NOT v_is_real_winner THEN
    RETURN false;
  END IF;

  IF p_final_match_id IS NOT NULL THEN
    SELECT tm.id,
           (
             tm.status = 'completed'
             AND tm.winner_id = p_winner_id
             AND tm.round = (
               SELECT MAX(tm3.round)
               FROM public.tournament_matches tm3
               WHERE tm3.tournament_id = p_tournament_id
             )
             AND (
               SELECT COUNT(*)
               FROM public.tournament_matches tm2
               WHERE tm2.tournament_id = p_tournament_id
                 AND tm2.round = tm.round
             ) = 1
           )
    INTO v_match_id, v_is_final_match
    FROM public.tournament_matches tm
    WHERE tm.id = p_final_match_id
      AND tm.tournament_id = p_tournament_id;
  ELSE
    SELECT tm.id, true
    INTO v_match_id, v_is_final_match
    FROM public.tournament_matches tm
    WHERE tm.tournament_id = p_tournament_id
      AND tm.status = 'completed'
      AND tm.winner_id = p_winner_id
      AND tm.round = (
        SELECT MAX(tm3.round)
        FROM public.tournament_matches tm3
        WHERE tm3.tournament_id = p_tournament_id
      )
      AND (
        SELECT COUNT(*)
        FROM public.tournament_matches tm2
        WHERE tm2.tournament_id = p_tournament_id
          AND tm2.round = tm.round
      ) = 1
    ORDER BY tm.updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF COALESCE(v_is_final_match, false) IS NOT TRUE OR v_match_id IS NULL THEN
    RETURN false;
  END IF;

  WITH inserted AS (
    INSERT INTO public.tournament_win_awards (tournament_id, winner_id, final_match_id)
    VALUES (p_tournament_id, p_winner_id, v_match_id)
    ON CONFLICT (tournament_id) DO NOTHING
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM inserted) INTO v_inserted;

  SELECT COUNT(*)
  INTO v_award_count
  FROM public.tournament_win_awards
  WHERE winner_id = p_winner_id;

  IF v_inserted THEN
    UPDATE public.profiles
    SET tournament_wins = GREATEST(COALESCE(tournament_wins, 0) + 1, v_award_count),
        updated_at = now()
    WHERE id = p_winner_id;

    PERFORM public.check_and_award_badges_simple(p_winner_id);
  ELSE
    UPDATE public.profiles
    SET tournament_wins = GREATEST(COALESCE(tournament_wins, 0), v_award_count),
        updated_at = now()
    WHERE id = p_winner_id
      AND COALESCE(tournament_wins, 0) < v_award_count;
  END IF;

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_user_stats(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    session_stats RECORD;
    word_stats RECORD;
    longest_word_text TEXT;
    highest_word_text TEXT;
    avg_length NUMERIC;
    gw_count INT;
BEGIN
    SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN is_winner THEN 1 END) as wins,
        COUNT(CASE WHEN NOT is_winner THEN 1 END) as losses,
        COALESCE(SUM(score), 0) as total_score,
        COALESCE(SUM(words_count), 0) as total_words,
        COUNT(CASE WHEN game_mode = 'vs-computer' THEN 1 END) as vs_bot_games,
        COUNT(CASE WHEN game_mode LIKE 'private-room%' THEN 1 END) as private_room_games,
        COUNT(CASE WHEN game_mode LIKE 'random-match%' THEN 1 END) as random_match_games
    INTO session_stats
    FROM public.game_sessions
    WHERE user_id = p_user_id;

    SELECT COUNT(*) INTO gw_count FROM public.game_words WHERE player_id = p_user_id;

    IF gw_count > 0 THEN
        SELECT 
            COALESCE(MAX(LENGTH(word)), 0) as longest_length,
            COALESCE(MAX(points), 0) as highest_score
        INTO word_stats
        FROM public.game_words
        WHERE player_id = p_user_id;

        SELECT word INTO longest_word_text
        FROM public.game_words
        WHERE player_id = p_user_id 
          AND LENGTH(word) = word_stats.longest_length
        LIMIT 1;

        SELECT word INTO highest_word_text
        FROM public.game_words
        WHERE player_id = p_user_id 
          AND points = word_stats.highest_score
        LIMIT 1;

        SELECT COALESCE(AVG(LENGTH(word)), 0) INTO avg_length
        FROM public.game_words
        WHERE player_id = p_user_id;

        UPDATE public.profiles SET
            total_games = GREATEST(COALESCE(session_stats.total_games, 0), COALESCE(total_games, 0)),
            wins = GREATEST(COALESCE(session_stats.wins, 0), COALESCE(wins, 0)),
            losses = GREATEST(COALESCE(session_stats.losses, 0), COALESCE(losses, 0)),
            total_score = GREATEST(COALESCE(session_stats.total_score, 0), COALESCE(total_score, 0)),
            total_words_created = GREATEST(COALESCE(session_stats.total_words, 0), COALESCE(total_words_created, 0)),
            longest_word = COALESCE(longest_word_text, longest_word),
            longest_word_length = GREATEST(COALESCE(word_stats.longest_length, 0), COALESCE(longest_word_length, 0)),
            highest_word = COALESCE(highest_word_text, highest_word),
            highest_word_score = GREATEST(COALESCE(word_stats.highest_score, 0), COALESCE(highest_word_score, 0)),
            average_word_length = GREATEST(COALESCE(avg_length, 0), COALESCE(average_word_length, 0)),
            vs_bot_games = GREATEST(COALESCE(session_stats.vs_bot_games, 0), COALESCE(vs_bot_games, 0)),
            random_match_games = GREATEST(COALESCE(session_stats.random_match_games, 0), COALESCE(random_match_games, 0)),
            private_room_games = GREATEST(COALESCE(session_stats.private_room_games, 0), COALESCE(private_room_games, 0)),
            updated_at = NOW()
        WHERE id = p_user_id;
    ELSE
        UPDATE public.profiles SET
            total_games = GREATEST(COALESCE(session_stats.total_games, 0), COALESCE(total_games, 0)),
            wins = GREATEST(COALESCE(session_stats.wins, 0), COALESCE(wins, 0)),
            losses = GREATEST(COALESCE(session_stats.losses, 0), COALESCE(losses, 0)),
            total_score = GREATEST(COALESCE(session_stats.total_score, 0), COALESCE(total_score, 0)),
            total_words_created = GREATEST(COALESCE(session_stats.total_words, 0), COALESCE(total_words_created, 0)),
            vs_bot_games = GREATEST(COALESCE(session_stats.vs_bot_games, 0), COALESCE(vs_bot_games, 0)),
            random_match_games = GREATEST(COALESCE(session_stats.random_match_games, 0), COALESCE(random_match_games, 0)),
            private_room_games = GREATEST(COALESCE(session_stats.private_room_games, 0), COALESCE(private_room_games, 0)),
            updated_at = NOW()
        WHERE id = p_user_id;
    END IF;
END;
$$;