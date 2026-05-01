DO $$
DECLARE
  v_user uuid := 'd8db37ac-f594-45a5-b499-5028322f9bf3'; -- makif
  v_badge uuid := 'b1000001-0000-0000-0000-000000000001';
  v_amount int := 20;
  v_oyun int := 25;
  v_credits int;
  v_bonus int;
  v_to_credits int;
  v_to_bonus int;
  v_current_boost timestamptz;
  v_new_boost timestamptz := now() + interval '30 days';
  v_final_boost timestamptz;
BEGIN
  -- Jokerler (degistir, fisilida, senyaz)
  INSERT INTO public.user_inventory (user_id, item_type, quantity)
  VALUES (v_user, 'joker_degistir', v_amount)
  ON CONFLICT (user_id, item_type)
  DO UPDATE SET quantity = public.user_inventory.quantity + v_amount, updated_at = now();

  INSERT INTO public.user_inventory (user_id, item_type, quantity)
  VALUES (v_user, 'joker_fisilida', v_amount)
  ON CONFLICT (user_id, item_type)
  DO UPDATE SET quantity = public.user_inventory.quantity + v_amount, updated_at = now();

  INSERT INTO public.user_inventory (user_id, item_type, quantity)
  VALUES (v_user, 'joker_senyaz', v_amount)
  ON CONFLICT (user_id, item_type)
  DO UPDATE SET quantity = public.user_inventory.quantity + v_amount, updated_at = now();

  -- Kredi dağıtımı (game_credits cap=5)
  SELECT COALESCE(game_credits,0), COALESCE(bonus_credits,0), score_boost_until
    INTO v_credits, v_bonus, v_current_boost
    FROM public.profiles WHERE id = v_user;

  v_to_credits := LEAST(v_oyun, GREATEST(0, 5 - v_credits));
  v_to_bonus := v_oyun - v_to_credits;
  v_final_boost := CASE WHEN v_current_boost IS NOT NULL AND v_current_boost > v_new_boost
                        THEN v_current_boost ELSE v_new_boost END;

  UPDATE public.profiles
     SET game_credits = v_credits + v_to_credits,
         bonus_credits = v_bonus + v_to_bonus,
         season_first_count = COALESCE(season_first_count,0) + 1,
         score_boost_until = v_final_boost,
         updated_at = now()
   WHERE id = v_user;

  -- Rozet (yoksa ekle)
  INSERT INTO public.user_badges (user_id, badge_id)
  SELECT v_user, v_badge
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_badges WHERE user_id = v_user AND badge_id = v_badge
  );

  -- Bildirim
  INSERT INTO public.notifications (user_id, type, message, is_read)
  VALUES (
    v_user,
    'leaderboard_prize',
    '🎉 Tebrikler! Sezon liderlik tablosunda 1. oldun! Ödüllerin: 20 Değiştir, 20 Fısılda, 20 Senyaz, +25 Oyun Sayfası ve 1 ay boyunca maç sonu puanlarınız x2! 🚀',
    false
  );
END $$;