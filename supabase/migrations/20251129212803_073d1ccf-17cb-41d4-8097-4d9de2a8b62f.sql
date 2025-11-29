-- 1. Add ends_at column to game_rooms for timestamp-based timer
ALTER TABLE public.game_rooms 
ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;

-- 2. Add ends_at column to tournament_matches for timestamp-based timer
ALTER TABLE public.tournament_matches
ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;

-- 3. Create function to auto-promote tournament winners to next round
CREATE OR REPLACE FUNCTION public.auto_promote_tournament_winner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tournament_id UUID;
  v_round INTEGER;
  v_match_number INTEGER;
  v_winner_id UUID;
  v_next_round INTEGER;
  v_next_match_number INTEGER;
  v_next_match_id UUID;
BEGIN
  -- Only act when status changes to 'completed' and winner exists
  IF NEW.status = 'completed' AND NEW.winner_id IS NOT NULL AND OLD.status != 'completed' THEN
    v_tournament_id := NEW.tournament_id;
    v_round := NEW.round;
    v_match_number := NEW.match_number;
    v_winner_id := NEW.winner_id;
    v_next_round := v_round + 1;
    
    -- Calculate next match position based on current match
    -- QF (Round 1): Match 1,2 -> SF Match 1; Match 3,4 -> SF Match 2
    -- SF (Round 2): Match 1,2 -> Final Match 1
    IF v_round = 1 THEN -- Quarter-Final to Semi-Final
      v_next_match_number := CASE 
        WHEN v_match_number IN (1, 2) THEN 1
        WHEN v_match_number IN (3, 4) THEN 2
        ELSE NULL
      END;
    ELSIF v_round = 2 THEN -- Semi-Final to Final
      v_next_match_number := 1;
    ELSE
      v_next_match_number := NULL; -- No next round after Final
    END IF;
    
    -- If there's a next round, promote winner
    IF v_next_match_number IS NOT NULL THEN
      -- Find the next round match
      SELECT id INTO v_next_match_id
      FROM public.tournament_matches
      WHERE tournament_id = v_tournament_id
        AND round = v_next_round
        AND match_number = v_next_match_number
      LIMIT 1;
      
      IF v_next_match_id IS NOT NULL THEN
        -- Determine if winner goes to player1 or player2 slot
        IF v_match_number % 2 = 1 THEN -- Odd match numbers -> player1
          UPDATE public.tournament_matches
          SET player1_id = v_winner_id,
              updated_at = NOW()
          WHERE id = v_next_match_id;
          
          RAISE NOTICE '✅ AUTO-PROMOTE: Winner % from QF/SF Match % -> Next Round Match % Player1', 
            v_winner_id, v_match_number, v_next_match_number;
        ELSE -- Even match numbers -> player2
          UPDATE public.tournament_matches
          SET player2_id = v_winner_id,
              updated_at = NOW()
          WHERE id = v_next_match_id;
          
          RAISE NOTICE '✅ AUTO-PROMOTE: Winner % from QF/SF Match % -> Next Round Match % Player2', 
            v_winner_id, v_match_number, v_next_match_number;
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Create trigger on tournament_matches
DROP TRIGGER IF EXISTS trigger_auto_promote_tournament_winner ON public.tournament_matches;
CREATE TRIGGER trigger_auto_promote_tournament_winner
  AFTER UPDATE ON public.tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_promote_tournament_winner();

-- 5. Create function to set ends_at when game starts
CREATE OR REPLACE FUNCTION public.set_game_ends_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When game starts, set ends_at to started_at + time_limit (default 120 seconds)
  IF NEW.status = 'active' AND NEW.started_at IS NOT NULL AND NEW.ends_at IS NULL THEN
    NEW.ends_at := NEW.started_at + (COALESCE(NEW.time_limit, 120) || ' seconds')::INTERVAL;
    RAISE NOTICE '⏱️ Game ends_at set to: %', NEW.ends_at;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 6. Create trigger on game_rooms to auto-set ends_at
DROP TRIGGER IF EXISTS trigger_set_game_ends_at ON public.game_rooms;
CREATE TRIGGER trigger_set_game_ends_at
  BEFORE UPDATE ON public.game_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.set_game_ends_at();

-- 7. Create function to set tournament match ends_at
CREATE OR REPLACE FUNCTION public.set_tournament_match_ends_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_time_limit INTEGER;
BEGIN
  -- When tournament match becomes in_progress, set ends_at
  IF NEW.status = 'in_progress' AND OLD.status != 'in_progress' AND NEW.ends_at IS NULL THEN
    -- Get tournament timeout_duration (default 120 seconds)
    SELECT COALESCE(timeout_duration, 120) INTO v_time_limit
    FROM public.tournaments
    WHERE id = NEW.tournament_id;
    
    NEW.ends_at := NOW() + (v_time_limit || ' seconds')::INTERVAL;
    RAISE NOTICE '⏱️ Tournament match ends_at set to: %', NEW.ends_at;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 8. Create trigger on tournament_matches to auto-set ends_at
DROP TRIGGER IF EXISTS trigger_set_tournament_match_ends_at ON public.tournament_matches;
CREATE TRIGGER trigger_set_tournament_match_ends_at
  BEFORE UPDATE ON public.tournament_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tournament_match_ends_at();