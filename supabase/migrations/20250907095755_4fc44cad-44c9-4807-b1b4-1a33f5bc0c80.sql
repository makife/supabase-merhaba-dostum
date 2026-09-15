-- Süresi geçmiş turnuvaları iptal et
UPDATE tournaments 
SET status = 'expired', 
    updated_at = now()
WHERE status = 'waiting' 
  AND expires_at < now();

-- Katılımcısı olmayan turnuvaları iptal et
UPDATE tournaments 
SET status = 'cancelled', 
    updated_at = now()
WHERE status = 'waiting' 
  AND id NOT IN (
    SELECT DISTINCT tournament_id 
    FROM tournament_participants 
    WHERE tournament_id IS NOT NULL
  );