-- Fix start_game_countdown to use 5 second countdown instead of 10
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
  -- Countdown 5 saniye sürer, ardından oyun başlar
  v_game_start := v_now + interval '5 seconds';

  UPDATE public.game_rooms
  SET 
    countdown_started_at = v_now,
    started_at = v_game_start,     
    status = 'active'              
  WHERE id = p_room_id;

  RETURN v_now;
END;
$$;