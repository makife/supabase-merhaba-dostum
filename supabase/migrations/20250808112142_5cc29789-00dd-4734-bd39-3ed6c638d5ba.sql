-- Add expiration and timeout fields to tournaments table
ALTER TABLE public.tournaments 
ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '5 minutes'),
ADD COLUMN timeout_duration INTEGER DEFAULT 300; -- 5 minutes in seconds

-- Add function to clean up expired tournaments
CREATE OR REPLACE FUNCTION public.cleanup_expired_tournaments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark expired waiting tournaments as cancelled
  UPDATE public.tournaments 
  SET status = 'cancelled',
      finished_at = NOW()
  WHERE status = 'waiting' 
    AND expires_at < NOW();
    
  -- Remove participants from cancelled tournaments
  DELETE FROM public.tournament_participants
  WHERE tournament_id IN (
    SELECT id FROM public.tournaments 
    WHERE status = 'cancelled'
  );
END;
$$;

-- Add trigger to automatically set expiration time on tournament creation
CREATE OR REPLACE FUNCTION public.set_tournament_expiration()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set expiration time to 5 minutes from creation for waiting tournaments
  IF NEW.status = 'waiting' AND NEW.expires_at IS NULL THEN
    NEW.expires_at = NOW() + INTERVAL '5 minutes';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER tournament_set_expiration
  BEFORE INSERT OR UPDATE ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tournament_expiration();