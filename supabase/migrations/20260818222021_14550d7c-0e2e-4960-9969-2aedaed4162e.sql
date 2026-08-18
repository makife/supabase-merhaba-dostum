CREATE OR REPLACE FUNCTION public.set_game_ends_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_duration_seconds integer;
BEGIN
  v_duration_seconds := COALESCE(NEW.time_limit, 120);

  -- Countdown timestamp'i geldiğinde/değiştiğinde bitiş zamanını mutlaka yeniden kur.
  -- Gerçek oyun başlangıcı: 5 sn hazırlık + 5 sn geri sayım sonrası.
  IF NEW.countdown_started_at IS NOT NULL
     AND NEW.countdown_started_at IS DISTINCT FROM OLD.countdown_started_at THEN
    NEW.started_at := NEW.countdown_started_at + INTERVAL '10 seconds';
    NEW.ends_at := NEW.started_at + make_interval(secs => v_duration_seconds);
    RETURN NEW;
  END IF;

  -- Countdown kullanılmayan eski/özel akışlar için güvenli fallback.
  -- Oda yalnızca active yapıldı ama henüz countdown/started_at yoksa süreyi başlatma.
  IF NEW.status = 'active'
     AND NEW.ends_at IS NULL
     AND NEW.started_at IS NOT NULL THEN
    NEW.ends_at := NEW.started_at + make_interval(secs => v_duration_seconds);
  END IF;

  RETURN NEW;
END;
$function$;