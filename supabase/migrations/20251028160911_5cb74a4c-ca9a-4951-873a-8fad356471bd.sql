-- ============================================
-- SECURITY FIX #5: Final Remaining Functions
-- ============================================

-- notify_moderator_on_report
CREATE OR REPLACE FUNCTION public.notify_moderator_on_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_reporter_username TEXT;
  v_reported_username TEXT;
  v_message_content TEXT;
  v_response JSONB;
BEGIN
  SELECT username INTO v_reporter_username
  FROM profiles
  WHERE id = NEW.reporter_id;
  
  SELECT username INTO v_reported_username
  FROM profiles
  WHERE id = NEW.reported_user_id;
  
  IF NEW.message_type = 'global' THEN
    SELECT message INTO v_message_content
    FROM global_chat
    WHERE id = NEW.message_id;
  ELSE
    SELECT message INTO v_message_content
    FROM private_messages
    WHERE id = NEW.message_id;
  END IF;
  
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
      RAISE NOTICE 'Failed to send moderator notification: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$function$;

-- reset_daily_games (already has search_path from SQL definition)
-- But let's make sure it's explicit
CREATE OR REPLACE FUNCTION public.reset_daily_games()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  UPDATE public.profiles SET daily_games = 0;
$function$;