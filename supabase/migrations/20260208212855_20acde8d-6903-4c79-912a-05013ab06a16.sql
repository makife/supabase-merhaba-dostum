
-- VS-Bot modundan kaynaklanan puan farkını senkronize et
UPDATE public.weekly_stats 
SET total_score = (SELECT total_score FROM profiles WHERE username = 'Hayda')
WHERE user_id = (SELECT id FROM profiles WHERE username = 'Hayda')
  AND week_start = DATE_TRUNC('week', CURRENT_DATE)::date;

UPDATE public.monthly_stats 
SET total_score = (SELECT total_score FROM profiles WHERE username = 'Hayda')
WHERE user_id = (SELECT id FROM profiles WHERE username = 'Hayda')
  AND month_start = DATE_TRUNC('month', CURRENT_DATE)::date;
