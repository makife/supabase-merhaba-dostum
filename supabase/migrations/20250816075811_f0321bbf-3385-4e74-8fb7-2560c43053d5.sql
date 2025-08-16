-- Re-add foreign keys with NULL-friendly behavior and fix tournament functions to not assign fake UUIDs for bots

-- 1) Re-add FK on tournament_participants.user_id -> profiles.id (nullable allowed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'tournament_participants' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'tournament_participants_user_id_fkey') THEN
    ALTER TABLE public.tournament_participants
    ADD CONSTRAINT tournament_participants_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2) Re-add FKs on tournament_matches player1_id, player2_id, winner_id -> profiles.id (nullable allowed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'tournament_matches' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'tournament_matches_player1_id_fkey') THEN
    ALTER TABLE public.tournament_matches
    ADD CONSTRAINT tournament_matches_player1_id_fkey
    FOREIGN KEY (player1_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'tournament_matches' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'tournament_matches_player2_id_fkey') THEN
    ALTER TABLE public.tournament_matches
    ADD CONSTRAINT tournament_matches_player2_id_fkey
    FOREIGN KEY (player2_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'tournament_matches' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name = 'tournament_matches_winner_id_fkey') THEN
    ALTER TABLE public.tournament_matches
    ADD CONSTRAINT tournament_matches_winner_id_fkey
    FOREIGN KEY (winner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Update functions to avoid generating fake UUIDs for bots; use NULL for bot user_id and propagate NULLs to matches
CREATE OR REPLACE FUNCTION public.start_tournament_with_bracket(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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
        NULL, -- NULL for bot user_id
        COALESCE(v_participant_count,0) + i,
        true,
        now()
      );
    END LOOP;
  END IF;

  -- Rebuild ordered participant array including bots (NULLs for bots)
  SELECT array_agg(user_id ORDER BY seed) INTO v_participants
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
      player1_score,
      player2_score,
      status,
      created_at,
      updated_at
    ) VALUES (
      p_tournament_id,
      1,
      i,
      v_participants[i * 2 - 1],  -- may be NULL if bot
      v_participants[i * 2],      -- may be NULL if bot
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

CREATE OR REPLACE FUNCTION public.start_tournament_automatically(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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

  -- Count humans
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

  -- Build ordered participants including bots
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

CREATE OR REPLACE FUNCTION public.create_matches_for_active_tournament(p_tournament_id uuid)
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
  v_existing_matches integer;
BEGIN
  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id;
  IF v_tournament.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  SELECT COUNT(*) INTO v_existing_matches FROM tournament_matches WHERE tournament_id = p_tournament_id;
  IF v_existing_matches > 0 THEN
    RETURN json_build_object('success', false, 'error', 'Matches already exist');
  END IF;

  SELECT COUNT(*) INTO v_participant_count
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id AND user_id IS NOT NULL;

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
  SET status = 'active', current_round = 1
  WHERE id = p_tournament_id;

  RETURN json_build_object('success', true, 'matches_created', 4, 'participants', 8);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;