-- Fix duplicate tournament matches by adding unique constraint and updating function

-- First clean up any duplicate matches
DELETE FROM tournament_matches t1
USING tournament_matches t2
WHERE t1.ctid < t2.ctid
  AND t1.tournament_id = t2.tournament_id
  AND t1.round = t2.round
  AND t1.match_number = t2.match_number;

-- Add unique constraint to prevent future duplicates
ALTER TABLE tournament_matches
DROP CONSTRAINT IF EXISTS tournament_matches_unique_match;

ALTER TABLE tournament_matches
ADD CONSTRAINT tournament_matches_unique_match 
UNIQUE (tournament_id, round, match_number);

-- Update create_matches_for_active_tournament to use ON CONFLICT
CREATE OR REPLACE FUNCTION public.create_matches_for_active_tournament(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_participants json[];
    v_current_count int;
    v_real_count int;
    v_existing_matches int;
    i int;
BEGIN
    -- Check if matches already exist for this tournament
    SELECT count(*) INTO v_existing_matches
    FROM public.tournament_matches
    WHERE tournament_id = p_tournament_id;
    
    IF v_existing_matches > 0 THEN
        RAISE NOTICE 'Matches already exist for this tournament, skipping';
        RETURN;
    END IF;

    -- Count real players
    SELECT count(*) INTO v_real_count
    FROM public.tournament_participants
    WHERE tournament_id = p_tournament_id
    AND is_bot = false;

    IF v_real_count < 2 THEN
        RAISE EXCEPTION 'Turnuvanın başlayabilmesi için en az 2 gerçek oyuncu gereklidir.';
    END IF;

    -- Get current participant count
    SELECT count(*) INTO v_current_count
    FROM public.tournament_participants
    WHERE tournament_id = p_tournament_id;

    -- Add bots to reach 8
    WHILE v_current_count < 8 LOOP
        INSERT INTO public.tournament_participants (
            tournament_id,
            user_id,
            is_bot,
            joined_at
        ) VALUES (
            p_tournament_id,
            gen_random_uuid(),
            true,
            NOW()
        );
        v_current_count := v_current_count + 1;
    END LOOP;

    -- Update tournament status
    UPDATE public.tournaments
    SET status = 'in_progress',
        updated_at = NOW()
    WHERE id = p_tournament_id;

    -- Shuffle participants
    SELECT ARRAY(
        SELECT row_to_json(t)
        FROM (
            SELECT user_id
            FROM public.tournament_participants
            WHERE tournament_id = p_tournament_id
            ORDER BY random()
        ) t
    ) INTO v_participants;

    -- Create 4 quarter-final matches with ON CONFLICT to prevent duplicates
    FOR i IN 1..4 LOOP
        INSERT INTO public.tournament_matches (
            tournament_id,
            round,
            match_number,
            player1_id,
            player2_id,
            status,
            created_at,
            updated_at
        ) VALUES (
            p_tournament_id,
            1,
            i,
            ((v_participants[i*2-1]->>'user_id')::uuid),
            ((v_participants[i*2]->>'user_id')::uuid),
            'pending',
            NOW(),
            NOW()
        )
        ON CONFLICT (tournament_id, round, match_number) DO NOTHING;
    END LOOP;
END;
$$;