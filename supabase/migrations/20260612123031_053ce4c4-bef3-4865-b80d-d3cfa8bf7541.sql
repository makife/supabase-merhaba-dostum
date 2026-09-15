CREATE TABLE IF NOT EXISTS public.tournament_win_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  winner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  final_match_id uuid REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
  awarded_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (tournament_id)
);

GRANT SELECT ON public.tournament_win_awards TO authenticated;
GRANT ALL ON public.tournament_win_awards TO service_role;

ALTER TABLE public.tournament_win_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own tournament win awards" ON public.tournament_win_awards;
CREATE POLICY "Users can view their own tournament win awards"
ON public.tournament_win_awards
FOR SELECT
TO authenticated
USING (winner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.award_tournament_win_if_final(
  p_tournament_id uuid,
  p_winner_id uuid,
  p_final_match_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_real_winner boolean := false;
  v_is_final_match boolean := false;
  v_match_id uuid;
  v_inserted boolean := false;
BEGIN
  IF p_tournament_id IS NULL OR p_winner_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.tournament_participants tp
    WHERE tp.tournament_id = p_tournament_id
      AND tp.user_id = p_winner_id
      AND COALESCE(tp.is_bot, false) = false
  ) INTO v_is_real_winner;

  IF NOT v_is_real_winner THEN
    RETURN false;
  END IF;

  IF p_final_match_id IS NOT NULL THEN
    SELECT tm.id,
           (
             tm.status = 'completed'
             AND tm.winner_id = p_winner_id
             AND tm.round = (
               SELECT MAX(tm3.round)
               FROM public.tournament_matches tm3
               WHERE tm3.tournament_id = p_tournament_id
             )
             AND (
               SELECT COUNT(*)
               FROM public.tournament_matches tm2
               WHERE tm2.tournament_id = p_tournament_id
                 AND tm2.round = tm.round
             ) = 1
           )
    INTO v_match_id, v_is_final_match
    FROM public.tournament_matches tm
    WHERE tm.id = p_final_match_id
      AND tm.tournament_id = p_tournament_id;
  ELSE
    SELECT tm.id, true
    INTO v_match_id, v_is_final_match
    FROM public.tournament_matches tm
    WHERE tm.tournament_id = p_tournament_id
      AND tm.status = 'completed'
      AND tm.winner_id = p_winner_id
      AND tm.round = (
        SELECT MAX(tm3.round)
        FROM public.tournament_matches tm3
        WHERE tm3.tournament_id = p_tournament_id
      )
      AND (
        SELECT COUNT(*)
        FROM public.tournament_matches tm2
        WHERE tm2.tournament_id = p_tournament_id
          AND tm2.round = tm.round
      ) = 1
    ORDER BY tm.updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF COALESCE(v_is_final_match, false) IS NOT TRUE OR v_match_id IS NULL THEN
    RETURN false;
  END IF;

  WITH inserted AS (
    INSERT INTO public.tournament_win_awards (tournament_id, winner_id, final_match_id)
    VALUES (p_tournament_id, p_winner_id, v_match_id)
    ON CONFLICT (tournament_id) DO NOTHING
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM inserted) INTO v_inserted;

  IF v_inserted THEN
    UPDATE public.profiles
    SET tournament_wins = COALESCE(tournament_wins, 0) + 1,
        updated_at = now()
    WHERE id = p_winner_id;

    PERFORM public.check_and_award_badges_simple(p_winner_id);
  END IF;

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_tournament_winner_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_final_winner uuid;
  v_final_match_id uuid;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    SELECT tm.winner_id, tm.id
    INTO v_final_winner, v_final_match_id
    FROM public.tournament_matches tm
    WHERE tm.tournament_id = NEW.id
      AND tm.status = 'completed'
      AND tm.winner_id IS NOT NULL
      AND tm.round = (
        SELECT MAX(tm3.round)
        FROM public.tournament_matches tm3
        WHERE tm3.tournament_id = NEW.id
      )
      AND (
        SELECT COUNT(*)
        FROM public.tournament_matches tm2
        WHERE tm2.tournament_id = NEW.id
          AND tm2.round = tm.round
      ) = 1
    ORDER BY tm.updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_final_winner IS NOT NULL THEN
      PERFORM public.award_tournament_win_if_final(NEW.id, v_final_winner, v_final_match_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_tournament_win_on_final_match_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND NEW.winner_id IS NOT NULL
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR OLD.winner_id IS DISTINCT FROM NEW.winner_id
     ) THEN
    PERFORM public.award_tournament_win_if_final(NEW.tournament_id, NEW.winner_id, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS award_tournament_win_on_final_match_update_trigger ON public.tournament_matches;
CREATE TRIGGER award_tournament_win_on_final_match_update_trigger
AFTER UPDATE ON public.tournament_matches
FOR EACH ROW
EXECUTE FUNCTION public.award_tournament_win_on_final_match_update();