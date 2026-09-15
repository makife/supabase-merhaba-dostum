-- Add game_type column to tournaments table
ALTER TABLE public.tournaments 
ADD COLUMN game_type TEXT NOT NULL DEFAULT 'timed' CHECK (game_type IN ('timed', 'score'));

-- Add comment to explain the column
COMMENT ON COLUMN public.tournaments.game_type IS 'Tournament type: timed (120 seconds) or score (first to reach max_score wins)';