CREATE OR REPLACE FUNCTION public.start_match_countdown(p_room_id uuid, p_idle_ms integer DEFAULT 3000)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_ready integer;
  v_idle integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.game_participants
    WHERE room_id = p_room_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not a participant of this room';
  END IF;

  SELECT countdown_started_at INTO v_start
  FROM public.game_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF v_start IS NOT NULL THEN
    RETURN v_start;
  END IF;

  SELECT count(*) INTO v_ready
  FROM public.game_participants
  WHERE room_id = p_room_id AND is_ready IS TRUE;

  IF v_ready < 2 THEN
    RAISE EXCEPTION 'players not ready yet';
  END IF;

  v_idle := GREATEST(COALESCE(p_idle_ms, 3000), 1000);
  v_start := now() + make_interval(secs => v_idle::numeric / 1000.0);

  UPDATE public.game_rooms
  SET countdown_started_at = v_start,
      updated_at = now()
  WHERE id = p_room_id;

  RETURN v_start;
END;
$$;

REVOKE ALL ON FUNCTION public.start_match_countdown(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_match_countdown(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_match_countdown(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.start_tournament_match_countdown(p_match_id uuid, p_idle_ms integer DEFAULT 3000)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_idle integer;
  v_p1 uuid;
  v_p2 uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  SELECT countdown_started_at, player1_id, player2_id
  INTO v_start, v_p1, v_p2
  FROM public.tournament_matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_start IS NOT NULL THEN
    RETURN v_start;
  END IF;

  v_idle := GREATEST(COALESCE(p_idle_ms, 3000), 1000);
  v_start := now() + make_interval(secs => v_idle::numeric / 1000.0);

  UPDATE public.tournament_matches
  SET countdown_started_at = v_start,
      status = 'in_progress'
  WHERE id = p_match_id;

  RETURN v_start;
END;
$$;

REVOKE ALL ON FUNCTION public.start_tournament_match_countdown(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_tournament_match_countdown(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_tournament_match_countdown(uuid, integer) TO service_role;