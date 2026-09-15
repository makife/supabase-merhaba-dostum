-- Mevcut fonksiyonu sil ve yeniden oluştur
DROP FUNCTION IF EXISTS public.moderate_and_insert_message(uuid,text,text,text);

-- Bot moderasyon ve mesaj ekleme fonksiyonu
CREATE OR REPLACE FUNCTION public.moderate_and_insert_message(
  p_user_id UUID,
  p_username TEXT,
  p_message TEXT,
  p_avatar_url TEXT DEFAULT NULL
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_message_id UUID;
  v_banned_words TEXT[] := ARRAY[
    'amk', 'amq', 'oç', 'orospu', 'piç', 'sik', 'götün', 'anan', 'sikim', 
    'sikeyim', 'götüne', 'amına', 'fuck', 'shit', 'bitch', 'asshole',
    'aptal', 'salak', 'gerizekalı', 'mal', 'çük', 'yarak', 'göt', 
    'amına', 'koduğum', 'goduğum', 'ibne', 'ibine', 'ipne', 'gavat',
    'kavat', 'kahpe', 'orusbu', 'orusbu', 'yavşak', 'yavsak'
  ];
  v_word TEXT;
  v_lower_message TEXT;
  v_ban_until TIMESTAMPTZ;
BEGIN
  -- Ban kontrolü
  SELECT banned_until INTO v_ban_until
  FROM user_bans 
  WHERE user_id = p_user_id 
    AND is_active = true 
    AND banned_until > NOW()
  ORDER BY banned_until DESC
  LIMIT 1;
  
  IF v_ban_until IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'user_banned',
      'banned_until', v_ban_until
    );
  END IF;
  
  -- Yasaklı kelime kontrolü
  v_lower_message := LOWER(p_message);
  FOREACH v_word IN ARRAY v_banned_words LOOP
    IF v_lower_message LIKE '%' || v_word || '%' THEN
      -- Kullanıcıyı yasakla
      INSERT INTO user_bans (user_id, reason, banned_until, banned_by)
      VALUES (
        p_user_id,
        'Yasaklı kelime: ' || v_word,
        NOW() + INTERVAL '48 hours',
        '00000000-0000-0000-0000-000000000000'
      );
      
      RETURN json_build_object(
        'success', false,
        'moderated', true,
        'reason', 'Yasaklı kelime: ' || v_word
      );
    END IF;
  END LOOP;
  
  -- Mesajı ekle
  INSERT INTO global_chat (user_id, username, message, avatar_url)
  VALUES (p_user_id, p_username, p_message, p_avatar_url)
  RETURNING id INTO v_message_id;
  
  RETURN json_build_object(
    'success', true,
    'id', v_message_id,
    'message', 'Message sent successfully'
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;