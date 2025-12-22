-- Fix the transfer_tournament_creator_on_leave trigger function
CREATE OR REPLACE FUNCTION public.transfer_tournament_creator_on_leave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_creator uuid;
  v_new_creator uuid;
  v_status text;
BEGIN
  -- Get current tournament state
  SELECT creator_id, status INTO v_current_creator, v_status
  FROM public.tournaments
  WHERE id = OLD.tournament_id;

  -- Only act if tournament is waiting and the leaving participant is the creator
  IF v_status = 'waiting' AND v_current_creator = OLD.user_id THEN
    -- Pick first real participant (by joined_at) to become new creator
    SELECT user_id INTO v_new_creator
    FROM public.tournament_participants
    WHERE tournament_id = OLD.tournament_id
      AND is_bot = false
      AND user_id != OLD.user_id
    ORDER BY joined_at ASC
    LIMIT 1;

    IF v_new_creator IS NOT NULL THEN
      UPDATE public.tournaments
      SET creator_id = v_new_creator,
          updated_at = NOW()
      WHERE id = OLD.tournament_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$;