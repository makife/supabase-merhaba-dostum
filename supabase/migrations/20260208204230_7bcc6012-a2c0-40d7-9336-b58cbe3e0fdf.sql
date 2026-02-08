
-- Bonus puanları artırmak için yardımcı RPC fonksiyonları oluştur

-- 1. Profiles tablosu için puan artırma
CREATE OR REPLACE FUNCTION public.increment_profile_score(
  p_user_id uuid,
  p_amount integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET total_score = COALESCE(total_score, 0) + p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- 2. Weekly stats tablosu için puan artırma
CREATE OR REPLACE FUNCTION public.increment_weekly_score(
  p_user_id uuid,
  p_amount integer,
  p_week_start date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Kayıt varsa güncelle, yoksa oluştur
  INSERT INTO public.weekly_stats (user_id, week_start, total_score, updated_at)
  VALUES (p_user_id, p_week_start, p_amount, NOW())
  ON CONFLICT (user_id, week_start) DO UPDATE SET
    total_score = weekly_stats.total_score + p_amount,
    updated_at = NOW();
END;
$$;

-- 3. Monthly stats tablosu için puan artırma
CREATE OR REPLACE FUNCTION public.increment_monthly_score(
  p_user_id uuid,
  p_amount integer,
  p_month_start date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Kayıt varsa güncelle, yoksa oluştur
  INSERT INTO public.monthly_stats (user_id, month_start, total_score, updated_at)
  VALUES (p_user_id, p_month_start, p_amount, NOW())
  ON CONFLICT (user_id, month_start) DO UPDATE SET
    total_score = monthly_stats.total_score + p_amount,
    updated_at = NOW();
END;
$$;
