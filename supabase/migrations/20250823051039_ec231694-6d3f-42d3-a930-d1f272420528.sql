-- Create moderation function to insert messages and enforce bans
CREATE OR REPLACE FUNCTION public.moderate_and_insert_message(
  p_user_id uuid,
  p_username text,
  p_message text,
  p_avatar_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  banned boolean := false;
  banned_until_ts timestamptz;
  new_message_id uuid;
  word text;
  banned_words text[] := ARRAY[
    'am','çük','sik','yarak','göt','amına','koduğum','goduğum','ibne','ibine','ipne','gavat','kavat','oç','o.ç','kahpe','piç','pic','orospu','orosbu','orusbu',
    'yavşak','yavsak','it','lan','aptal','mal','hayvan','pipi','öküz','manyak','yalarım','sokarım',
    'şerefsiz','beyinsiz','salak','zalak','köpek',
    'sikti*r','sikti-r','s i k t i r'
  ];
BEGIN
  -- Block if user already banned
  IF EXISTS (
    SELECT 1 FROM public.banned_users 
    WHERE user_id = p_user_id AND banned_until > now()
  ) THEN
    RETURN json_build_object('success', false, 'error', 'user_banned');
  END IF;

  -- Check banned words
  FOREACH word IN ARRAY banned_words LOOP
    IF position(lower(word) in lower(p_message)) > 0 THEN
      banned := true;
      EXIT;
    END IF;
  END LOOP;

  IF banned THEN
    banned_until_ts := now() + interval '48 hours';

    -- Ban user
    INSERT INTO public.banned_users (user_id, reason, banned_until, banned_by)
    VALUES (p_user_id, 'Yasaklı kelime kullanımı', banned_until_ts, p_user_id);

    -- Notify via bot message
    INSERT INTO public.global_chat (user_id, username, message, avatar_url)
    VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid,
      'kelimeciBot',
      format('@%s yasaklı kelime kullandığı için 2 gün sohbet yasağı uygulanmıştır.', coalesce(p_username, 'kullanıcı')),
      '/bot-avatar.png'
    );

    RETURN json_build_object('success', false, 'moderated', true, 'ban_until', banned_until_ts);
  END IF;

  -- Insert clean message
  INSERT INTO public.global_chat (user_id, username, message, avatar_url)
  VALUES (p_user_id, coalesce(p_username, 'Anonim'), p_message, p_avatar_url)
  RETURNING id INTO new_message_id;

  RETURN json_build_object('success', true, 'id', new_message_id);
END;
$$;