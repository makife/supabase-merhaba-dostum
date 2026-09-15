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
  SELECT premium_until INTO v_premium_until
  FROM profiles
  WHERE id = p_user_id;
  
  IF v_premium_until IS NULL OR v_premium_until < now() THEN
    RETURN json_build_object('success', false, 'message', 'Premium üyelik gerekli');
  END IF;
  
  SELECT EXISTS(
    SELECT 1 FROM premium_daily_rewards 
    WHERE user_id = p_user_id AND reward_date = v_today
  ) INTO v_already_claimed;
  
  IF v_already_claimed THEN
    RETURN json_build_object('success', false, 'message', 'Bugünkü jokerler zaten alındı');
  END IF;
  
  INSERT INTO user_inventory (user_id, item_type, quantity, updated_at)
  VALUES (p_user_id, 'joker_degistir', 5, now())
  ON CONFLICT (user_id, item_type) 
  DO UPDATE SET quantity = user_inventory.quantity + 5, updated_at = now();
  
  INSERT INTO user_inventory (user_id, item_type, quantity, updated_at)
  VALUES (p_user_id, 'joker_fisilida', 5, now())
  ON CONFLICT (user_id, item_type) 
  DO UPDATE SET quantity = user_inventory.quantity + 5, updated_at = now();
  
  INSERT INTO user_inventory (user_id, item_type, quantity, updated_at)
  VALUES (p_user_id, 'joker_senyaz', 5, now())
  ON CONFLICT (user_id, item_type) 
  DO UPDATE SET quantity = user_inventory.quantity + 5, updated_at = now();
  
  INSERT INTO premium_daily_rewards (user_id, reward_date, degistir_given, fisilida_given, senyaz_given)
  VALUES (p_user_id, v_today, 5, 5, 5);
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Günlük jokerler eklendi!',
    'jokers', json_build_object('degistir', 5, 'fisilida', 5, 'senyaz', 5)
  );
END;
$$;