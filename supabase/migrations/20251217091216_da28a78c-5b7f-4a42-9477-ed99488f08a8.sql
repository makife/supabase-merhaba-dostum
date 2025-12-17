-- Update tournament match ends_at trigger to account for new 6.5s buffer
-- Old calculation: 130 seconds (5s buffer + 5s countdown + 120s game)
-- New calculation: 132 seconds (6.5s buffer + 5s countdown + 120s game + 0.5s tolerance)

CREATE OR REPLACE FUNCTION public.set_tournament_match_ends_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Sadece countdown_started_at set edildiğinde ends_at hesapla
  IF NEW.countdown_started_at IS NOT NULL AND OLD.countdown_started_at IS NULL THEN
    -- 132 saniye = 6.5s buffer (hazırlanıyor + hazır + bekleme) + 5s countdown + 120s oyun + 0.5s tolerans
    NEW.ends_at := NEW.countdown_started_at + INTERVAL '132 seconds';
    RAISE LOG 'Tournament match ends_at set: % -> %', NEW.countdown_started_at, NEW.ends_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;