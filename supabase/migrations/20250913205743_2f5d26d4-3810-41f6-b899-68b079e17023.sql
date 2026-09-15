-- Fix disconnect penalty to work even after participant row is deleted
CREATE OR REPLACE FUNCTION public.apply_disconnect_penalty(p_offender_id uuid, p_room_id uuid)
RETURNS TABLE(applied boolean, penalty integer, new_score integer, disconnect_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_profile RECORD;
  v_caller_in_room boolean;
  v_offender_in_room boolean;
  v_disconnect_count integer;
  v_penalty integer;
  v_new_score integer;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Verify the caller is/was in the room
  SELECT EXISTS (
    SELECT 1 FROM public.game_participants
    WHERE room_id = p_room_id
      AND user_id = auth.uid()
  ) INTO v_caller_in_room;

  -- Verify the offender is associated with the room either via participants or game_rooms
  SELECT 
    EXISTS (
      SELECT 1 FROM public.game_participants
      WHERE room_id = p_room_id AND user_id = p_offender_id
    )
    OR EXISTS (
      SELECT 1 FROM public.game_rooms
      WHERE id = p_room_id AND (player1_id = p_offender_id OR player2_id = p_offender_id)
    )
  INTO v_offender_in_room;

  IF NOT (v_caller_in_room AND v_offender_in_room) THEN
    RETURN QUERY SELECT false, 0, 0, 0;
    RETURN;
  END IF;

  -- Lock offender profile row to prevent races
  SELECT p.total_score, p.disconnect_count
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_offender_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 0;
    RETURN;
  END IF;

  v_disconnect_count := COALESCE(v_profile.disconnect_count, 0) + 1;
  v_penalty := LEAST(50 + v_disconnect_count * 10, 200);
  v_new_score := GREATEST(0, COALESCE(v_profile.total_score, 0) - v_penalty);

  UPDATE public.profiles p
  SET
    total_score = v_new_score,
    disconnect_count = v_disconnect_count,
    last_disconnect = NOW(),
    updated_at = NOW()
  WHERE p.id = p_offender_id;

  RETURN QUERY SELECT true, v_penalty, v_new_score, v_disconnect_count;
END;
$$;