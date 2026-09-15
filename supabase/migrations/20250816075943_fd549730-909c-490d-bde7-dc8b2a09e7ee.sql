-- Güvenlik uyarılarını düzelt: Fonksiyonlara search_path ekle

-- 1) start_tournament_with_bracket fonksiyonu
CREATE OR REPLACE FUNCTION public.start_tournament_with_bracket(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_participants uuid[];
  v_participant_count integer;
  v_bots_needed integer;
  v_match_number integer := 1;
BEGIN
  -- Get current human participants
  SELECT array_agg(user_id ORDER BY seed), COUNT(*) 
  INTO v_participants, v_participant_count
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id
  AND user_id IS NOT NULL;

  -- Add bots (complete to 8 participants)
  v_bots_needed := 8 - COALESCE(v_participant_count, 0);
  IF v_bots_needed > 0 THEN
    FOR i IN 1..v_bots_needed LOOP
      INSERT INTO tournament_participants (
        tournament_id,
        user_id,
        seed,
        is_bot,
        created_at
      ) VALUES (
        p_tournament_id,
        NULL,
        COALESCE(v_participant_count,0) + i,
        true,
        now()
      );
    END LOOP;
  END IF;

  -- Get all participants including bots
  SELECT array_agg(user_id ORDER BY seed) INTO v_participants
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id;

  -- Create first round matches
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
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 2) start_tournament_automatically fonksiyonu
CREATE OR REPLACE FUNCTION public.start_tournament_automatically(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_participants uuid[];
  v_participant_count integer;
  v_bots_needed integer;
  v_tournament tournaments%ROWTYPE;
BEGIN
  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id;
  IF v_tournament.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tournament not found');
  END IF;
  IF v_tournament.status != 'waiting' THEN
    RETURN json_build_object('success', false, 'error', 'Tournament already started');
  END IF;

  SELECT COUNT(*) INTO v_participant_count
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id
    AND user_id IS NOT NULL;

  v_bots_needed := 8 - COALESCE(v_participant_count, 0);
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
        COALESCE(v_participant_count,0) + i,
        true,
        now()
      );
    END LOOP;
  END IF;

  SELECT array_agg(user_id ORDER BY seed) INTO v_participants
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id;

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

  UPDATE tournaments 
  SET status = 'active', started_at = now(), current_round = 1
  WHERE id = p_tournament_id;

  RETURN json_build_object('success', true, 'matches_created', 4, 'participants', 8);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 3) get_tournament_status fonksiyonu
