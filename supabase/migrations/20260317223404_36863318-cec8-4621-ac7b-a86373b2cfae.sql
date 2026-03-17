
-- Fix melihaslanoglu's profile total_score to match monthly stats (the authoritative source)
-- Also merge the duplicate weekly_stats rows
UPDATE public.profiles
SET total_score = 4682, updated_at = NOW()
WHERE id = '4c0baa2c-be87-4779-b521-e6cc55af605e';

-- Merge weekly row 2026-03-17 into 2026-03-16 (the correct week_start for this week)
UPDATE public.weekly_stats
SET 
  total_score = total_score + (SELECT total_score FROM public.weekly_stats WHERE user_id = '4c0baa2c-be87-4779-b521-e6cc55af605e' AND week_start = '2026-03-17'),
  games_played = games_played + (SELECT games_played FROM public.weekly_stats WHERE user_id = '4c0baa2c-be87-4779-b521-e6cc55af605e' AND week_start = '2026-03-17'),
  games_won = games_won + (SELECT games_won FROM public.weekly_stats WHERE user_id = '4c0baa2c-be87-4779-b521-e6cc55af605e' AND week_start = '2026-03-17'),
  total_words = total_words + (SELECT total_words FROM public.weekly_stats WHERE user_id = '4c0baa2c-be87-4779-b521-e6cc55af605e' AND week_start = '2026-03-17'),
  updated_at = NOW()
WHERE user_id = '4c0baa2c-be87-4779-b521-e6cc55af605e' AND week_start = '2026-03-16';

DELETE FROM public.weekly_stats
WHERE user_id = '4c0baa2c-be87-4779-b521-e6cc55af605e' AND week_start = '2026-03-17';
