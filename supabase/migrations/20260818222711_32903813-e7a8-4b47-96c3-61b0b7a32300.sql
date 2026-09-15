-- (a) Arama indeksleri
CREATE INDEX IF NOT EXISTS idx_game_rooms_random_search
  ON public.game_rooms (game_mode, game_type_new, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_rooms_waiting_created
  ON public.game_rooms (created_at DESC)
  WHERE status = 'waiting';

-- (b) Atomik eşleşme: boş oda kap ya da yeni oda kur
CREATE OR REPLACE FUNCTION public.find_or_create_random_room(
  p_game_type text,
  p_grid text[],
  p_exclude uuid[] DEFAULT '{}'::uuid[]
)
RETURNS TABLE (room_id uuid, joined boolean, host_id uuid, current_grid text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_room public.game_rooms;
  v_new_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Aynı anda arayan başka oyuncuların kilitlediği odaları atla (SKIP LOCKED)
  SELECT r.* INTO v_room
  FROM public.game_rooms r
  WHERE r.game_mode = 'random-match'
    AND r.game_type_new = p_game_type
    AND r.status = 'waiting'
    AND r.created_at > now() - interval '120 seconds'
    AND r.host_id IS DISTINCT FROM v_uid
    AND NOT (r.id = ANY (COALESCE(p_exclude, '{}'::uuid[])))
    AND (
      SELECT count(*) FROM public.game_participants gp WHERE gp.room_id = r.id
    ) = 1
  ORDER BY random()
  LIMIT 1
  FOR UPDATE OF r SKIP LOCKED;

  IF v_room.id IS NOT NULL THEN
    INSERT INTO public.game_participants (room_id, user_id, score, is_bot)
    VALUES (v_room.id, v_uid, 0, false)
    ON CONFLICT DO NOTHING;

    RETURN QUERY SELECT v_room.id, true, v_room.host_id, v_room.current_grid;
    RETURN;
  END IF;

  -- Boş oda yok → yeni oda kur
  v_new_id := gen_random_uuid();

  INSERT INTO public.game_rooms (
    id, room_code, host_id, game_mode, game_type_new, status,
    max_players, time_limit, max_score, current_grid
  ) VALUES (
    v_new_id, v_new_id::text, v_uid, 'random-match', p_game_type, 'waiting',
    2,
    CASE WHEN p_game_type = 'timed' THEN 120 ELSE 0 END,
    CASE WHEN p_game_type = 'score' THEN 500 ELSE 0 END,
    p_grid
  );

  INSERT INTO public.game_participants (room_id, user_id, score, is_bot)
  VALUES (v_new_id, v_uid, 0, false)
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT v_new_id, false, v_uid, p_grid;
END;
$$;

REVOKE ALL ON FUNCTION public.find_or_create_random_room(text, text[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_or_create_random_room(text, text[], uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_random_room(text, text[], uuid[]) TO service_role;