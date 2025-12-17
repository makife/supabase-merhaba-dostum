-- Tournament trigger'ı game_rooms ile aynı mantığa çevir
CREATE OR REPLACE FUNCTION public.set_tournament_match_ends_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Game_rooms ile aynı mantık: status='in_progress' ve started_at set edildiğinde ends_at hesapla
  IF NEW.status = 'in_progress' AND NEW.started_at IS NOT NULL AND NEW.ends_at IS NULL THEN
    -- 120 saniye oyun süresi (game_rooms time_limit default ile aynı)
    NEW.ends_at := NEW.started_at + INTERVAL '120 seconds';
    RAISE LOG 'Tournament match ends_at set: started_at=% -> ends_at=%', NEW.started_at, NEW.ends_at;
  END IF;
  RETURN NEW;
END;
$function$;