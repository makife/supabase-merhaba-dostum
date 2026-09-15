-- Tournament match ends_at trigger'ını güncelle
-- 5s frontend buffer + 5s countdown + 120s oyun = 130 saniye
CREATE OR REPLACE FUNCTION set_tournament_match_ends_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.countdown_started_at IS NOT NULL AND OLD.countdown_started_at IS NULL THEN
    -- 130 saniye: 5s frontend buffer + 5s countdown + 120s oyun süresi
    NEW.ends_at = NEW.countdown_started_at + INTERVAL '130 seconds';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;