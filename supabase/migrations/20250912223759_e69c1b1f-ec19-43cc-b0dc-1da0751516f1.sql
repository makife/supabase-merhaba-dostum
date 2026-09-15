-- Enforce participant integrity and prevent random-match bots
-- 1) Ensure full row data on realtime DELETEs
ALTER TABLE public.game_participants REPLICA IDENTITY FULL;

-- 2) Unique constraints to prevent duplicates and limit bots per room
CREATE UNIQUE INDEX IF NOT EXISTS uniq_game_participants_room_user
  ON public.game_participants (room_id, user_id)
  WHERE user_id IS NOT NULL AND is_bot = false;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_game_participants_single_bot
  ON public.game_participants (room_id)
  WHERE is_bot = true;

-- 3) Trigger to enforce max 2 participants and disallow bots in random-match
CREATE OR REPLACE FUNCTION public.enforce_room_participant_rules()
RETURNS trigger AS $$
DECLARE
  v_game_mode text;
  v_max integer;
  v_current_count integer;
BEGIN
  -- Ensure room exists and fetch settings
  SELECT game_mode, max_players INTO v_game_mode, v_max
  FROM public.game_rooms
  WHERE id = NEW.room_id;

  IF v_game_mode IS NULL THEN
    RAISE EXCEPTION 'Room not found for id %', NEW.room_id;
  END IF;

  -- Disallow bots in random-match modes
  IF NEW.is_bot = true AND position('random-match' in v_game_mode) > 0 THEN
    RAISE EXCEPTION 'Bots are not allowed in random-match rooms';
  END IF;

  -- Prevent duplicate real user (also covered by index, but gives cleaner error)
  IF NEW.is_bot = false AND NEW.user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.game_participants
    WHERE room_id = NEW.room_id AND user_id = NEW.user_id AND is_bot = false
  ) THEN
    RAISE EXCEPTION 'User % already joined this room', NEW.user_id;
  END IF;

  -- Enforce max players (defaults to 2 if null)
  SELECT COUNT(*) INTO v_current_count
  FROM public.game_participants
  WHERE room_id = NEW.room_id;

  IF v_current_count >= COALESCE(v_max, 2) THEN
    RAISE EXCEPTION 'Room is full (max % participants)', COALESCE(v_max, 2);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_room_participant_rules ON public.game_participants;
CREATE TRIGGER trg_enforce_room_participant_rules
BEFORE INSERT ON public.game_participants
FOR EACH ROW EXECUTE FUNCTION public.enforce_room_participant_rules();