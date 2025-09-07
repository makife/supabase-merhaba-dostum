-- Update start_tournament_automatically to avoid creating placeholder rounds and require >=2 real players
CREATE OR REPLACE FUNCTION public.start_tournament_automatically(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_tournament tournaments%ROWTYPE;
    v_participant_count INTEGER;
    v_real_player_count INTEGER;
    v_bot_count INTEGER;
    v_round1_matches INTEGER;
BEGIN
    -- Fetch tournament
    SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id;
    IF v_tournament.id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Tournament not found');
    END IF;

    IF v_tournament.status <> 'waiting' THEN
        RETURN json_build_object('success', false, 'error', 'Tournament already started');
    END IF;
    
    -- Count real players
    SELECT COUNT(*) INTO v_real_player_count 
    FROM tournament_participants 
    WHERE tournament_id = p_tournament_id 
      AND user_id IS NOT NULL 
      AND is_bot = false;
    
    -- Require at least 2 real players so others can join before start
    IF v_real_player_count < 2 THEN
        RETURN json_build_object('success', false, 'error', 'At least 2 real players required');
    END IF;
    
    -- Fill with bots to 8 total participants
    SELECT COUNT(*) INTO v_participant_count FROM tournament_participants WHERE tournament_id = p_tournament_id;
    v_bot_count := 8 - v_participant_count;
    IF v_bot_count > 0 THEN
        FOR i IN 1..v_bot_count LOOP
            INSERT INTO tournament_participants (tournament_id, user_id, seed, is_bot, joined_at)
            VALUES (
                p_tournament_id,
                ('bot_' || p_tournament_id || '_' || i),
                v_participant_count + i,
                true,
                now()
            );
        END LOOP;
    END IF;
    
    -- Create round 1 matches only (no placeholders for later rounds)
    WITH participants_ordered AS (
        SELECT user_id, seed, ROW_NUMBER() OVER (ORDER BY seed) as rn
        FROM tournament_participants 
        WHERE tournament_id = p_tournament_id
        ORDER BY seed
    )
    INSERT INTO tournament_matches (
      tournament_id, round, match_number, player1_id, player2_id, player1_score, player2_score, status, created_at, updated_at
    )
    SELECT 
      p_tournament_id,
      1,
      CEIL(p1.rn / 2.0)::INTEGER,
      p1.user_id,
      p2.user_id,
      0,
      0,
      'pending',
      now(),
      now()
    FROM participants_ordered p1
    JOIN participants_ordered p2 ON p2.rn = p1.rn + 1
    WHERE p1.rn % 2 = 1;
    
    UPDATE tournaments 
    SET status = 'in_progress', started_at = NOW(), current_round = 1, updated_at = NOW()
    WHERE id = p_tournament_id;
    
    -- Return summary
    SELECT COUNT(*) INTO v_round1_matches FROM tournament_matches WHERE tournament_id = p_tournament_id AND round = 1;
    RETURN json_build_object(
        'success', true,
        'real_players', v_real_player_count,
        'bots_added', GREATEST(v_bot_count, 0),
        'round1_matches', v_round1_matches
    );
EXCEPTION 
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;