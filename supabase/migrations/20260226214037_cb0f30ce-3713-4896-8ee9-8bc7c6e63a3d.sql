
DROP FUNCTION IF EXISTS public.advance_tournament_round(uuid);

CREATE OR REPLACE FUNCTION public.advance_tournament_round(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_round integer;
  v_next_round integer;
  v_expected integer;
  v_completed_count integer;
  v_existing_next integer;
  v_winners uuid[];
  v_i integer;
  v_next_round_starts timestamptz;
BEGIN
  SELECT current_round INTO v_current_round
  FROM tournaments
  WHERE id = p_tournament_id AND status = 'in_progress';
  
  IF v_current_round IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not found or not in progress');
  END IF;
  
  v_next_round := v_current_round + 1;
  
  SELECT count(*) INTO v_existing_next
  FROM tournament_matches
  WHERE tournament_id = p_tournament_id AND round = v_next_round;
  
  IF v_existing_next > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Next round already exists');
  END IF;
  
  v_expected := CASE v_current_round
    WHEN 1 THEN 4
    WHEN 2 THEN 2
    WHEN 3 THEN 1
    ELSE 0
  END;
  
  SELECT count(*) INTO v_completed_count
  FROM tournament_matches
  WHERE tournament_id = p_tournament_id
    AND round = v_current_round
    AND status = 'completed';
  
  IF v_completed_count < v_expected THEN
    RETURN jsonb_build_object('success', false, 'error', 'Round not yet complete', 'completed', v_completed_count, 'expected', v_expected);
  END IF;
  
  IF v_current_round >= 3 THEN
    UPDATE tournaments
    SET status = 'completed', finished_at = now()
    WHERE id = p_tournament_id;
    
    RETURN jsonb_build_object('success', true, 'action', 'tournament_completed');
  END IF;
  
  SELECT array_agg(winner_id ORDER BY match_number) INTO v_winners
  FROM tournament_matches
  WHERE tournament_id = p_tournament_id
    AND round = v_current_round
    AND status = 'completed';
  
  v_i := 1;
  WHILE v_i <= array_length(v_winners, 1) - 1 LOOP
    INSERT INTO tournament_matches (tournament_id, round, match_number, player1_id, player2_id, status, player1_score, player2_score)
    VALUES (p_tournament_id, v_next_round, (v_i + 1) / 2, v_winners[v_i], v_winners[v_i + 1], 'pending', 0, 0);
    v_i := v_i + 2;
  END LOOP;
  
  v_next_round_starts := now() + interval '10 seconds';
  UPDATE tournaments
  SET current_round = v_next_round,
      next_round_starts_at = v_next_round_starts
  WHERE id = p_tournament_id;
  
  RETURN jsonb_build_object('success', true, 'action', 'advanced', 'new_round', v_next_round);
END;
$$;
