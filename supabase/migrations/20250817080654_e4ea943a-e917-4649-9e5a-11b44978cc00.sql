-- Fix FK violations by ensuring tournament_matches.player* fields hold user IDs for real users and NULL for bots
-- Update functions to never generate random UUIDs for bots in match slots

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

  -- Count real participants (users only)
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
  
  -- Build ordered list of player IDs for matches: user_id for humans, NULL for bots
  SELECT array_agg(
    CASE 
      WHEN user_id IS NOT NULL THEN user_id 
      ELSE NULL 
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

-- Align start_tournament_with_bracket to the same behavior
CREATE OR REPLACE FUNCTION public.start_tournament_with_bracket(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_participants uuid[];
  v_participant_count integer;
  v_bots_needed integer;
BEGIN
  -- Count real participants
  SELECT COUNT(*) 
  INTO v_participant_count
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
        NULL,
        v_participant_count + i,
        true,
        now()
      );
    END LOOP;
  END IF;

  -- Ordered list of user IDs; bots become NULLs
  SELECT array_agg(
    CASE WHEN user_id IS NOT NULL THEN user_id ELSE NULL END 
    ORDER BY seed
  ) INTO v_participants
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id;
  
  -- Create first round (4 matches)
  FOR i IN 1..4 LOOP
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

  -- Activate tournament
  UPDATE tournaments 
  SET status = 'active', started_at = now(), current_round = 1
  WHERE id = p_tournament_id;

  RETURN json_build_object('success', true, 'matches_created', 4, 'participants', 8);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Align create_matches_for_active_tournament as well
CREATE OR REPLACE FUNCTION public.create_matches_for_active_tournament(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_participants uuid[];
  v_participant_count integer;
  v_bots_needed integer;
  v_tournament tournaments%ROWTYPE;
  v_existing_matches integer;
BEGIN
  -- Validate
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
  
  -- Add bots
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
        NULL,
        v_participant_count + i,
        true,
        now()
      );
    END LOOP;
  END IF;
  
  -- Build players array (user IDs or NULL)
  SELECT array_agg(
    CASE WHEN user_id IS NOT NULL THEN user_id ELSE NULL END 
    ORDER BY seed
  ) INTO v_participants
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id;
  
  -- Create round 1 matches
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
  
  -- Keep tournament active
  UPDATE tournaments SET status = 'active', current_round = 1 WHERE id = p_tournament_id;
  
  RETURN json_build_object('success', true, 'matches_created', 4, 'participants', 8);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;