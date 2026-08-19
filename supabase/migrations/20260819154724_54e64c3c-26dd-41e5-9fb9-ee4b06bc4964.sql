ALTER TABLE public.game_rooms ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.bump_game_room_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_game_room_version ON public.game_rooms;
CREATE TRIGGER trg_bump_game_room_version
BEFORE UPDATE ON public.game_rooms
FOR EACH ROW EXECUTE FUNCTION public.bump_game_room_version();