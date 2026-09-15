-- Fix security warnings by setting search_path for functions
CREATE OR REPLACE FUNCTION public.cleanup_expired_tournaments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.set_tournament_expiration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Set expiration time to 5 minutes from creation for waiting tournaments
  IF NEW.status = 'waiting' AND NEW.expires_at IS NULL THEN
    NEW.expires_at = NOW() + INTERVAL '5 minutes';
  END IF;
  
  RETURN NEW;
END;
$$;