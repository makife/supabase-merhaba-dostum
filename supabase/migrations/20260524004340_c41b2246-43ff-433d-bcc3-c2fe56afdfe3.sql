CREATE OR REPLACE FUNCTION public.submit_room_score(p_room_id uuid, p_score integer)
RETURNS public.game_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_room public.game_rooms%ROWTYPE;
  v_score integer := GREATEST(COALESCE(p_score, 0), 0);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT *
  INTO v_room
  FROM public.game_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found';
  END IF;

  IF v_room.player1_id IS DISTINCT FROM v_user_id
     AND v_room.player2_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'not_room_player';
  END IF;

  IF v_room.status NOT IN ('waiting', 'active') THEN
    RAISE EXCEPTION 'room_not_active';
  END IF;

  UPDATE public.game_participants
  SET score = GREATEST(COALESCE(score, 0), v_score)
  WHERE room_id = p_room_id
    AND user_id = v_user_id;

  IF v_room.player1_id = v_user_id THEN
    UPDATE public.game_rooms
    SET player1_score = GREATEST(COALESCE(player1_score, 0), v_score),
        updated_at = now()
    WHERE id = p_room_id
    RETURNING * INTO v_room;
  ELSE
    UPDATE public.game_rooms
    SET player2_score = GREATEST(COALESCE(player2_score, 0), v_score),
        updated_at = now()
    WHERE id = p_room_id
    RETURNING * INTO v_room;
  END IF;

  RETURN v_room;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_room_score(uuid, integer) TO authenticated;