-- Ensure realtime DELETE events include full row data
ALTER TABLE public.game_participants REPLICA IDENTITY FULL;

-- Finish game automatically when a participant leaves and only one (or none) remains
CREATE OR REPLACE FUNCTION public.finish_game_on_participant_leave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_room public.game_rooms%ROWTYPE;
  v_remaining_count INTEGER;
  v_remaining_user uuid;
BEGIN
  -- Fetch the room
  SELECT * INTO v_room FROM public.game_rooms WHERE id = OLD.room_id;
  IF v_room.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Only act for active games
  IF v_room.status <> 'active' THEN
    RETURN NULL;
  END IF;

  -- Count remaining real (non-bot) participants
  SELECT COUNT(*) INTO v_remaining_count
  FROM public.game_participants
  WHERE room_id = OLD.room_id AND is_bot = false;

  IF v_remaining_count <= 1 THEN
    -- Determine winner (remaining real user if exactly one left)
    IF v_remaining_count = 1 THEN
      SELECT user_id::uuid INTO v_remaining_user
      FROM public.game_participants
      WHERE room_id = OLD.room_id AND is_bot = false
      LIMIT 1;
    ELSE
      v_remaining_user := NULL; -- nobody left
    END IF;

    -- Finish the room
    UPDATE public.game_rooms
    SET status = 'finished',
        winner_id = v_remaining_user,
        finished_at = NOW(),
        updated_at = NOW()
    WHERE id = OLD.room_id AND status <> 'finished';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_finish_on_participant_delete ON public.game_participants;
CREATE TRIGGER trg_finish_on_participant_delete
AFTER DELETE ON public.game_participants
FOR EACH ROW
EXECUTE FUNCTION public.finish_game_on_participant_leave();