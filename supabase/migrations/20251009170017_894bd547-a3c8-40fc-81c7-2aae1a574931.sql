-- Oyun başlatıldığında grid oluştur ve kaydet
CREATE OR REPLACE FUNCTION public.start_game_countdown(p_room_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_countdown_time TIMESTAMPTZ;
  v_grid JSONB;
BEGIN
  v_countdown_time := NOW();
  
  -- Eğer current_grid yoksa yeni grid oluştur
  SELECT current_grid INTO v_grid
  FROM game_rooms
  WHERE id = p_room_id;
  
  IF v_grid IS NULL OR v_grid = '[]'::jsonb THEN
    v_grid := generate_random_grid();
  END IF;
  
  UPDATE game_rooms
  SET countdown_started_at = v_countdown_time,
      current_grid = v_grid,
      updated_at = NOW()
  WHERE id = p_room_id;
  
  RETURN v_countdown_time;
END;
$$;