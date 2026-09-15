-- Fix countdown synchronization for all game modes
-- Problem: Her oyuncu farklı zamanda countdown başlatıyor
-- Çözüm: Tüm oyuncular için aynı server time kullan

-- start_game_countdown fonksiyonunu düzelt
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
    
    -- Yeni countdown başlat - NOW() kullan (hemen başla, +3 saniye yok!)
    v_countdown_time := NOW();
    
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

-- get_server_time fonksiyonu ekle (vs-computer modu için)
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
    SELECT NOW();
$$;