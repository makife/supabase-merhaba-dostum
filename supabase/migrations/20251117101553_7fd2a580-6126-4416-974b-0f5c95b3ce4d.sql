-- 0-0 beraberlik durumunda direkt rastgele seçim yap
CREATE OR REPLACE FUNCTION determine_tournament_winner_with_tiebreaker(
  p_match_id uuid,
  p_player1_id text,
  p_player2_id text,
  p_player1_score integer,
  p_player2_score integer
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_winner_id text;
  v_player1_max_word_score integer;
  v_player2_max_word_score integer;
  v_player1_longest_word integer;
  v_player2_longest_word integer;
  v_player1_word_count integer;
  v_player2_word_count integer;
  v_player1_first_word_time timestamp with time zone;
  v_player2_first_word_time timestamp with time zone;
BEGIN
  -- Eğer skorlar farklıysa, yüksek skoru alan kazanır
  IF p_player1_score > p_player2_score THEN
    RETURN p_player1_id;
  ELSIF p_player2_score > p_player1_score THEN
    RETURN p_player2_id;
  END IF;

  -- 0-0 beraberlik durumunda direkt rastgele seç
  IF p_player1_score = 0 AND p_player2_score = 0 THEN
    IF RANDOM() > 0.5 THEN
      RETURN p_player1_id;
    ELSE
      RETURN p_player2_id;
    END IF;
  END IF;

  -- Beraberlik durumu - tiebreaker kriterlerine bak
  
  -- Kriter 1: En yüksek puanlı tek kelime
  SELECT COALESCE(MAX(points), 0) INTO v_player1_max_word_score
  FROM game_words
  WHERE player_id = p_player1_id::uuid
  AND created_at >= (
    SELECT countdown_started_at 
    FROM tournament_matches 
    WHERE id = p_match_id
  );

  SELECT COALESCE(MAX(points), 0) INTO v_player2_max_word_score
  FROM game_words
  WHERE player_id = p_player2_id::uuid
  AND created_at >= (
    SELECT countdown_started_at 
    FROM tournament_matches 
    WHERE id = p_match_id
  );

  IF v_player1_max_word_score > v_player2_max_word_score THEN
    RETURN p_player1_id;
  ELSIF v_player2_max_word_score > v_player1_max_word_score THEN
    RETURN p_player2_id;
  END IF;

  -- Kriter 2: En uzun kelime uzunluğu
  SELECT COALESCE(MAX(LENGTH(word)), 0) INTO v_player1_longest_word
  FROM game_words
  WHERE player_id = p_player1_id::uuid
  AND created_at >= (
    SELECT countdown_started_at 
    FROM tournament_matches 
    WHERE id = p_match_id
  );

  SELECT COALESCE(MAX(LENGTH(word)), 0) INTO v_player2_longest_word
  FROM game_words
  WHERE player_id = p_player2_id::uuid
  AND created_at >= (
    SELECT countdown_started_at 
    FROM tournament_matches 
    WHERE id = p_match_id
  );

  IF v_player1_longest_word > v_player2_longest_word THEN
    RETURN p_player1_id;
  ELSIF v_player2_longest_word > v_player1_longest_word THEN
    RETURN p_player2_id;
  END IF;

  -- Kriter 3: Toplam kelime sayısı
  SELECT COUNT(*) INTO v_player1_word_count
  FROM game_words
  WHERE player_id = p_player1_id::uuid
  AND created_at >= (
    SELECT countdown_started_at 
    FROM tournament_matches 
    WHERE id = p_match_id
  );

  SELECT COUNT(*) INTO v_player2_word_count
  FROM game_words
  WHERE player_id = p_player2_id::uuid
  AND created_at >= (
    SELECT countdown_started_at 
    FROM tournament_matches 
    WHERE id = p_match_id
  );

  IF v_player1_word_count > v_player2_word_count THEN
    RETURN p_player1_id;
  ELSIF v_player2_word_count > v_player1_word_count THEN
    RETURN p_player2_id;
  END IF;

  -- Kriter 4: İlk kelimeyi oluşturma hızı (en hızlı kazanır)
  SELECT MIN(created_at) INTO v_player1_first_word_time
  FROM game_words
  WHERE player_id = p_player1_id::uuid
  AND created_at >= (
    SELECT countdown_started_at 
    FROM tournament_matches 
    WHERE id = p_match_id
  );

  SELECT MIN(created_at) INTO v_player2_first_word_time
  FROM game_words
  WHERE player_id = p_player2_id::uuid
  AND created_at >= (
    SELECT countdown_started_at 
    FROM tournament_matches 
    WHERE id = p_match_id
  );

  IF v_player1_first_word_time IS NOT NULL AND v_player2_first_word_time IS NOT NULL THEN
    IF v_player1_first_word_time < v_player2_first_word_time THEN
      RETURN p_player1_id;
    ELSIF v_player2_first_word_time < v_player1_first_word_time THEN
      RETURN p_player2_id;
    END IF;
  ELSIF v_player1_first_word_time IS NOT NULL THEN
    RETURN p_player1_id;
  ELSIF v_player2_first_word_time IS NOT NULL THEN
    RETURN p_player2_id;
  END IF;

  -- Eğer tüm kriterler eşitse, rastgele seç
  IF RANDOM() > 0.5 THEN
    RETURN p_player1_id;
  ELSE
    RETURN p_player2_id;
  END IF;
END;
$$;