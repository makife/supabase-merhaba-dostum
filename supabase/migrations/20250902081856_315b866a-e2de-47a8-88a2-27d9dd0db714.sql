-- Turnuva sistemindeki sorunları çözelim

-- 1. Tournament participant sayısını doğru şekilde takip etmek için gereken düzeltmeler
-- tournament_participants tablosuna seed kolonu ekleyelim
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS seed INTEGER DEFAULT 1;

-- 2. Tournament tablosunu güvenli hale getirmek için RLS politikaları ekleyelim
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

-- Turnuvalar herkese görünür olsun
CREATE POLICY "Turnuvalar herkese görünür" 
ON tournaments FOR SELECT 
USING (true);

-- Kullanıcılar turnuva oluşturabilir
CREATE POLICY "Kullanıcılar turnuva oluşturabilir" 
ON tournaments FOR INSERT 
WITH CHECK (auth.uid() = creator_id);

-- Turnuva yaratıcıları kendi turnuvalarını güncelleyebilir
CREATE POLICY "Turnuva yaratıcıları kendi turnuvalarını güncelleyebilir" 
ON tournaments FOR UPDATE 
USING (auth.uid() = creator_id);

-- 3. Tournament participants için RLS politikaları
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;

-- Katılımcılar herkese görünür
CREATE POLICY "Katılımcılar herkese görünür" 
ON tournament_participants FOR SELECT 
USING (true);

-- Kullanıcılar turnuvaya katılabilir
CREATE POLICY "Kullanıcılar turnuvaya katılabilir" 
ON tournament_participants FOR INSERT 
WITH CHECK (auth.uid()::text = user_id OR is_bot = true);

-- 4. Tournament matches için RLS politikaları
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

-- Maçlar herkese görünür
CREATE POLICY "Maçlar herkese görünür" 
ON tournament_matches FOR SELECT 
USING (true);

-- Sistem maçları oluşturabilir ve güncelleyebilir
CREATE POLICY "Sistem maçları yönetebilir" 
ON tournament_matches FOR ALL 
USING (true);

-- 5. Tournament otomatik başlatma fonksiyonu
CREATE OR REPLACE FUNCTION start_tournament_automatically(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_tournament tournaments%ROWTYPE;
    v_participant_count INTEGER;
    v_real_player_count INTEGER;
    v_bot_count INTEGER;
    v_result JSON;
BEGIN
    -- Turnuva kontrolü
    SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id;
    
    IF v_tournament.status != 'waiting' THEN
        RETURN JSON_BUILD_OBJECT(
            'success', false,
            'error', 'Turnuva zaten başlamış'
        );
    END IF;
    
    -- Gerçek oyuncu sayısını hesapla
    SELECT COUNT(*) INTO v_real_player_count 
    FROM tournament_participants 
    WHERE tournament_id = p_tournament_id 
    AND user_id IS NOT NULL 
    AND is_bot = false;
    
    -- En az 1 gerçek oyuncu olmalı
    IF v_real_player_count < 1 THEN
        RETURN JSON_BUILD_OBJECT(
            'success', false,
            'error', 'En az 1 gerçek oyuncu gereklidir'
        );
    END IF;
    
    -- Eksik bot sayısını hesapla
    SELECT COUNT(*) INTO v_participant_count FROM tournament_participants WHERE tournament_id = p_tournament_id;
    v_bot_count := 8 - v_participant_count;
    
    -- Eksik botları ekle
    IF v_bot_count > 0 THEN
        FOR i IN 1..v_bot_count LOOP
            INSERT INTO tournament_participants (tournament_id, user_id, seed, is_bot)
            VALUES (
                p_tournament_id,
                'bot_' || p_tournament_id || '_' || i,
                v_participant_count + i,
                true
            );
        END LOOP;
    END IF;
    
    -- İlk tur maçlarını oluştur
    WITH participants_ordered AS (
        SELECT user_id, seed, ROW_NUMBER() OVER (ORDER BY seed) as rn
        FROM tournament_participants 
        WHERE tournament_id = p_tournament_id
        ORDER BY seed
    )
    INSERT INTO tournament_matches (tournament_id, round, match_number, player1_id, player2_id, status)
    SELECT 
        p_tournament_id,
        1,
        CEIL(p1.rn / 2.0)::INTEGER,
        p1.user_id,
        p2.user_id,
        'pending'
    FROM participants_ordered p1
    JOIN participants_ordered p2 ON p2.rn = p1.rn + 1
    WHERE p1.rn % 2 = 1;
    
    -- Üst turların boş maçlarını oluştur
    -- Yarı final (2. tur)
    INSERT INTO tournament_matches (tournament_id, round, match_number, player1_id, player2_id, status)
    VALUES 
        (p_tournament_id, 2, 1, NULL, NULL, 'waiting'),
        (p_tournament_id, 2, 2, NULL, NULL, 'waiting');
    
    -- Final (3. tur)
    INSERT INTO tournament_matches (tournament_id, round, match_number, player1_id, player2_id, status)
    VALUES 
        (p_tournament_id, 3, 1, NULL, NULL, 'waiting');
    
    -- Turnuvayı başlat
    UPDATE tournaments 
    SET status = 'in_progress', started_at = NOW(), current_round = 1
    WHERE id = p_tournament_id;
    
    RETURN JSON_BUILD_OBJECT(
        'success', true,
        'real_players', v_real_player_count,
        'bots_added', v_bot_count,
        'matches_created', 7
    );
    
EXCEPTION 
    WHEN OTHERS THEN
        RETURN JSON_BUILD_OBJECT(
            'success', false,
            'error', SQLERRM
        );
END;
$function$;