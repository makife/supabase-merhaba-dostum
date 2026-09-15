-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create a function to check and finish expired games
CREATE OR REPLACE FUNCTION public.check_and_finish_expired_games()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_game RECORD;
  winner_id_result UUID;
BEGIN
  -- Find all active games that have exceeded their time limit
  FOR expired_game IN
    SELECT 
      id,
      player1_id,
      player2_id,
      player1_score,
      player2_score,
      started_at,
      time_limit
    FROM game_rooms
    WHERE status = 'active'
      AND started_at IS NOT NULL
      AND (EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER) >= time_limit
  LOOP
    -- Determine winner based on score
    IF expired_game.player1_score > expired_game.player2_score THEN
      winner_id_result := expired_game.player1_id;
    ELSIF expired_game.player2_score > expired_game.player1_score THEN
      winner_id_result := expired_game.player2_id;
    ELSE
      -- Tie: randomly pick winner
      winner_id_result := CASE WHEN random() < 0.5 THEN expired_game.player1_id ELSE expired_game.player2_id END;
    END IF;

    -- Update game room to finished status
    UPDATE game_rooms
    SET 
      status = 'finished',
      winner_id = winner_id_result,
      finished_at = NOW(),
      game_duration = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
    WHERE id = expired_game.id;

    RAISE NOTICE 'Game % finished by server timer. Winner: %', expired_game.id, winner_id_result;
  END LOOP;
END;
$$;

-- Schedule the function to run every 2 seconds
SELECT cron.schedule(
  'check-expired-games',
  '*/2 * * * * *', -- Every 2 seconds
  $$
  SELECT public.check_and_finish_expired_games();
  $$
);