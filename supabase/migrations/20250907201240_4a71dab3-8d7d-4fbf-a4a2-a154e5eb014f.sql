-- Fix bot user_id generation in start_tournament_with_bracket function
CREATE OR REPLACE FUNCTION public.start_tournament_with_bracket(p_tournament_id uuid)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_participants text[];
  v_participant_count integer;
  v_bots_needed integer;
  v_existing_matches integer;
  v_tournament tournaments%ROWTYPE;
  v_round1_matches INTEGER;
  v_round2_matches INTEGER;
  v_round3_matches INTEGER;
BEGIN
  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id;
  IF v_tournament.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  SELECT COUNT(*) INTO v_existing_matches FROM tournament_matches WHERE tournament_id = p_tournament_id;
  IF v_existing_matches > 0 THEN
    RETURN json_build_object('success', false, 'error', 'Matches already exist');
  END IF;

  -- Count real participants
  SELECT COUNT(*) INTO v_participant_count
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id
    AND user_id IS NOT NULL;
  
  -- Add bots to reach 8
  v_bots_needed := 8 - v_participant_count;
  IF v_bots_needed > 0 THEN
    FOR i IN 1..v_bots_needed LOOP
      INSERT INTO tournament_participants (
        tournament_id,
        user_id,
        seed,
        is_bot,
        joined_at
      ) VALUES (
        p_tournament_id,
        ('bot_' || p_tournament_id || '_' || i)::text,
        v_participant_count + i,
        true,
        now()
      );
    END LOOP;
  END IF;

  -- Calculate match counts (always 8 participants after bot fill)
  v_round1_matches := 8 / 2;  -- 4 matches
  v_round2_matches := v_round1_matches / 2;  -- 2 matches  
  v_round3_matches := v_round2_matches / 2;  -- 1 match

  -- Build participants array (as text, not uuid)
  SELECT array_agg(user_id ORDER BY seed) INTO v_participants
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id;
  
  -- Create Round 1 matches dynamically
  FOR i IN 1..v_round1_matches LOOP
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
      p_tournament_id,
      1,
      i,
      v_participants[i * 2 - 1],
      v_participants[i * 2],
      0,
      0,
      'pending',
      now(),
      now()
    );
  END LOOP;

  -- Create Round 2 matches dynamically
  FOR i IN 1..v_round2_matches LOOP
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
      p_tournament_id,
      2,
      i,
      NULL,
      NULL,
      0,
      0,
      'pending',
      now(),
      now()
    );
  END LOOP;

  -- Create Round 3 matches dynamically  
  FOR i IN 1..v_round3_matches LOOP
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
      p_tournament_id,
      3,
      i,
      NULL,
      NULL,
      0,
      0,
      'pending',
      now(),
      now()
    );
  END LOOP;

  UPDATE tournaments 
  SET status = 'in_progress', started_at = now(), current_round = 1, updated_at = now()
  WHERE id = p_tournament_id;

  RETURN json_build_object(
    'success', true, 
    'total_matches_created', v_round1_matches + v_round2_matches + v_round3_matches,
    'participants', 8,
    'round1_matches', v_round1_matches,
    'round2_matches', v_round2_matches,
    'round3_matches', v_round3_matches
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;