-- Maçsız aktif turnuvaları temizle ve yeni turnuva sistemi için hazırla
UPDATE tournaments 
SET status = 'cancelled', finished_at = now()
WHERE status = 'active' 
AND id NOT IN (
  SELECT DISTINCT tournament_id 
  FROM tournament_matches 
  WHERE tournament_id IS NOT NULL
);

-- Maçsız turnuva katılımcılarını temizle
DELETE FROM tournament_participants
WHERE tournament_id IN (
  SELECT id FROM tournaments 
  WHERE status = 'cancelled'
);