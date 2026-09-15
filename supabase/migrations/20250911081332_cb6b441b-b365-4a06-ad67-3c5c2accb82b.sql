-- Ensure unique, auto-generated room codes to eliminate 409 conflicts on concurrent inserts
-- Requires pgcrypto for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to ensure a unique room_code on insert
CREATE OR REPLACE FUNCTION public.ensure_unique_room_code()
RETURNS trigger AS $$
DECLARE
  candidate text;
BEGIN
  -- If no room_code provided, generate one
  IF NEW.room_code IS NULL OR NEW.room_code = '' THEN
    LOOP
      candidate := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 6));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.game_rooms WHERE room_code = candidate
      );
    END LOOP;
    NEW.room_code := candidate;
  ELSE
    -- If provided room_code already exists, make it unique by suffixing random chars
    IF EXISTS (SELECT 1 FROM public.game_rooms WHERE room_code = NEW.room_code) THEN
      LOOP
        candidate := NEW.room_code || '-' || upper(substr(encode(gen_random_bytes(2), 'hex'), 1, 2));
        EXIT WHEN NOT EXISTS (
          SELECT 1 FROM public.game_rooms WHERE room_code = candidate
        );
      END LOOP;
      NEW.room_code := candidate;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to run before insert on game_rooms
DROP TRIGGER IF EXISTS trg_ensure_unique_room_code ON public.game_rooms;
CREATE TRIGGER trg_ensure_unique_room_code
BEFORE INSERT ON public.game_rooms
FOR EACH ROW
EXECUTE FUNCTION public.ensure_unique_room_code();