
-- Add leaderboard championship count columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS weekly_first_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_first_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS season_first_count integer NOT NULL DEFAULT 0;

-- Insert 3 championship badges
INSERT INTO public.badges (id, name, description, icon, condition_type, condition_value)
VALUES
  ('b1000001-0000-0000-0000-000000000001', 'Sezon Şampiyonu', 'Genel sıralamada 1. ol', '🏆', 'season_champion', 1),
  ('b1000001-0000-0000-0000-000000000002', 'Haftanın Yıldızı', 'Haftalık sıralamada 1. ol', '⭐', 'weekly_champion', 1),
  ('b1000001-0000-0000-0000-000000000003', 'Ayın Lideri', 'Aylık sıralamada 1. ol', '👑', 'monthly_champion', 1)
ON CONFLICT (id) DO NOTHING;
