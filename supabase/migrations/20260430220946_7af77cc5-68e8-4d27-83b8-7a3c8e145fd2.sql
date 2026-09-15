
CREATE OR REPLACE FUNCTION public.award_kelimele_badge(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge_id uuid;
  v_already_has boolean;
BEGIN
  SELECT id INTO v_badge_id FROM badges WHERE condition_type = 'kelimele_word' LIMIT 1;
  IF v_badge_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM user_badges WHERE user_id = p_user_id AND badge_id = v_badge_id
  ) INTO v_already_has;

  IF v_already_has THEN
    RETURN false;
  END IF;

  INSERT INTO user_badges (user_id, badge_id)
  VALUES (p_user_id, v_badge_id)
  ON CONFLICT (user_id, badge_id) DO NOTHING;

  INSERT INTO notifications (user_id, type, message, related_id)
  VALUES (
    p_user_id,
    'badge_earned',
    '🏆 Yeni rozet kazandınız: Saygın Kelimele Yazarı',
    v_badge_id::text
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_kelimele_badge(uuid) TO authenticated;
