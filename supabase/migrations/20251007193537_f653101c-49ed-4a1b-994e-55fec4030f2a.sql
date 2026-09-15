-- Fix tournament status and user_id type mismatch
-- Update the create_matches_for_active_tournament function to set status to 'in_progress'
CREATE OR REPLACE FUNCTION public.create_matches_for_active_tournament(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_participant_count integer;
  v_bots_needed integer;
  v_tournament tournaments%ROWTYPE;
  v_existing_matches integer;
  v_participant_ids text[];
BEGIN
  -- Validate tournament exists
  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id;
  IF v_tournament.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  -- Check if matches already exist
  SELECT COUNT(*) INTO v_existing_matches FROM tournament_matches WHERE tournament_id = p_tournament_id;
  IF v_existing_matches > 0 THEN
    RETURN json_build_object('success', false, 'error', 'Matches already exist');
  END IF;

  -- Count real participants (user_id is TEXT, not UUID)
  SELECT COUNT(*) INTO v_participant_count
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id
  AND is_bot = false;
  
  -- Add bots if needed to reach 8 players
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
        'bot_' || gen_random_uuid()::text,
        v_participant_count + i,
        true,
        now()
      );
    END LOOP;
  END IF;
  
  -- Build players array (user_ids as TEXT)
  SELECT array_agg(user_id ORDER BY seed) INTO v_participant_ids
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id;
  
  -- Create round 1 matches (Quarterfinals - 4 matches for 8 players)
  FOR i IN 1..4 LOOP
    INSERT INTO tournament_matches (
      tournament_id,
      round,
      match_number,
      player1_id,
      player2_id,
      status,
      created_at
    ) VALUES (
      p_tournament_id,
      1,
      i,
      v_participant_ids[i * 2 - 1],
      v_participant_ids[i * 2],
      'pending',
      now()
    );
  END LOOP;
  
  -- Set tournament status to 'in_progress' (not 'active')
  UPDATE tournaments 
  SET status = 'in_progress', 
      current_round = 1,
      started_at = now()
  WHERE id = p_tournament_id;
  
  RETURN json_build_object('success', true, 'matches_created', 4, 'participants', 8);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;