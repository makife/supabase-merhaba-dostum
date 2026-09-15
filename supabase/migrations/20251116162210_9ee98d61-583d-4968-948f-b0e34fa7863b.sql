-- Fix countdown buffer for synchronized start across all players
-- Problem: Countdown başlangıcı NOW() olunca real-time event gecikmesi yüzünden 
-- bazı oyuncular countdown'ı 4 veya 3'ten görüyor
-- Çözüm: +5 saniye buffer ekle, böylece herkes event'i almadan önce countdown başlar

CREATE OR REPLACE FUNCTION public.start_game_countdown(p_room_id uuid)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_countdown_time timestamptz;
    v_existing_time timestamptz;
BEGIN
    -- Eğer zaten countdown başlamışsa, mevcut zamanı döndür (race condition önlemi)
    SELECT countdown_started_at INTO v_existing_time
    FROM game_rooms 
    WHERE id = p_room_id;
    
    IF v_existing_time IS NOT NULL THEN
        RETURN v_existing_time;
    END IF;
    
    -- ⏰ BUFFER EKLE: Real-time event gecikmesi için +5 saniye buffer
    -- Böylece tüm oyuncular event'i almadan önce countdown başlangıç zamanı henüz gelmemiş olur
    v_countdown_time := NOW() + interval '5 seconds';
    
    UPDATE game_rooms 
    SET 
        countdown_started_at = v_countdown_time,
        status = 'active',
        updated_at = NOW()
    WHERE id = p_room_id 
    AND countdown_started_at IS NULL; -- Sadece henüz başlamamışsa güncelle
    
    RETURN v_countdown_time;
END;
$function$;