-- Turnuva maçı beraberlik durumunda tiebreaker kriterleriyle kazananı belirleyen fonksiyon
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

  -- Eğer tüm kriterler eşitse, rastgele seç (çok nadir durum)
  IF RANDOM() > 0.5 THEN
    RETURN p_player1_id;
  ELSE
    RETURN p_player2_id;
  END IF;
END;
$$;

-- complete_tournament_match_with_advance fonksiyonunu güncelle - tiebreaker kullan
CREATE OR REPLACE FUNCTION complete_tournament_match_with_advance(
  p_match_id uuid,
  p_player1_score integer,
  p_player2_score integer,
  p_winner_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match record;
  v_tournament record;
  v_actual_winner_id text;
  v_result json;
BEGIN
  -- Maç bilgilerini al
  SELECT * INTO v_match
  FROM tournament_matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Turnuva bilgilerini al
  SELECT * INTO v_tournament
  FROM tournaments
  WHERE id = v_match.tournament_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  -- Tiebreaker ile gerçek kazananı belirle
  v_actual_winner_id := determine_tournament_winner_with_tiebreaker(
    p_match_id,
    v_match.player1_id,
    v_match.player2_id,
    p_player1_score,
    p_player2_score
  );

  -- Maçı güncelle
  UPDATE tournament_matches
  SET
    player1_score = p_player1_score,
    player2_score = p_player2_score,
    winner_id = v_actual_winner_id,
    status = 'completed',
    updated_at = now()
  WHERE id = p_match_id;

  -- Bir sonraki round'a geçiş kontrolü
  PERFORM check_and_advance_tournament_round(v_match.tournament_id, v_match.round);

  v_result := json_build_object(
    'success', true,
    'match_id', p_match_id,
    'winner_id', v_actual_winner_id,
    'player1_score', p_player1_score,
    'player2_score', p_player2_score
  );

  RETURN v_result;
END;
$$;

-- Round tamamlandığında bir sonraki round'u başlatan yardımcı fonksiyon
CREATE OR REPLACE FUNCTION check_and_advance_tournament_round(
  p_tournament_id uuid,
  p_current_round integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_matches_in_round integer;
  v_completed_matches integer;
  v_next_round_exists boolean;
BEGIN
  -- Bu round'daki toplam maç sayısı
  SELECT COUNT(*) INTO v_total_matches_in_round
  FROM tournament_matches
  WHERE tournament_id = p_tournament_id
  AND round = p_current_round;

  -- Bu round'daki tamamlanan maç sayısı
  SELECT COUNT(*) INTO v_completed_matches
  FROM tournament_matches
  WHERE tournament_id = p_tournament_id
  AND round = p_current_round
  AND status = 'completed'
  AND winner_id IS NOT NULL;

  -- Eğer tüm maçlar tamamlandıysa
  IF v_completed_matches = v_total_matches_in_round THEN
    -- Bir sonraki round var mı kontrol et
    SELECT EXISTS(
      SELECT 1 FROM tournament_matches
      WHERE tournament_id = p_tournament_id
      AND round = p_current_round + 1
    ) INTO v_next_round_exists;

    -- Eğer bir sonraki round varsa, onları pending yap
    IF v_next_round_exists THEN
      UPDATE tournament_matches
      SET status = 'pending'
      WHERE tournament_id = p_tournament_id
      AND round = p_current_round + 1;
    ELSE
      -- Final tamamlandı, turnuvayı bitir
      IF p_current_round = 3 THEN
        UPDATE tournaments
        SET 
          status = 'completed',
          finished_at = now(),
          updated_at = now()
        WHERE id = p_tournament_id;
      END IF;
    END IF;
  END IF;
END;
$$;