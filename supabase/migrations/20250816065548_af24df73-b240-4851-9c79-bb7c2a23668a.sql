-- Tournament sistemi için fonksiyon güncelleme
CREATE OR REPLACE FUNCTION public.start_tournament_automatically(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_participants uuid[];
  v_participant_count integer;
  v_bots_needed integer;
  v_tournament tournaments%ROWTYPE;
BEGIN
  -- Turnuva durumunu kontrol et
  SELECT * INTO v_tournament
  FROM tournaments 
  WHERE id = p_tournament_id;
  
  IF v_tournament.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tournament not found');
  END IF;
  
  IF v_tournament.status != 'waiting' THEN
    RETURN json_build_object('success', false, 'error', 'Tournament already started');
  END IF;

  -- Mevcut katılımcıları al
  SELECT array_agg(user_id ORDER BY seed), COUNT(*) 
  INTO v_participants, v_participant_count
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id
  AND user_id IS NOT NULL;
  
  -- Bot ekle (8 kişiye tamamla)
  v_bots_needed := 8 - v_participant_count;
  
  IF v_bots_needed > 0 THEN
    FOR i IN 1..v_bots_needed LOOP
      INSERT INTO tournament_participants (
        tournament_id,
        user_id,
        seed,
        is_bot,
        joined_at
      ) VALUES (
        p_tournament_id,
        NULL,
        v_participant_count + i,
        true,
        now()
      );
    END LOOP;
  END IF;
  
  -- Tüm katılımcıları tekrar al (botlar dahil)
  SELECT array_agg(
    CASE WHEN user_id IS NOT NULL THEN user_id ELSE gen_random_uuid() END 
    ORDER BY seed
  ) INTO v_participants
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id;
  
  -- İlk tur maçlarını oluştur (8 kişi -> 4 maç)
  FOR i IN 1..4 LOOP
    INSERT INTO tournament_matches (
      tournament_id,
      round,
      match_number,
      player1_id,
      player2_id,
      status,
      created_at
    ) VALUES (
      p_tournament_id,
      1,
      i,
      v_participants[i * 2 - 1],
      v_participants[i * 2],
      'pending',
      now()
    );
  END LOOP;
  
  -- Turnuvayı başlat
  UPDATE tournaments 
  SET 
    status = 'active',
    started_at = now(),
    current_round = 1
  WHERE id = p_tournament_id;
  
  RETURN json_build_object(
    'success', true,
    'matches_created', 4,
    'participants', 8
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;