
-- Add cooldown column to user_presence to prevent duplicate push notifications
ALTER TABLE public.user_presence 
ADD COLUMN IF NOT EXISTS last_online_notified_at timestamp with time zone DEFAULT NULL;

-- Replace the trigger function with cooldown logic (5 minute cooldown)
CREATE OR REPLACE FUNCTION public.notify_friends_on_online()
RETURNS TRIGGER AS $$
DECLARE
  friend_record RECORD;
  online_username TEXT;
BEGIN
  -- Only fire when user transitions to online (was offline or null)
  IF NEW.is_online = true AND (OLD.is_online IS DISTINCT FROM true) THEN
    
    -- COOLDOWN CHECK: Don't send if we notified within last 5 minutes
    IF OLD.last_online_notified_at IS NOT NULL 
       AND OLD.last_online_notified_at > now() - interval '5 minutes' THEN
      RETURN NEW;
    END IF;
    
    -- Mark notification timestamp FIRST to prevent race conditions
    NEW.last_online_notified_at := now();
    
    -- Get username of the user who just came online
    SELECT username INTO online_username FROM public.profiles WHERE id = NEW.user_id;
    
    -- Find accepted friends who have notification enabled AND are offline
    FOR friend_record IN
      SELECT friends.f_user_id
      FROM (
        SELECT CASE WHEN fs.user_id = NEW.user_id THEN fs.friend_id ELSE fs.user_id END as f_user_id
        FROM public.friendships fs
        WHERE (fs.user_id = NEW.user_id OR fs.friend_id = NEW.user_id)
        AND fs.status = 'accepted'
      ) friends
      JOIN public.user_settings us ON us.user_id = friends.f_user_id AND us.friend_online_notify = true
      JOIN public.profiles p ON p.id = friends.f_user_id AND p.push_token IS NOT NULL
      LEFT JOIN public.user_presence up ON up.user_id = friends.f_user_id
      WHERE up.is_online = false OR up.last_seen < now() - interval '60 seconds' OR up.user_id IS NULL
    LOOP
      PERFORM net.http_post(
        url := 'https://nnlvtqmuwmrqfinsgvwc.supabase.co/functions/v1/send-push-notification',
        body := jsonb_build_object(
          'receiverId', friend_record.f_user_id,
          'title', '👋 Arkadaşın Çevrimiçi!',
          'body', COALESCE(online_username, 'Bir arkadaşın') || ' 🟢 şu an çevrimiçi!',
          'data', jsonb_build_object('type', 'friend_online'),
          'skipIfOnline', true
        ),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE'
        )
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Change trigger to BEFORE UPDATE so we can modify NEW.last_online_notified_at
DROP TRIGGER IF EXISTS trg_notify_friends_on_online ON public.user_presence;
CREATE TRIGGER trg_notify_friends_on_online
BEFORE UPDATE ON public.user_presence
FOR EACH ROW
EXECUTE FUNCTION public.notify_friends_on_online();
