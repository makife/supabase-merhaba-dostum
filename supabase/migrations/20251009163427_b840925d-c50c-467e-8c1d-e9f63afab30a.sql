-- Add countdown_started_at to game_rooms for server-side countdown
ALTER TABLE game_rooms 
ADD COLUMN IF NOT EXISTS countdown_started_at TIMESTAMPTZ DEFAULT NULL;

-- Add countdown_started_at to tournament_matches for server-side countdown
ALTER TABLE tournament_matches 
ADD COLUMN IF NOT EXISTS countdown_started_at TIMESTAMPTZ DEFAULT NULL;

-- Function to start server-side countdown for a game
CREATE OR REPLACE FUNCTION public.start_game_countdown(p_room_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  countdown_time TIMESTAMPTZ;
BEGIN
  countdown_time := NOW();
  
  UPDATE game_rooms
  SET countdown_started_at = countdown_time,
      updated_at = NOW()
  WHERE id = p_room_id;
  
  RETURN countdown_time;
END;
$$;

-- Function to start server-side countdown for a tournament match
CREATE OR REPLACE FUNCTION public.start_tournament_countdown(p_match_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  countdown_time TIMESTAMPTZ;
BEGIN
  countdown_time := NOW();
  
  UPDATE tournament_matches
  SET countdown_started_at = countdown_time,
      updated_at = NOW()
  WHERE id = p_match_id;
  
  RETURN countdown_time;
END;
$$;

-- Function to automatically start games after countdown (5 seconds)
CREATE OR REPLACE FUNCTION public.auto_start_countdown_finished_games()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Start games where countdown finished (5+ seconds passed)
  UPDATE game_rooms
  SET 
    status = 'active',
    started_at = NOW(),
    countdown_started_at = NULL
  WHERE status = 'waiting'
    AND countdown_started_at IS NOT NULL
    AND (EXTRACT(EPOCH FROM (NOW() - countdown_started_at))::INTEGER) >= 5;
    
  -- Start tournament matches where countdown finished
  UPDATE tournament_matches
  SET 
    status = 'in_progress',
    countdown_started_at = NULL,
    updated_at = NOW()
  WHERE status = 'pending'
    AND countdown_started_at IS NOT NULL
    AND (EXTRACT(EPOCH FROM (NOW() - countdown_started_at))::INTEGER) >= 5;
END;
$$;

-- Schedule auto-start to run every second
SELECT cron.schedule(
  'auto-start-games-after-countdown',
  '* * * * * *', -- Every second
  $$
  SELECT public.auto_start_countdown_finished_games();
  $$
);