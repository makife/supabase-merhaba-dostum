-- Remove the problematic trigger and function to fix room creation
DROP TRIGGER IF EXISTS trg_ensure_unique_room_code ON public.game_rooms;
DROP FUNCTION IF EXISTS public.ensure_unique_room_code();