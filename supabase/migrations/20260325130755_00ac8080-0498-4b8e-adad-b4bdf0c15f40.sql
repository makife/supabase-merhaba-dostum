
DROP FUNCTION IF EXISTS public.apply_disconnect_penalty(uuid, uuid);

CREATE FUNCTION public.apply_disconnect_penalty(p_room_id UUID, p_offender_id UUID)
RETURNS TABLE(success BOOLEAN, penalty INTEGER, new_score INTEGER, new_disconnect_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_caller_in_room boolean;
  v_offender_in_room boolean;
  v_disconnect_count integer;
  v_penalty integer;
  v_new_score integer;
  v_current_rank_points integer;
  v_turkey_now TIMESTAMP;
  v_current_week_start DATE;
  v_current_month_start DATE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.game_participants
    WHERE room_id = p_room_id AND user_id = auth.uid()
  ) INTO v_caller_in_room;

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

  SELECT p.total_score, p.disconnect_count, p.rank_points
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
  v_current_rank_points := GREATEST(0, COALESCE(v_profile.rank_points, 0) - 10);

  UPDATE public.profiles p
  SET
    total_score = v_new_score,
    disconnect_count = v_disconnect_count,
    last_disconnect = NOW(),
    rank_points = v_current_rank_points,
    updated_at = NOW()
  WHERE p.id = p_offender_id;

  v_turkey_now := NOW() AT TIME ZONE 'Europe/Istanbul';
  v_current_week_start := DATE_TRUNC('week', v_turkey_now)::DATE;
  v_current_month_start := DATE_TRUNC('month', v_turkey_now)::DATE;

  UPDATE public.weekly_stats
  SET total_score = GREATEST(0, total_score - v_penalty),
      updated_at = NOW()
  WHERE user_id = p_offender_id AND week_start = v_current_week_start;

  UPDATE public.monthly_stats
  SET total_score = GREATEST(0, total_score - v_penalty),
      updated_at = NOW()
  WHERE user_id = p_offender_id AND month_start = v_current_month_start;

  RETURN QUERY SELECT true, v_penalty, v_new_score, v_disconnect_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_disconnect_penalty(uuid, uuid) TO authenticated;
