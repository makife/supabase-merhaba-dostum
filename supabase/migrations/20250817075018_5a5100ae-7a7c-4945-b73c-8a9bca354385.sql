-- Fix the start_tournament_automatically function to handle bot participants correctly
CREATE OR REPLACE FUNCTION public.start_tournament_automatically(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_participants uuid[];
  v_participant_count integer;
  v_bots_needed integer;
  v_tournament tournaments%ROWTYPE;
  v_bot_participant_record RECORD;
BEGIN
  -- Get tournament info
  SELECT * INTO v_tournament
  FROM tournaments 
  WHERE id = p_tournament_id;
  
  IF v_tournament.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tournament not found');
  END IF;
  
  IF v_tournament.status != 'waiting' THEN
    RETURN json_build_object('success', false, 'error', 'Tournament already started');
  END IF;

  -- Get real participants (users only)
  SELECT COUNT(*) 
  INTO v_participant_count
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id
  AND user_id IS NOT NULL;
  
  -- Add bots (complete to 8 participants)
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
        NULL, -- NULL for bots
        v_participant_count + i,
        true,
        now()
      );
    END LOOP;
  END IF;
  
  -- Get all participants in order (real users and bots)
  SELECT array_agg(
    CASE 
      WHEN user_id IS NOT NULL THEN user_id 
      ELSE id -- Use the participant record ID for bots
    END 
    ORDER BY seed
  ) INTO v_participants
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id;
  
  -- Create first round matches (8 participants -> 4 matches)
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
      v_participants[i * 2 - 1],
      v_participants[i * 2],
      'pending',
      now()
    );
  END LOOP;
  
  -- Start tournament
  UPDATE tournaments 
  SET 
    status = 'active',
    started_at = now(),
    current_round = 1
  WHERE id = p_tournament_id;
  
  RETURN json_build_object(
    'success', true,
    'matches_created', 4,
    'participants', 8
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;