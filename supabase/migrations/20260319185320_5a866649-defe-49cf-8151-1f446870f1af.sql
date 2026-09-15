CREATE OR REPLACE FUNCTION set_tournament_match_ends_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_progress' AND (OLD.status IS DISTINCT FROM 'in_progress') THEN
    -- 1. COUNTDOWN BAŞLANGICI: Şu an + 2 Saniye (bekleme animasyonu)
    NEW.countdown_started_at := now() + INTERVAL '2 seconds';

    -- 2. OYUN BAŞLANGICI: countdown + 10 saniye (5s hazırlık + 5s geri sayım)
    NEW.started_at := NEW.countdown_started_at + INTERVAL '10 seconds';

    -- 3. OYUN BİTİŞİ: started_at + 120 saniye (net oyun süresi)
    NEW.ends_at := NEW.started_at + INTERVAL '120 seconds';

    RAISE LOG 'Tournament Start: countdown=+2s, prep+countdown=+12s, game=120s, total=132s';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;