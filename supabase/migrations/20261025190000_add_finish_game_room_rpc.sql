CREATE OR REPLACE FUNCTION public.finish_game_room(p_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_room RECORD;
  v_p1_score INT;
  v_p2_score INT;
  v_winner UUID;
  v_time_up BOOLEAN;
  v_score_reached BOOLEAN;
BEGIN
  SELECT * INTO v_room FROM public.game_rooms WHERE id = p_room_id FOR UPDATE;

  IF v_room IS NULL THEN
    RAISE EXCEPTION 'ROOM_NOT_FOUND';
  END IF;

  IF v_room.status = 'finished' THEN
    RETURN jsonb_build_object(
      'already_finished', true,
      'winner_id', v_room.winner_id,
      'player1_id', v_room.player1_id,
      'player2_id', v_room.player2_id,
      'player1_score', v_room.player1_score,
      'player2_score', v_room.player2_score
    );
  END IF;

  IF v_room.player1_id IS NULL OR v_room.player2_id IS NULL THEN
    v_room.player1_id := COALESCE(v_room.player1_id, (
      SELECT user_id FROM public.game_participants
      WHERE room_id = p_room_id AND is_bot = false
      ORDER BY joined_at ASC LIMIT 1
    ));
    v_room.player2_id := COALESCE(v_room.player2_id, (
      SELECT user_id FROM public.game_participants
      WHERE room_id = p_room_id AND is_bot = false AND user_id != v_room.player1_id
      ORDER BY joined_at ASC LIMIT 1
    ));
  END IF;

  SELECT COALESCE(SUM(points), 0) INTO v_p1_score
  FROM public.game_words WHERE room_id = p_room_id AND player_id = v_room.player1_id;

  SELECT COALESCE(SUM(points), 0) INTO v_p2_score
  FROM public.game_words WHERE room_id = p_room_id AND player_id = v_room.player2_id;

  -- Sunucu kendi bitis kosulunu dogrular, client'in "bitti" demesine guvenmez.
  -- 3 saniyelik tolerans: ServerTimeContext ile senkronize olsa da kucuk sapmalar icin.
  v_time_up := v_room.time_limit IS NOT NULL AND v_room.time_limit > 0
    AND v_room.started_at IS NOT NULL
    AND NOW() >= v_room.started_at + (v_room.time_limit || ' seconds')::interval - interval '3 seconds';

  v_score_reached := v_room.max_score IS NOT NULL AND v_room.max_score > 0
    AND (v_p1_score >= v_room.max_score OR v_p2_score >= v_room.max_score);

  IF NOT v_time_up AND NOT v_score_reached THEN
    RAISE EXCEPTION 'GAME_NOT_OVER_YET';
  END IF;

  v_winner := CASE
    WHEN v_p1_score > v_p2_score THEN v_room.player1_id
    WHEN v_p2_score > v_p1_score THEN v_room.player2_id
    ELSE NULL
  END;

  UPDATE public.game_rooms
  SET
    status = 'finished',
    finished_at = NOW(),
    winner_id = v_winner,
    player1_id = v_room.player1_id,
    player2_id = v_room.player2_id,
    player1_score = v_p1_score,
    player2_score = v_p2_score
  WHERE id = p_room_id;

  RETURN jsonb_build_object(
    'already_finished', false,
    'winner_id', v_winner,
    'player1_id', v_room.player1_id,
    'player2_id', v_room.player2_id,
    'player1_score', v_p1_score,
    'player2_score', v_p2_score
  );
END;
$fn$;
