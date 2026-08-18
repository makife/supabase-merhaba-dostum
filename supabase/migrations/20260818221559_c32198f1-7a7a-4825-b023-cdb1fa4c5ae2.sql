CREATE OR REPLACE FUNCTION public.set_game_ends_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_game_start timestamptz;
BEGIN
  IF NEW.status = 'active' AND NEW.ends_at IS NULL THEN
    -- Gerçek oyun başlangıcı: countdown_started_at + 10s (5s hazırlık + 5s geri sayım)
    IF NEW.countdown_started_at IS NOT NULL THEN
      v_game_start := NEW.countdown_started_at + INTERVAL '10 seconds';
    ELSE
      v_game_start := NEW.started_at;
    END IF;

    IF v_game_start IS NOT NULL THEN
      NEW.ends_at := v_game_start + (COALESCE(NEW.time_limit, 120) || ' seconds')::INTERVAL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;