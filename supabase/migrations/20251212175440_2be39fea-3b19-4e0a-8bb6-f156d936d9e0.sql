-- PostgREST cache'i yenilemek için NOTIFY gönder
NOTIFY pgrst, 'reload schema';

-- Fonksiyonu yeniden oluştur (aynı içerik, cache temizliği için)
CREATE OR REPLACE FUNCTION leave_tournament_with_transfer(
  p_tournament_id TEXT,
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament_uuid UUID;
  v_user_uuid UUID;
  v_tournament RECORD;
  v_new_creator_id UUID;
BEGIN
  -- Text'i UUID'ye çevir
  v_tournament_uuid := p_tournament_id::UUID;
  v_user_uuid := p_user_id::UUID;

  -- Turnuva bilgisini al
  SELECT creator_id INTO v_tournament
  FROM tournaments
  WHERE id = v_tournament_uuid;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Turnuva bulunamadı');
  END IF;
  
  -- Katılımcı kaydını sil
  DELETE FROM tournament_participants
  WHERE tournament_id = v_tournament_uuid AND user_id = v_user_uuid;
  
  -- Eğer kurucu ayrılıyorsa
  IF v_tournament.creator_id = v_user_uuid THEN
    -- Diğer gerçek oyuncuları bul
    SELECT user_id INTO v_new_creator_id
    FROM tournament_participants
    WHERE tournament_id = v_tournament_uuid AND is_bot = false
    ORDER BY joined_at ASC
    LIMIT 1;
    
    IF v_new_creator_id IS NOT NULL THEN
      -- Kuruculuğu devret
      UPDATE tournaments
      SET creator_id = v_new_creator_id
      WHERE id = v_tournament_uuid;
      
      RETURN json_build_object('success', true, 'action', 'transferred', 'new_creator_id', v_new_creator_id);
    ELSE
      -- Başka oyuncu yoksa turnuvayı iptal et
      UPDATE tournaments
      SET status = 'cancelled'
      WHERE id = v_tournament_uuid;
      
      RETURN json_build_object('success', true, 'action', 'cancelled');
    END IF;
  END IF;
  
  RETURN json_build_object('success', true, 'action', 'left');
END;
$$;