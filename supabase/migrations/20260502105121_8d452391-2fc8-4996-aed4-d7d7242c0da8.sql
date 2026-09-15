CREATE OR REPLACE FUNCTION public.admin_add_joker(
  p_username text,
  p_joker_type text,
  p_quantity integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_existing_id uuid;
  v_existing_qty integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Yetkisiz');
  END IF;

  IF p_joker_type NOT IN ('joker_degistir', 'joker_fisilida', 'joker_senyaz') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Geçersiz joker tipi');
  END IF;

  SELECT id INTO v_user_id FROM public.profiles WHERE username = p_username LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Kullanıcı bulunamadı');
  END IF;

  SELECT id, quantity INTO v_existing_id, v_existing_qty
  FROM public.user_inventory
  WHERE user_id = v_user_id AND item_type = p_joker_type
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.user_inventory
    SET quantity = v_existing_qty + p_quantity
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.user_inventory (user_id, item_type, quantity)
    VALUES (v_user_id, p_joker_type, p_quantity);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'joker_type', p_joker_type,
    'added', p_quantity
  );
END;
$$;