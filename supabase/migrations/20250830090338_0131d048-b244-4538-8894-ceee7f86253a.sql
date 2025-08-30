-- Align tournament finalization status and winner tracking
CREATE OR REPLACE FUNCTION public.complete_tournament_match(p_match_id uuid, p_winner_id uuid, p_player1_score integer, p_player2_score integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_tournament_id uuid;
  v_current_round integer;
  v_match_round integer;
  v_loser_id uuid;
  v_tournament_status text;
  v_current_round_matches integer;
  v_completed_matches integer;
  v_next_round integer;
  v_winners uuid[];
BEGIN
  -- Fetch match info
  SELECT tournament_id, round INTO v_tournament_id, v_match_round
  FROM tournament_matches 
  WHERE id = p_match_id;
  
  IF v_tournament_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Match not found');
  END IF;
  
  -- Fetch tournament status/round
  SELECT status, current_round INTO v_tournament_status, v_current_round
  FROM tournaments 
  WHERE id = v_tournament_id;
  
  -- Complete match
  UPDATE tournament_matches 
  SET 
    status = 'completed',
    winner_id = p_winner_id,
    player1_score = p_player1_score,
    player2_score = p_player2_score,
    updated_at = now()
  WHERE id = p_match_id;
  
  -- Mark loser eliminated
  SELECT 
    CASE WHEN player1_id = p_winner_id THEN player2_id ELSE player1_id END 
  INTO v_loser_id
  FROM tournament_matches 
  WHERE id = p_match_id;
  
  IF v_loser_id IS NOT NULL THEN
    UPDATE tournament_participants 
    SET eliminated_at = now()
    WHERE tournament_id = v_tournament_id 
      AND user_id = v_loser_id;
  END IF;
  
  -- Count matches
  SELECT COUNT(*) INTO v_current_round_matches
  FROM tournament_matches 
  WHERE tournament_id = v_tournament_id 
    AND round = v_current_round;
  
  SELECT COUNT(*) INTO v_completed_matches
  FROM tournament_matches 
  WHERE tournament_id = v_tournament_id 
    AND round = v_current_round 
    AND status = 'completed';
  
  -- If all matches of current round are done, prepare next round
  IF v_completed_matches = v_current_round_matches THEN
    v_next_round := v_current_round + 1;
    
    -- Final passed -> finish tournament
    IF v_next_round > 3 THEN
      UPDATE tournaments 
      SET 
        status = 'completed',          -- was 'finished'
        winner_id = p_winner_id,       -- ensure winner is set
        finished_at = now(),
        updated_at = now()
      WHERE id = v_tournament_id;
      
      RETURN json_build_object(
        'success', true, 
        'tournament_finished', true,
        'winner_id', p_winner_id
      );
    END IF;
    
    -- Collect winners of current round
    SELECT array_agg(winner_id ORDER BY match_number) INTO v_winners
    FROM tournament_matches 
    WHERE tournament_id = v_tournament_id 
      AND round = v_current_round 
      AND status = 'completed'
      AND winner_id IS NOT NULL;
    
    -- Create next round matches (pair 1-2, 3-4, ...)
    IF array_length(v_winners, 1) >= 2 THEN
      FOR i IN 1..array_length(v_winners, 1) BY 2 LOOP
        IF v_winners[i + 1] IS NOT NULL THEN
          INSERT INTO tournament_matches (
            tournament_id,
            round,
            match_number,
            player1_id,
            player2_id,
            player1_score,
            player2_score,
            status,
            created_at,
            updated_at
          ) VALUES (
            v_tournament_id,
            v_next_round,
            (i + 1) / 2,
            v_winners[i],
            v_winners[i + 1],
            0,
            0,
            'pending',
            now(),
            now()
          );
        END IF;
      END LOOP;
      
      -- Update tournament round
      UPDATE tournaments 
      SET current_round = v_next_round,
          updated_at = now()
      WHERE id = v_tournament_id;
    END IF;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'next_round_created', v_completed_matches = v_current_round_matches,
    'next_round', v_next_round,
    'tournament_finished', false
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;