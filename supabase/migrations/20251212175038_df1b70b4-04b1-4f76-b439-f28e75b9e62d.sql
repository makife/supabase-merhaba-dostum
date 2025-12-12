-- Turnuvadan ayrılma RPC fonksiyonu (UUID tip uyumluluğu için)
CREATE OR REPLACE FUNCTION leave_tournament_with_transfer(
  p_tournament_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament RECORD;
  v_new_creator_id UUID;
  v_result JSON;
BEGIN
  -- Turnuva bilgisini al
  SELECT creator_id INTO v_tournament
  FROM tournaments
  WHERE id = p_tournament_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Turnuva bulunamadı');
  END IF;
  
  -- Katılımcı kaydını sil
  DELETE FROM tournament_participants
  WHERE tournament_id = p_tournament_id AND user_id = p_user_id;
  
  -- Eğer kurucu ayrılıyorsa
  IF v_tournament.creator_id = p_user_id THEN
    -- Diğer gerçek oyuncuları bul
    SELECT user_id INTO v_new_creator_id
    FROM tournament_participants
    WHERE tournament_id = p_tournament_id AND is_bot = false
    ORDER BY joined_at ASC
    LIMIT 1;
    
    IF v_new_creator_id IS NOT NULL THEN
      -- Kuruculuğu devret
      UPDATE tournaments
      SET creator_id = v_new_creator_id
      WHERE id = p_tournament_id;
      
      RETURN json_build_object('success', true, 'action', 'transferred', 'new_creator_id', v_new_creator_id);
    ELSE
      -- Başka oyuncu yoksa turnuvayı iptal et
      UPDATE tournaments
      SET status = 'cancelled'
      WHERE id = p_tournament_id;
      
      RETURN json_build_object('success', true, 'action', 'cancelled');
    END IF;
  END IF;
  
  RETURN json_build_object('success', true, 'action', 'left');
END;
$$;