
CREATE OR REPLACE FUNCTION start_tournament_with_bots_v2(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count int;
  v_bots_needed int;
  v_real_players int;
  v_next_round_starts_at timestamptz;
  v_participants jsonb;
  v_i int;
BEGIN
  -- 1. Mevcut katılımcı sayısını al
  SELECT COUNT(*) INTO v_current_count
  FROM tournament_participants
  WHERE tournament_id = p_tournament_id;
  
  -- Gerçek oyuncu sayısı
  SELECT COUNT(*) INTO v_real_players
  FROM tournament_participants
  WHERE tournament_id = p_tournament_id AND is_bot = false;
  
  -- En az 2 gerçek oyuncu olmalı
  IF v_real_players < 2 THEN
    UPDATE tournaments SET status = 'cancelled' WHERE id = p_tournament_id;
    RETURN jsonb_build_object('success', false, 'error', 'Yeterli oyuncu yok (en az 2 gerekli)');
  END IF;
  
  -- 2. Bot ekle (8'e tamamla)
  v_bots_needed := 8 - v_current_count;
  
  IF v_bots_needed > 0 THEN
    FOR v_i IN 1..v_bots_needed LOOP
      INSERT INTO tournament_participants (tournament_id, user_id, is_bot)
      VALUES (p_tournament_id, gen_random_uuid(), true);
    END LOOP;
  END IF;
  
  -- 3. Katılımcıları al
  SELECT jsonb_agg(row_to_json(tp.*) ORDER BY tp.joined_at)
  INTO v_participants
  FROM tournament_participants tp
  WHERE tp.tournament_id = p_tournament_id;
  
  -- 4. Çeyrek final maçlarını oluştur
  INSERT INTO tournament_matches (tournament_id, round, match_number, player1_id, player2_id, status, player1_score, player2_score)
  SELECT 
    p_tournament_id,
    1,
    match_num,
    (v_participants->((match_num-1)*2)->>'user_id')::uuid,
    (v_participants->((match_num-1)*2+1)->>'user_id')::uuid,
    'pending',
    0,
    0
  FROM generate_series(1, 4) AS match_num;
  
  -- 5. Turnuva durumunu güncelle
  v_next_round_starts_at := now() + interval '10 seconds';
  
  UPDATE tournaments
  SET 
    status = 'in_progress',
    current_round = 1,
    started_at = now(),
    next_round_starts_at = v_next_round_starts_at
  WHERE id = p_tournament_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'bots_added', v_bots_needed,
    'real_players', v_real_players,
    'next_round_starts_at', v_next_round_starts_at
  );
END;
$$;
