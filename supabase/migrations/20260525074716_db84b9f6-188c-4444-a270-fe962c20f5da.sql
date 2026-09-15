CREATE OR REPLACE FUNCTION public.enforce_room_participant_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game_mode text;
  v_max integer;
  v_current_count integer;
BEGIN
  SELECT game_mode, max_players INTO v_game_mode, v_max
  FROM public.game_rooms
  WHERE id = NEW.room_id;

  IF v_game_mode IS NULL THEN
    RAISE EXCEPTION 'Room not found for id %', NEW.room_id;
  END IF;

  -- Bots allowed in random-match as fallback (after 10s no real opponent)

  IF NEW.is_bot = false AND NEW.user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.game_participants
    WHERE room_id = NEW.room_id AND user_id = NEW.user_id AND is_bot = false
  ) THEN
    RAISE EXCEPTION 'User % already joined this room', NEW.user_id;
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM public.game_participants
  WHERE room_id = NEW.room_id;

  IF v_current_count >= COALESCE(v_max, 2) THEN
    RAISE EXCEPTION 'Room is full (max % participants)', COALESCE(v_max, 2);
  END IF;

  RETURN NEW;
END;
$$;