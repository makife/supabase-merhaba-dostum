/*
  # Turnuva İlerleme Fonksiyonu

  1. Yeni Fonksiyonlar
    - `advance_tournament_round` - Turnuvayı sonraki tura ilerletir
    - `get_room_participants_with_profiles` - Oda katılımcılarını profil bilgileri ile getirir
    
  2. Güvenlik
    - Tüm fonksiyonlar SECURITY DEFINER ile güvenli
    - search_path ayarları yapıldı
*/

-- Function to advance tournament to next round
CREATE OR REPLACE FUNCTION public.advance_tournament_round(p_tournament_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tournament RECORD;
  v_current_round INTEGER;
  v_next_round INTEGER;
  v_winners UUID[];
  v_matches_created INTEGER := 0;
BEGIN
  -- Get tournament info
  SELECT * INTO v_tournament
  FROM tournaments
  WHERE id = p_tournament_id;
  
  IF v_tournament.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tournament not found');
  END IF;
  
  v_current_round := v_tournament.current_round;
  v_next_round := v_current_round + 1;
  
  -- Check if current round is complete
  IF NOT EXISTS (
    SELECT 1 FROM tournament_matches 
    WHERE tournament_id = p_tournament_id 
    AND round = v_current_round 
    AND status != 'completed'
  ) THEN
    
    -- Get winners from current round
    SELECT array_agg(winner_id ORDER BY match_number)
    INTO v_winners
    FROM tournament_matches 
    WHERE tournament_id = p_tournament_id 
    AND round = v_current_round 
    AND status = 'completed'
    AND winner_id IS NOT NULL;
    
    -- Create next round matches
    FOR i IN 1..array_length(v_winners, 1) BY 2 LOOP
      IF i + 1 <= array_length(v_winners, 1) THEN
        INSERT INTO tournament_matches (
          tournament_id,
          round,
          match_number,
          player1_id,
          player2_id,
          status,
          created_at,
          updated_at
        ) VALUES (
          p_tournament_id,
          v_next_round,
          (i + 1) / 2,
          v_winners[i],
          v_winners[i + 1],
          'pending',
          NOW(),
          NOW()
        );
        
        v_matches_created := v_matches_created + 1;
      END IF;
    END LOOP;
    
    -- Update tournament round
    UPDATE tournaments 
    SET current_round = v_next_round
    WHERE id = p_tournament_id;
    
    RETURN json_build_object(
      'success', true,
      'next_round', v_next_round,
      'matches_created', v_matches_created,
      'winners', v_winners
    );
  ELSE
    RETURN json_build_object(
      'success', false, 
      'error', 'Current round not complete'
    );
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to get room participants with profile information
CREATE OR REPLACE FUNCTION public.get_room_participants_with_profiles(room_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', gp.id,
      'user_id', gp.user_id,
      'score', gp.score,
      'is_bot', gp.is_bot,
      'joined_at', gp.joined_at,
      'username', COALESCE(p.username, 'Bot'),
      'avatar_url', p.avatar_url
    )
  ) INTO v_result
  FROM game_participants gp
  LEFT JOIN profiles p ON p.id = gp.user_id
  WHERE gp.room_id = room_id;
  
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

-- Function to get room participants (simple version)
CREATE OR REPLACE FUNCTION public.get_room_participants(room_id UUID)
RETURNS TABLE(
  user_id UUID,
  score INTEGER,
  is_bot BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gp.user_id,
    gp.score,
    gp.is_bot,
    gp.joined_at as created_at
  FROM game_participants gp
  WHERE gp.room_id = room_id
  ORDER BY gp.joined_at;
END;
$$;

-- Function to generate random grid for games
CREATE OR REPLACE FUNCTION public.generate_random_grid()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_letters TEXT[] := ARRAY[
    'A','A','A','A','A','A','A','A',
    'E','E','E','E','E','E','E',
    'İ','İ','İ','İ','İ','İ',
    'I','I','I','I','I',
    'O','O','O','O','O',
    'U','U','U','U',
    'Ü','Ü','Ü',
    'Ö','Ö','Ö',
    'L','L','L','L','L',
    'N','N','N','N','N',
    'R','R','R','R','R',
    'K','K','K','K',
    'M','M','M','M',
    'T','T','T','T',
    'S','S','S','S',
    'D','D','D',
    'Y','Y','Y',
    'B','B','B',
    'C','C',
    'Ç','Ç',
    'F','F',
    'G','G',
    'Ğ','Ğ',
    'H','H',
    'J',
    'P','P',
    'Ş','Ş',
    'V','V',
    'Z'
  ];
  v_grid TEXT[][];
  v_row TEXT[];
  i INTEGER;
  j INTEGER;
BEGIN
  -- Generate 4x4 grid
  FOR i IN 1..4 LOOP
    v_row := ARRAY[]::TEXT[];
    FOR j IN 1..4 LOOP
      v_row := array_append(v_row, v_letters[1 + floor(random() * array_length(v_letters, 1))::INTEGER]);
    END LOOP;
    v_grid := array_append(v_grid, v_row);
  END LOOP;
  
  RETURN array_to_json(v_grid);
END;
$$;