-- Duplicate liderlik bildirimlerini temizle (sadece ilk bildirimi bırak, her tür için)
-- Bu bir veri temizliği, schema değişikliği değil ama notifications tablosundaki kirli veriyi temizliyoruz

-- Önce weekly_first_count düzelt (2 → 1)
UPDATE profiles SET weekly_first_count = 1 WHERE id = 'd8db37ac-f594-45a5-b499-5028322f9bf3' AND weekly_first_count = 2;

-- Duplicate bildirimleri sil (her tür için ilk bildirimi bırak)
DELETE FROM notifications 
WHERE user_id = 'd8db37ac-f594-45a5-b499-5028322f9bf3' 
AND message LIKE '%liderlik tablosunda 1. oldun%'
AND id NOT IN (
  -- Her benzersiz mesaj için en eski bildirimi koru
  SELECT DISTINCT ON (message) id 
  FROM notifications 
  WHERE user_id = 'd8db37ac-f594-45a5-b499-5028322f9bf3' 
  AND message LIKE '%liderlik tablosunda 1. oldun%'
  ORDER BY message, created_at ASC
);

-- Sezon bildirimini de sil (henüz sezon bitmedi, yanlış verilmiş)
DELETE FROM notifications 
WHERE user_id = 'd8db37ac-f594-45a5-b499-5028322f9bf3' 
AND message LIKE '%Sezon liderlik%';