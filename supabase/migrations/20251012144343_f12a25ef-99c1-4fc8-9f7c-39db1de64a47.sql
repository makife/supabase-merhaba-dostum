-- Make start_game_countdown idempotent and race-safe
CREATE OR REPLACE FUNCTION public.start_game_countdown(p_room_id uuid)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing TIMESTAMPTZ;
  v_countdown_time TIMESTAMPTZ;
  v_grid JSONB;
BEGIN
  -- Lock the room row to avoid races and read existing values
  SELECT countdown_started_at, current_grid
  INTO v_existing, v_grid
  FROM public.game_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  -- If countdown already started, return the original timestamp (idempotent)
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Otherwise set the countdown start time once
  v_countdown_time := NOW();

  -- Ensure there is a grid
  IF v_grid IS NULL OR v_grid = '[]'::jsonb THEN
    v_grid := generate_random_grid();
  END IF;

  UPDATE public.game_rooms
  SET countdown_started_at = v_countdown_time,
      current_grid = v_grid,
      updated_at = NOW()
  WHERE id = p_room_id;

  RETURN v_countdown_time;
END;
$function$;