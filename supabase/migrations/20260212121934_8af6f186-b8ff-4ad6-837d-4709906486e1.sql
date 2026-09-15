
-- Create a function to expire stale waiting rooms (30 min old, still waiting)
CREATE OR REPLACE FUNCTION public.expire_stale_waiting_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE game_rooms
  SET status = 'expired', updated_at = now()
  WHERE status = 'waiting'
    AND created_at < now() - interval '30 minutes';
END;
$$;
