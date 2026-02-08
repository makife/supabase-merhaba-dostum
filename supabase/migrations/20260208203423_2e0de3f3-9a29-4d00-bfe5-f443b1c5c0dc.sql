
-- Hayda kullanıcısının haftalık ve aylık puanlarını genel puanla senkronize et (934 puan)
-- Mevcut hafta için weekly_stats güncelle
UPDATE weekly_stats 
SET total_score = 934, updated_at = NOW()
WHERE user_id = '061c8121-e003-4f82-a540-acc36c6a2997' 
  AND week_start = DATE_TRUNC('week', CURRENT_DATE)::date;

-- Mevcut ay için monthly_stats güncelle
UPDATE monthly_stats 
SET total_score = 934, updated_at = NOW()
WHERE user_id = '061c8121-e003-4f82-a540-acc36c6a2997' 
  AND month_start = DATE_TRUNC('month', CURRENT_DATE)::date;
