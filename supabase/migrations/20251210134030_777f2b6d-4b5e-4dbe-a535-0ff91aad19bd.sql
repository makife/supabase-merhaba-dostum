-- Moderatör ban fonksiyonu - bildirim gönderme ve ban oluşturma
CREATE OR REPLACE FUNCTION apply_moderator_ban(
  p_user_id uuid,
  p_reason text,
  p_description text,
  p_duration_hours integer,
  p_moderator_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_banned_until timestamp with time zone;
  v_ban_message text;
BEGIN
  -- Moderatör yetkisi kontrolü
  IF NOT has_role(p_moderator_id, 'moderator') AND NOT has_role(p_moderator_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetki yok');
  END IF;

  -- Ban bitiş zamanını hesapla
  v_banned_until := now() + (p_duration_hours || ' hours')::interval;

  -- Eski aktif banları deaktive et
  UPDATE user_bans
  SET is_active = false
  WHERE user_id = p_user_id AND is_active = true;

  -- Yeni ban ekle
  INSERT INTO user_bans (user_id, reason, banned_until, banned_by, is_active)
  VALUES (p_user_id, 'Şikayet: ' || p_reason || ' - ' || COALESCE(p_description, ''), v_banned_until, p_moderator_id, true);

  -- profiles tablosundaki banned_until alanını güncelle
  UPDATE profiles
  SET banned_until = v_banned_until
  WHERE id = p_user_id;

  -- Bildirim mesajı oluştur
  v_ban_message := '🚫 Sohbet yasağı aldınız.' || chr(10) || chr(10) ||
    'Sebep: ' || p_reason || chr(10) ||
    'Detay: ' || COALESCE(p_description, 'Uygunsuz içerik paylaşımı') || chr(10) || chr(10) ||
    'Yasak süresi: ' || p_duration_hours || ' saat' || chr(10) ||
    'Bitiş: ' || to_char(v_banned_until, 'DD.MM.YYYY HH24:MI');

  -- Bildirim gönder (SECURITY DEFINER ile RLS bypass)
  INSERT INTO notifications (user_id, type, message, is_read)
  VALUES (p_user_id, 'ban', v_ban_message, false);

  RETURN jsonb_build_object(
    'success', true, 
    'banned_until', v_banned_until,
    'message', 'Kullanıcı yasaklandı ve bildirim gönderildi'
  );
END;
$$;

-- Yasak kaldırma fonksiyonu
CREATE OR REPLACE FUNCTION remove_moderator_ban(
  p_ban_id uuid,
  p_moderator_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Moderatör yetkisi kontrolü
  IF NOT has_role(p_moderator_id, 'moderator') AND NOT has_role(p_moderator_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetki yok');
  END IF;

  -- Ban kaydını bul
  SELECT user_id INTO v_user_id FROM user_bans WHERE id = p_ban_id;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ban bulunamadı');
  END IF;

  -- user_bans'de is_active'i false yap
  UPDATE user_bans SET is_active = false WHERE id = p_ban_id;

  -- profiles'dan banned_until'i temizle
  UPDATE profiles SET banned_until = NULL WHERE id = v_user_id;

  -- Bildirim gönder
  INSERT INTO notifications (user_id, type, message, is_read)
  VALUES (v_user_id, 'ban_lifted', '✅ Sohbet yasağınız kaldırıldı. Artık sohbete katılabilirsiniz.', false);

  RETURN jsonb_build_object('success', true, 'message', 'Yasak kaldırıldı ve bildirim gönderildi');
END;
$$;