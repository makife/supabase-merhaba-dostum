-- Fix tournament match ends_at calculation to use 120 seconds game duration
-- Drop existing trigger first
DROP TRIGGER IF EXISTS trigger_set_tournament_match_ends_at ON tournament_matches;
DROP FUNCTION IF EXISTS set_tournament_match_ends_at() CASCADE;

-- Create new function with correct 120 second game duration
CREATE OR REPLACE FUNCTION set_tournament_match_ends_at()
RETURNS TRIGGER AS $$
BEGIN
  -- When countdown_started_at is set, calculate ends_at as countdown_started_at + 5s buffer + 120s game duration
  IF NEW.countdown_started_at IS NOT NULL AND (OLD.countdown_started_at IS NULL OR OLD.countdown_started_at IS DISTINCT FROM NEW.countdown_started_at) THEN
    -- 5 seconds for countdown buffer + 120 seconds for actual game = 125 seconds total
    NEW.ends_at := NEW.countdown_started_at + INTERVAL '125 seconds';
    RAISE NOTICE 'Tournament match ends_at set: countdown_started_at=%, ends_at=%', NEW.countdown_started_at, NEW.ends_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger with correct name
CREATE TRIGGER trigger_set_tournament_match_ends_at
  BEFORE UPDATE ON tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION set_tournament_match_ends_at();