CREATE OR REPLACE FUNCTION public.ensure_bot_tournament_pool()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target integer := 2 + floor(random() * 7)::integer; -- 2..8
  v_active_count integer := 0;
  v_to_create integer := 0;
  v_created_count integer := 0;
  v_slots_filled integer := 0;
  v_rows integer := 0;
  v_tournament_id uuid;
  v_tournament record;
BEGIN
  -- Tek seferde yalnızca bir üretim/temizlik çalışsın; çoklu cihaz çağrıları havuzu şişirmesin.
  PERFORM pg_advisory_xact_lock(hashtext('ensure_bot_tournament_pool'));

  PERFORM public.cleanup_expired_tournaments();

  UPDATE public.tournaments
  SET status = 'cancelled',
      finished_at = COALESCE(finished_at, now())
  WHERE status = 'waiting'
    AND COALESCE(is_bot_tournament, false) = true
    AND expires_at IS NOT NULL
    AND expires_at <= now();

  -- Aktif bot turnuvalarında katılımcı listesi 8 slot dolu kalsın.
  FOR v_tournament IN
    SELECT id
    FROM public.tournaments
    WHERE status = 'waiting'
      AND COALESCE(is_bot_tournament, false) = true
      AND (expires_at IS NULL OR expires_at > now())
  LOOP
    INSERT INTO public.tournament_participants (tournament_id, user_id, is_bot)
    SELECT v_tournament.id, gen_random_uuid(), true
    FROM generate_series(
      1,
      GREATEST(
        0,
        8 - (
          SELECT count(*)::integer
          FROM public.tournament_participants
          WHERE tournament_id = v_tournament.id
        )
      )
    );
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_slots_filled := v_slots_filled + v_rows;
  END LOOP;

  -- 8'in üstüne taşmış ve içinde gerçek oyuncu olmayan bot turnuvalarını kapat.
  WITH ranked AS (
    SELECT
      t.id,
      row_number() OVER (ORDER BY t.expires_at ASC NULLS LAST, t.created_at ASC) AS rn,
      EXISTS (
        SELECT 1
        FROM public.tournament_participants tp
        WHERE tp.tournament_id = t.id
          AND COALESCE(tp.is_bot, false) = false
      ) AS has_real_player
    FROM public.tournaments t
    WHERE t.status = 'waiting'
      AND COALESCE(t.is_bot_tournament, false) = true
      AND (t.expires_at IS NULL OR t.expires_at > now())
  )
  UPDATE public.tournaments t
  SET status = 'cancelled',
      finished_at = COALESCE(t.finished_at, now())
  FROM ranked r
  WHERE t.id = r.id
    AND r.rn > 8
    AND r.has_real_player = false;

  SELECT count(*)::integer
  INTO v_active_count
  FROM public.tournaments
  WHERE status = 'waiting'
    AND COALESCE(is_bot_tournament, false) = true
    AND (expires_at IS NULL OR expires_at > now());

  v_to_create := GREATEST(0, v_target - v_active_count);

  FOR i IN 1..v_to_create LOOP
    INSERT INTO public.tournaments (
      name,
      creator_id,
      status,
      game_type,
      max_participants,
      current_round,
      timeout_duration,
      expires_at,
      is_bot_tournament
    ) VALUES (
      'Turnuva ' || to_char(now() AT TIME ZONE 'Europe/Istanbul', 'HH24:MI'),
      NULL,
      'waiting',
      'timed',
      8,
      1,
      120,
      now() + interval '30 seconds',
      true
    )
    RETURNING id INTO v_tournament_id;

    v_created_count := v_created_count + 1;

    INSERT INTO public.tournament_participants (tournament_id, user_id, is_bot)
    SELECT v_tournament_id, gen_random_uuid(), true
    FROM generate_series(1, 8);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_slots_filled := v_slots_filled + v_rows;
  END LOOP;

  SELECT count(*)::integer
  INTO v_active_count
  FROM public.tournaments
  WHERE status = 'waiting'
    AND COALESCE(is_bot_tournament, false) = true
    AND (expires_at IS NULL OR expires_at > now());

  RETURN jsonb_build_object(
    'ok', true,
    'target', v_target,
    'activeBotTournaments', v_active_count,
    'created', v_created_count,
    'slotsFilled', v_slots_filled
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_bot_tournament_pool() TO anon, authenticated, service_role;