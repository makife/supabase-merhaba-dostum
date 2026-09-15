-- Update start_game_countdown to also set player IDs from game_participants
CREATE OR REPLACE FUNCTION public.start_game_countdown(p_room_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_game_start TIMESTAMPTZ;
  v_player1_id UUID;
  v_player2_id UUID;
BEGIN
  v_now := NOW();
  -- Toplam 10 saniye: 5 saniye buffer + 5 saniye countdown, ardından oyun başlar
  v_game_start := v_now + interval '10 seconds';

  -- Get player IDs from game_participants (ordered by join time)
  SELECT user_id INTO v_player1_id
  FROM public.game_participants
  WHERE room_id = p_room_id AND is_bot = false
  ORDER BY joined_at ASC
  LIMIT 1;

  SELECT user_id INTO v_player2_id
  FROM public.game_participants
  WHERE room_id = p_room_id AND is_bot = false AND user_id != v_player1_id
  ORDER BY joined_at ASC
  LIMIT 1;

  UPDATE public.game_rooms
  SET 
    countdown_started_at = v_now,
    started_at = v_game_start,     
    status = 'active',
    player1_id = COALESCE(v_player1_id, player1_id),
    player2_id = COALESCE(v_player2_id, player2_id)
  WHERE id = p_room_id;

  RETURN v_now;
END;
$$;