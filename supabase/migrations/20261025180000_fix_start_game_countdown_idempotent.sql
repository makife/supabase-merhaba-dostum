-- start_game_countdown cift cagrildiginda (rematch sonrasinda her iki client da oda
-- dolu kontrolunu bagimsiz calistirip ayni anda RPC yi tetikleyebiliyor) countdown_started_at
-- ikinci cagrida ezilip clientlarin farkli zaman damgasinda kilitlenmesine yol aciyordu.
-- Fonksiyonu idempotent yapiyoruz: sadece ilk cagri yazar, sonraki cagrilar mevcut degeri doner.
CREATE OR REPLACE FUNCTION public.start_game_countdown(p_room_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_now TIMESTAMPTZ;
  v_game_start TIMESTAMPTZ;
  v_player1_id UUID;
  v_player2_id UUID;
  v_existing_countdown TIMESTAMPTZ;
BEGIN
  SELECT countdown_started_at INTO v_existing_countdown
  FROM public.game_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF v_existing_countdown IS NOT NULL THEN
    RETURN v_existing_countdown;
  END IF;

  v_now := NOW();
  v_game_start := v_now + interval '10 seconds';

  SELECT user_id INTO v_player1_id
  FROM public.game_participants
  WHERE room_id = p_room_id AND is_bot = false
  ORDER BY joined_at ASC
  LIMIT 1;

  SELECT user_id INTO v_player2_id
  FROM public.game_participants
  WHERE room_id = p_room_id AND is_bot = false AND user_id != v_player1_id
  ORDER BY joined_at ASC
  LIMIT 1;

  UPDATE public.game_rooms
  SET
    countdown_started_at = v_now,
    started_at = v_game_start,
    status = 'active',
    player1_id = COALESCE(v_player1_id, player1_id),
    player2_id = COALESCE(v_player2_id, player2_id)
  WHERE id = p_room_id;

  RETURN v_now;
END;
$fn$;
