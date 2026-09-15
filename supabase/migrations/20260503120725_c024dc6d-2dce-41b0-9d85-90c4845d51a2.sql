CREATE OR REPLACE FUNCTION public.auto_set_users_offline()
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE user_presence
  SET is_online = false
  WHERE is_online = true
    AND last_seen < NOW() - INTERVAL '120 seconds';
END;
$function$;