CREATE OR REPLACE FUNCTION public.get_tournament_status(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tournament tournaments%ROWTYPE;
  v_total_matches integer;
  v_completed_matches integer;
  v_active_matches integer;
  v_remaining_players integer;
  v_result json;
BEGIN
  SELECT * INTO v_tournament
  FROM tournaments 
  WHERE id = p_tournament_id;
  
  IF v_tournament.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tournament not found');
  END IF;
  
  SELECT 
    COUNT(*),
    COUNT(CASE WHEN status = 'completed' THEN 1 END),
    COUNT(CASE WHEN status = 'active' THEN 1 END)
  INTO v_total_matches, v_completed_matches, v_active_matches
  FROM tournament_matches 
  WHERE tournament_id = p_tournament_id;
  
  SELECT COUNT(*)
  INTO v_remaining_players
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id 
  AND eliminated_at IS NULL;
  
  RETURN json_build_object(
    'success', true,
    'tournament', row_to_json(v_tournament),
    'total_matches', v_total_matches,
    'completed_matches', v_completed_matches,
    'active_matches', v_active_matches,
    'remaining_players', v_remaining_players
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 4) get_user_tournament_status fonksiyonu
CREATE OR REPLACE FUNCTION public.get_user_tournament_status(p_tournament_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_participant tournament_participants%ROWTYPE;
  v_current_match tournament_matches%ROWTYPE;
  v_next_match tournament_matches%ROWTYPE;
  v_user_matches json[];
  v_result json;
BEGIN
  SELECT * INTO v_participant
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id 
  AND user_id = p_user_id;
  
  IF v_participant.id IS NULL THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'User not in tournament'
    );
  END IF;
  
  SELECT * INTO v_current_match
  FROM tournament_matches 
  WHERE tournament_id = p_tournament_id
  AND (player1_id = p_user_id OR player2_id = p_user_id)
  AND status = 'active'
  LIMIT 1;
  
  SELECT * INTO v_next_match
  FROM tournament_matches 
  WHERE tournament_id = p_tournament_id
  AND (player1_id = p_user_id OR player2_id = p_user_id)
  AND status = 'pending'
  ORDER BY round, match_number
  LIMIT 1;
  
  SELECT array_agg(row_to_json(tm)) INTO v_user_matches
  FROM tournament_matches tm
  WHERE tm.tournament_id = p_tournament_id
  AND (tm.player1_id = p_user_id OR tm.player2_id = p_user_id)
  ORDER BY tm.round, tm.match_number;
  
  RETURN json_build_object(
    'success', true,
    'participant', row_to_json(v_participant),
    'current_match', row_to_json(v_current_match),
    'next_match', row_to_json(v_next_match),
    'all_matches', v_user_matches,
    'is_eliminated', v_participant.eliminated_at IS NOT NULL
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 5) complete_tournament_match fonksiyonu
CREATE OR REPLACE FUNCTION public.complete_tournament_match(p_match_id uuid, p_winner_id uuid, p_player1_score integer, p_player2_score integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  v_next_match_data json[];
  v_result json;
BEGIN
  SELECT tournament_id, round INTO v_tournament_id, v_match_round
  FROM tournament_matches 
  WHERE id = p_match_id;
  
  IF v_tournament_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Match not found');
  END IF;
  
  SELECT status, current_round INTO v_tournament_status, v_current_round
  FROM tournaments 
  WHERE id = v_tournament_id;
  
  UPDATE tournament_matches 
  SET 
    status = 'completed',
    winner_id = p_winner_id,
    player1_score = p_player1_score,
    player2_score = p_player2_score,
    updated_at = now()
  WHERE id = p_match_id;
  
  SELECT 
    CASE 
      WHEN player1_id = p_winner_id THEN player2_id 
      ELSE player1_id 
    END INTO v_loser_id
  FROM tournament_matches 
  WHERE id = p_match_id;
  
  IF v_loser_id IS NOT NULL THEN
    UPDATE tournament_participants 
    SET eliminated_at = now()
    WHERE tournament_id = v_tournament_id 
    AND user_id = v_loser_id;
  END IF;
  
  SELECT 
    COUNT(*) INTO v_current_round_matches
  FROM tournament_matches 
  WHERE tournament_id = v_tournament_id 
  AND round = v_current_round;
  
  SELECT 
    COUNT(*) INTO v_completed_matches
  FROM tournament_matches 
  WHERE tournament_id = v_tournament_id 
  AND round = v_current_round 
  AND status = 'completed';
  
  IF v_completed_matches = v_current_round_matches THEN
    v_next_round := v_current_round + 1;
    
    IF v_next_round > 3 THEN
      UPDATE tournaments 
      SET 
        status = 'finished',
        finished_at = now()
      WHERE id = v_tournament_id;
      
      RETURN json_build_object(
        'success', true, 
        'tournament_finished', true,
        'winner_id', p_winner_id
      );
    END IF;
    
    SELECT array_agg(winner_id ORDER BY match_number) INTO v_winners
    FROM tournament_matches 
    WHERE tournament_id = v_tournament_id 
    AND round = v_current_round 
    AND status = 'completed'
    AND winner_id IS NOT NULL;
    
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
      
      UPDATE tournaments 
      SET current_round = v_next_round
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
    RETURN json_build_object(
      'success', false, 
      'error', SQLERRM
    );
END;
$$;