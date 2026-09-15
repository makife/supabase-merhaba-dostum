CREATE OR REPLACE FUNCTION public.claim_premium_daily_jokers(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_premium_until TIMESTAMP WITH TIME ZONE;
  v_premium_type TEXT;
  v_today DATE := CURRENT_DATE;
  v_already_claimed BOOLEAN;
  v_amount INT;
BEGIN
  SELECT premium_until, premium_type INTO v_premium_until, v_premium_type
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

  -- Yıllık = 7, aylık (veya tanımsız) = 5
  IF v_premium_type = 'premium_yearly' THEN
    v_amount := 7;
  ELSE
    v_amount := 5;
  END IF;

  INSERT INTO user_inventory (user_id, item_type, quantity, updated_at)
  VALUES (p_user_id, 'joker_degistir', v_amount, now())
  ON CONFLICT (user_id, item_type)
  DO UPDATE SET quantity = user_inventory.quantity + v_amount, updated_at = now();

  INSERT INTO user_inventory (user_id, item_type, quantity, updated_at)
  VALUES (p_user_id, 'joker_fisilida', v_amount, now())
  ON CONFLICT (user_id, item_type)
  DO UPDATE SET quantity = user_inventory.quantity + v_amount, updated_at = now();

  INSERT INTO user_inventory (user_id, item_type, quantity, updated_at)
  VALUES (p_user_id, 'joker_senyaz', v_amount, now())
  ON CONFLICT (user_id, item_type)
  DO UPDATE SET quantity = user_inventory.quantity + v_amount, updated_at = now();

  INSERT INTO premium_daily_rewards (user_id, reward_date, degistir_given, fisilida_given, senyaz_given)
  VALUES (p_user_id, v_today, v_amount, v_amount, v_amount);

  RETURN json_build_object(
    'success', true,
    'message', 'Günlük jokerler eklendi!',
    'jokers', json_build_object('degistir', v_amount, 'fisilida', v_amount, 'senyaz', v_amount),
    'premium_type', COALESCE(v_premium_type, 'premium_monthly'),
    'amount', v_amount
  );
END;
$$;