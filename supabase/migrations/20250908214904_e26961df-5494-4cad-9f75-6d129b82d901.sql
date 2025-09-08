-- Fix type mismatches between uuid parameters and text columns in tournament-related functions

-- 1) check_and_award_badges: cast user id to text where comparing with tournament tables
CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id uuid)
RETURNS json[]
LANGUAGE plpgsql
AS $$
DECLARE
    user_stats RECORD;
    badge_record RECORD;
    new_badges JSON[] := '{}';
    new_badge JSON;
    tournament_stats RECORD;
BEGIN
    -- Kullanıcının mevcut istatistiklerini al
    SELECT 
        total_games, wins, losses, total_score, win_streak, 
        longest_word, average_score
    INTO user_stats
    FROM profiles 
    WHERE id = p_user_id;
    
    -- Turnuva istatistiklerini hesapla (text sütunlarla karşılaştırma için cast)
    SELECT 
        COUNT(*) FILTER (WHERE winner_id = p_user_id::text) as tournaments_won,
        COUNT(*) FILTER (WHERE winner_id != p_user_id::text) as tournaments_lost,
        COUNT(*) as tournaments_played
    INTO tournament_stats
    FROM tournament_matches 
    WHERE (player1_id = p_user_id::text OR player2_id = p_user_id::text) 
    AND status = 'completed';
    
    -- Tüm rozetleri kontrol et
    FOR badge_record IN 
        SELECT b.* FROM badges b
        LEFT JOIN user_badges ub ON b.id = ub.badge_id AND ub.user_id = p_user_id
        WHERE ub.badge_id IS NULL -- Henüz kazanılmamış rozetler
    LOOP
        -- Rozet koşulunu kontrol et
        IF badge_record.condition_type = 'games_played' AND user_stats.total_games >= badge_record.condition_value THEN
            -- Rozeti kullanıcıya ver
            INSERT INTO user_badges (user_id, badge_id, earned_at)
            VALUES (p_user_id, badge_record.id, NOW());
            
            -- Yeni rozet listesine ekle
            new_badge := json_build_object(
                'new_badge_id', badge_record.id,
                'new_badge_name', badge_record.name,
                'new_badge_icon', badge_record.icon
            );
            new_badges := new_badges || new_badge;
            
        ELSIF badge_record.condition_type = 'wins' AND user_stats.wins >= badge_record.condition_value THEN
            INSERT INTO user_badges (user_id, badge_id, earned_at)
            VALUES (p_user_id, badge_record.id, NOW());
            
            new_badge := json_build_object(
                'new_badge_id', badge_record.id,
                'new_badge_name', badge_record.name,
                'new_badge_icon', badge_record.icon
            );
            new_badges := new_badges || new_badge;
            
        ELSIF badge_record.condition_type = 'tournaments_won' AND COALESCE(tournament_stats.tournaments_won,0) >= badge_record.condition_value THEN
            INSERT INTO user_badges (user_id, badge_id, earned_at)
            VALUES (p_user_id, badge_record.id, NOW());
            
            new_badge := json_build_object(
                'new_badge_id', badge_record.id,
                'new_badge_name', badge_record.name,
                'new_badge_icon', badge_record.icon
            );
            new_badges := new_badges || new_badge;
            
        END IF;
    END LOOP;
    
    RETURN new_badges;
END;
$$;

-- 2) get_user_tournament_status: cast p_user_id to text for comparisons with text columns
CREATE OR REPLACE FUNCTION public.get_user_tournament_status(p_tournament_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_participant tournament_participants%ROWTYPE;
  v_current_match tournament_matches%ROWTYPE;
  v_next_match tournament_matches%ROWTYPE;
  v_user_matches json[];
  v_result json;
BEGIN
  -- Kullanıcının katılımcı bilgilerini al (user_id text olduğu için cast)
  SELECT * INTO v_participant
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id 
  AND user_id = p_user_id::text;
  
  IF v_participant.id IS NULL THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'User not in tournament'
    );
  END IF;
  
  -- Aktif maçını bul
  SELECT * INTO v_current_match
  FROM tournament_matches 
  WHERE tournament_id = p_tournament_id
  AND (player1_id = p_user_id::text OR player2_id = p_user_id::text)
  AND status = 'active'
  LIMIT 1;
  
  -- Bekleyen maçını bul
  SELECT * INTO v_next_match
  FROM tournament_matches 
  WHERE tournament_id = p_tournament_id
  AND (player1_id = p_user_id::text OR player2_id = p_user_id::text)
  AND status = 'pending'
  ORDER BY round, match_number
  LIMIT 1;
  
  -- Kullanıcının tüm maçlarını al
  SELECT array_agg(row_to_json(tm)) INTO v_user_matches
  FROM tournament_matches tm
  WHERE tm.tournament_id = p_tournament_id
  AND (tm.player1_id = p_user_id::text OR tm.player2_id = p_user_id::text)
  ORDER BY tm.round, tm.match_number;
  
  RETURN json_build_object(
    'success', true,
    'participant', row_to_json(v_participant),
    'current_match', row_to_json(v_current_match),
    'next_match', row_to_json(v_next_match),
    'all_matches', v_user_matches,
    'is_eliminated', v_participant.eliminated_at IS NOT NULL
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 3) complete_tournament_match: ensure winner_id (text) is assigned from uuid param via cast
CREATE OR REPLACE FUNCTION public.complete_tournament_match(p_match_id uuid, p_winner_id uuid, p_player1_score integer, p_player2_score integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tournament_id UUID;
  v_round INTEGER;
  v_result JSON;
BEGIN
  -- Maçı güncelle
  UPDATE tournament_matches 
  SET 
    status = 'completed',
    winner_id = p_winner_id::text,
    player1_score = p_player1_score,
    player2_score = p_player2_score,
    updated_at = NOW()
  WHERE id = p_match_id
  RETURNING tournament_id, round INTO v_tournament_id, v_round;

  -- Başarı sonucu döndür
  v_result := json_build_object(
    'success', true,
    'tournament_id', v_tournament_id,
    'round', v_round,
    'winner_id', p_winner_id
  );

  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;