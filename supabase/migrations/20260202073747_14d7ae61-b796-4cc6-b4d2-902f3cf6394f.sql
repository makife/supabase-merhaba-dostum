-- Profiles tablosuna bonus_spins sütunu ekle
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bonus_spins integer NOT NULL DEFAULT 0;

-- Mevcut kullanıcılara başlangıç değeri
UPDATE public.profiles SET bonus_spins = 0 WHERE bonus_spins IS NULL;

COMMENT ON COLUMN public.profiles.bonus_spins IS 'Turnuva veya ödüllerden kazanılan ekstra çark çevirme hakları';