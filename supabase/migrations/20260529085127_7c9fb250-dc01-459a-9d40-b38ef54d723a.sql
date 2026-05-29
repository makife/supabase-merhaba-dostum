CREATE OR REPLACE FUNCTION public.join_tournament_replacing_bot(p_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_tournament record;
  v_real_count int := 0;
  v_total_count int := 0;
  v_bot_slot_id uuid;
  v_is_first_real boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Oturum gerekli');
  END IF;

  SELECT id, status, COALESCE(is_bot_tournament, false) AS is_bot_tournament, creator_id, COALESCE(max_participants, 8) AS max_participants
  INTO v_tournament
  FROM public.tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Turnuva bulunamadı');
  END IF;

  IF v_tournament.status <> 'waiting' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Turnuva başlamış');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tournament_participants
    WHERE tournament_id = p_tournament_id
      AND user_id = v_user_id
      AND COALESCE(is_bot, false) = false
  ) THEN
    RETURN jsonb_build_object('success', true, 'already_joined', true);
  END IF;

  SELECT COUNT(*) INTO v_real_count
  FROM public.tournament_participants
  WHERE tournament_id = p_tournament_id
    AND COALESCE(is_bot, false) = false;

  IF v_real_count >= v_tournament.max_participants THEN
    RETURN jsonb_build_object('success', false, 'error', 'Turnuva dolu');
  END IF;

  v_is_first_real := v_real_count = 0;

  IF v_tournament.is_bot_tournament THEN
    SELECT id INTO v_bot_slot_id
    FROM public.tournament_participants
    WHERE tournament_id = p_tournament_id
      AND COALESCE(is_bot, false) = true
    ORDER BY random()
    LIMIT 1
    FOR UPDATE;

    IF v_bot_slot_id IS NOT NULL THEN
      UPDATE public.tournament_participants
      SET user_id = v_user_id,
          is_bot = false,
          joined_at = now()
      WHERE id = v_bot_slot_id;
    ELSE
      SELECT COUNT(*) INTO v_total_count
      FROM public.tournament_participants
      WHERE tournament_id = p_tournament_id;

      IF v_total_count >= v_tournament.max_participants THEN
        RETURN jsonb_build_object('success', false, 'error', 'Turnuva dolu');
      END IF;

      INSERT INTO public.tournament_participants (tournament_id, user_id, is_bot, joined_at)
      VALUES (p_tournament_id, v_user_id, false, now());
    END IF;

    IF v_tournament.creator_id IS NULL OR v_is_first_real THEN
      UPDATE public.tournaments
      SET creator_id = v_user_id,
          expires_at = now() + interval '30 seconds'
      WHERE id = p_tournament_id;
    END IF;
  ELSE
    INSERT INTO public.tournament_participants (tournament_id, user_id, is_bot, joined_at)
    VALUES (p_tournament_id, v_user_id, false, now());
  END IF;

  RETURN jsonb_build_object('success', true, 'replaced_bot', v_tournament.is_bot_tournament);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'already_joined', true);
  WHEN others THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.join_tournament_replacing_bot(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_tournament_replacing_bot(uuid) TO service_role;