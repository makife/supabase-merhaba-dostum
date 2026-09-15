-- Premium kullanıcılar için günlük joker dağıtım tablosu
CREATE TABLE IF NOT EXISTS public.premium_daily_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_date DATE NOT NULL DEFAULT CURRENT_DATE,
  degistir_given INTEGER NOT NULL DEFAULT 0,
  fisilida_given INTEGER NOT NULL DEFAULT 0,
  senyaz_given INTEGER NOT NULL DEFAULT 0,
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, reward_date)
);

-- RLS enable
ALTER TABLE public.premium_daily_rewards ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar sadece kendi kayıtlarını görebilir
CREATE POLICY "Users can view their own rewards" 
ON public.premium_daily_rewards 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rewards" 
ON public.premium_daily_rewards 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Premium kullanıcılara günlük joker veren fonksiyon
CREATE OR REPLACE FUNCTION public.claim_premium_daily_jokers(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_premium_until TIMESTAMP WITH TIME ZONE;
  v_today DATE := CURRENT_DATE;
  v_already_claimed BOOLEAN;
  v_result JSON;
BEGIN
  -- Premium durumunu kontrol et
  SELECT premium_until INTO v_premium_until
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_premium_until IS NULL OR v_premium_until < now() THEN
    RETURN json_build_object('success', false, 'message', 'Premium üyelik gerekli');
  END IF;
  
  -- Bugün zaten alınmış mı?
  SELECT EXISTS(
    SELECT 1 FROM premium_daily_rewards 
    WHERE user_id = p_user_id AND reward_date = v_today
  ) INTO v_already_claimed;
  
  IF v_already_claimed THEN
    RETURN json_build_object('success', false, 'message', 'Bugünkü jokerler zaten alındı');
  END IF;
  
  -- Joker kayıtlarını ekle veya güncelle
  -- Değiştir jokeri
  INSERT INTO user_inventory (user_id, item_type, quantity, updated_at)
  VALUES (p_user_id, 'joker_degistir', 3, now())
  ON CONFLICT (user_id, item_type) 
  DO UPDATE SET quantity = user_inventory.quantity + 3, updated_at = now();
  
  -- Fısılda jokeri
  INSERT INTO user_inventory (user_id, item_type, quantity, updated_at)
  VALUES (p_user_id, 'joker_fisilida', 3, now())
  ON CONFLICT (user_id, item_type) 
  DO UPDATE SET quantity = user_inventory.quantity + 3, updated_at = now();
  
  -- Sen Yaz jokeri
  INSERT INTO user_inventory (user_id, item_type, quantity, updated_at)
  VALUES (p_user_id, 'joker_senyaz', 3, now())
  ON CONFLICT (user_id, item_type) 
  DO UPDATE SET quantity = user_inventory.quantity + 3, updated_at = now();
  
  -- Günlük ödül kaydı oluştur
  INSERT INTO premium_daily_rewards (user_id, reward_date, degistir_given, fisilida_given, senyaz_given)
  VALUES (p_user_id, v_today, 3, 3, 3);
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Günlük jokerler eklendi!',
    'jokers', json_build_object('degistir', 3, 'fisilida', 3, 'senyaz', 3)
  );
END;
$$;

-- Makifergan kullanıcısının premium_until değerini güncelle (bir aylık)
UPDATE profiles 
SET premium_until = now() + INTERVAL '1 month'
WHERE id = 'd8db37ac-f594-45a5-b499-5028322f9bf3';