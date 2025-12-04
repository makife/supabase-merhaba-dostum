-- Fix advance_tournament_round to only advance when ALL matches are truly completed
DROP FUNCTION IF EXISTS public.advance_tournament_round(uuid);

CREATE OR REPLACE FUNCTION public.advance_tournament_round(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_current_round int;
    v_total_matches int;
    v_completed_matches int;
    v_matches jsonb[];
    v_winners uuid[];
    i int;
    v_winner_id uuid;
    v_p1_id uuid;
    v_p2_id uuid;
    v_next_round_exists boolean;
    v_next_p1_is_bot boolean;
    v_next_p2_is_bot boolean;
    v_next_status text;
    v_next_p1_score int;
    v_next_p2_score int;
    v_next_winner_id uuid;
BEGIN
    -- Get current round
    SELECT current_round INTO v_current_round
    FROM public.tournaments
    WHERE id = p_tournament_id;

    IF v_current_round IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Tournament not found');
    END IF;

    -- Check if next round already exists
    SELECT EXISTS (
        SELECT 1 FROM public.tournament_matches
        WHERE tournament_id = p_tournament_id AND round = v_current_round + 1
    ) INTO v_next_round_exists;

    IF v_next_round_exists THEN
        RETURN json_build_object('success', false, 'error', 'Next round already exists');
    END IF;

    -- Final completed - tournament is done
    IF v_current_round >= 3 THEN
        UPDATE public.tournaments
        SET status = 'completed', finished_at = NOW()
        WHERE id = p_tournament_id AND status != 'completed';
        RETURN json_build_object('success', true, 'message', 'Tournament completed');
    END IF;

    -- Count total and completed matches in current round
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'completed' AND winner_id IS NOT NULL)
    INTO v_total_matches, v_completed_matches
    FROM public.tournament_matches
    WHERE tournament_id = p_tournament_id AND round = v_current_round;

    -- CRITICAL: Only advance if ALL matches are truly completed with winners
    IF v_total_matches = 0 OR v_completed_matches < v_total_matches THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Not all matches completed yet',
            'total_matches', v_total_matches,
            'completed_matches', v_completed_matches
        );
    END IF;

    -- Get current round matches (all should be completed now)
    SELECT ARRAY(
        SELECT row_to_json(m)::jsonb
        FROM public.tournament_matches m
        WHERE tournament_id = p_tournament_id AND round = v_current_round
        ORDER BY match_number ASC
    ) INTO v_matches;

    -- Collect winners
    v_winners := ARRAY[]::uuid[];
    FOR i IN 1..array_length(v_matches, 1) LOOP
        v_winner_id := (v_matches[i]->>'winner_id')::uuid;
        v_winners := array_append(v_winners, v_winner_id);
    END LOOP;

    -- Update tournament to next round
    UPDATE public.tournaments
    SET current_round = v_current_round + 1,
        next_round_starts_at = NOW() + interval '10 seconds',
        updated_at = NOW()
    WHERE id = p_tournament_id;

    -- Create next round matches
    FOR i IN 1..(array_length(v_winners, 1) / 2) LOOP
        v_p1_id := v_winners[i*2-1];
        v_p2_id := v_winners[i*2];

        -- Check if players are bots
        SELECT COALESCE(is_bot, false) INTO v_next_p1_is_bot
        FROM public.tournament_participants
        WHERE user_id = v_p1_id AND tournament_id = p_tournament_id;
        
        SELECT COALESCE(is_bot, false) INTO v_next_p2_is_bot
        FROM public.tournament_participants
        WHERE user_id = v_p2_id AND tournament_id = p_tournament_id;

        -- ONLY Bot vs Bot matches auto-complete
        IF v_next_p1_is_bot AND v_next_p2_is_bot THEN
            v_next_status := 'completed';
            v_next_p1_score := floor(random() * 50 + 30)::int;
            v_next_p2_score := floor(random() * 50 + 30)::int;
            
            IF v_next_p1_score = v_next_p2_score THEN
                v_next_p1_score := v_next_p1_score + 1;
            END IF;
            
            IF v_next_p1_score > v_next_p2_score THEN
                v_next_winner_id := v_p1_id;
            ELSE
                v_next_winner_id := v_p2_id;
            END IF;
        ELSE
            -- Real player involved - match must be played
            v_next_status := 'pending';
            v_next_p1_score := 0;
            v_next_p2_score := 0;
            v_next_winner_id := NULL;
        END IF;

        INSERT INTO public.tournament_matches (
            tournament_id, round, match_number, player1_id, player2_id,
            status, player1_score, player2_score, winner_id, created_at, updated_at
        ) VALUES (
            p_tournament_id, v_current_round + 1, i, v_p1_id, v_p2_id,
            v_next_status, v_next_p1_score, v_next_p2_score, v_next_winner_id,
            NOW(), NOW()
        );
    END LOOP;

    RETURN json_build_object('success', true, 'new_round', v_current_round + 1);
END;
$$;