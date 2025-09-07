-- Önce status constraint'ini kontrol et ve güncelle
ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_status_check;

-- Yeni constraint ekle (expired dahil)
ALTER TABLE tournaments ADD CONSTRAINT tournaments_status_check 
CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled', 'expired'));

-- Süresi geçmiş turnuvaları expired olarak işaretle
UPDATE tournaments 
SET status = 'expired', 
    updated_at = now()
WHERE status = 'waiting' 
  AND expires_at < now();

-- Katılımcısı olmayan turnuvaları cancelled olarak işaretle
UPDATE tournaments 
SET status = 'cancelled', 
    updated_at = now()
WHERE status = 'waiting' 
  AND id NOT IN (
    SELECT DISTINCT tournament_id 
    FROM tournament_participants 
    WHERE tournament_id IS NOT NULL
  );