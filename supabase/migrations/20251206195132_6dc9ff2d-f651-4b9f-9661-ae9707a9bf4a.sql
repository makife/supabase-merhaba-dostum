-- Fix start_game_countdown to use 10 second total (5s buffer + 5s countdown)
CREATE OR REPLACE FUNCTION public.start_game_countdown(p_room_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_game_start TIMESTAMPTZ;
BEGIN
  v_now := NOW();
  -- Toplam 10 saniye: 5 saniye buffer + 5 saniye countdown, ardından oyun başlar
  v_game_start := v_now + interval '10 seconds';

  UPDATE public.game_rooms
  SET 
    countdown_started_at = v_now,
    started_at = v_game_start,     
    status = 'active'              
  WHERE id = p_room_id;

  RETURN v_now;
END;
$$;