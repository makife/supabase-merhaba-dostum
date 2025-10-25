-- Mesaj raporları için email tetikleyici fonksiyon
CREATE OR REPLACE FUNCTION notify_moderator_on_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter_username TEXT;
  v_reported_username TEXT;
  v_message_content TEXT;
  v_response JSONB;
BEGIN
  -- Bildiren kullanıcının kullanıcı adını al
  SELECT username INTO v_reporter_username
  FROM profiles
  WHERE id = NEW.reporter_id;
  
  -- Bildirilen kullanıcının kullanıcı adını al
  SELECT username INTO v_reported_username
  FROM profiles
  WHERE id = NEW.reported_user_id;
  
  -- Mesaj içeriğini al (global veya private)
  IF NEW.message_type = 'global' THEN
    SELECT message INTO v_message_content
    FROM global_chat
    WHERE id = NEW.message_id;
  ELSE
    SELECT message INTO v_message_content
    FROM private_messages
    WHERE id = NEW.message_id;
  END IF;
  
  -- Edge function'ı çağır (async, hata durumunda devam et)
  BEGIN
    SELECT
      extensions.http((
        'POST',
        'https://nnlvtqmuwmrqfinsgvwc.supabase.co/functions/v1/send-report-notification',
        ARRAY[
          extensions.http_header('Content-Type', 'application/json'),
          extensions.http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE')
        ],
        'application/json',
        json_build_object(
          'reportId', NEW.id,
          'reportedUserId', NEW.reported_user_id,
          'reportedUsername', v_reported_username,
          'reporterUsername', v_reporter_username,
          'messageType', NEW.message_type,
          'reason', NEW.reason,
          'description', NEW.description,
          'messageContent', v_message_content
        )::text
      )::extensions.http_request) INTO v_response;
      
    RAISE NOTICE 'Moderator notification sent for report %', NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      -- Hata durumunda log, ama trigger başarısız olmasın
      RAISE NOTICE 'Failed to send moderator notification: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- Trigger oluştur
DROP TRIGGER IF EXISTS trigger_notify_moderator ON message_reports;
CREATE TRIGGER trigger_notify_moderator
  AFTER INSERT ON message_reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_moderator_on_report();

-- http extension'ı aktifleştir (eğer yoksa)
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;