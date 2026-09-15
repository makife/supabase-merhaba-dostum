-- Hayda kullanıcısının haftalık ve aylık puanlarını genel sıralama puanına eşitle
UPDATE weekly_stats 
SET total_score = 3236, updated_at = now()
WHERE user_id = (SELECT id FROM profiles WHERE username = 'Hayda');

UPDATE monthly_stats 
SET total_score = 3236, updated_at = now()
WHERE user_id = (SELECT id FROM profiles WHERE username = 'Hayda');

-- Ayrıca 5 bonus kredi ekleyelim harcanan krediler için
UPDATE profiles 
SET bonus_credits = COALESCE(bonus_credits, 0) + 5
WHERE username = 'Hayda';