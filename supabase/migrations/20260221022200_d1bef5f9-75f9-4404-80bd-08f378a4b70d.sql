
-- =============================================
-- 1) RATE LIMITING: Global Chat - dakikada 5 mesaj
-- =============================================
CREATE OR REPLACE FUNCTION public.check_global_chat_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  msg_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO msg_count
  FROM public.global_chat
  WHERE user_id = NEW.user_id
    AND created_at > (now() - interval '1 minute');

  IF msg_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 5 messages per minute in global chat'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_global_chat_rate_limit
  BEFORE INSERT ON public.global_chat
  FOR EACH ROW
  EXECUTE FUNCTION public.check_global_chat_rate_limit();

-- =============================================
-- 2) RATE LIMITING: Private Messages - dakikada 10 mesaj
-- =============================================
CREATE OR REPLACE FUNCTION public.check_private_message_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  msg_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO msg_count
  FROM public.private_messages
  WHERE sender_id = NEW.sender_id
    AND created_at > (now() - interval '1 minute');

  IF msg_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 10 messages per minute in private chat'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_private_message_rate_limit
  BEFORE INSERT ON public.private_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.check_private_message_rate_limit();

-- =============================================
-- 3) CLEANUP FUNCTION: Eski mesajları temizle
-- Her chat için son 100 mesaj tut + 7 günden eski olanları sil
-- =============================================
CREATE OR REPLACE FUNCTION public.cleanup_old_messages()
RETURNS void AS $$
BEGIN
  -- Global chat: 7 günden eski mesajları sil
  DELETE FROM public.global_chat
  WHERE created_at < (now() - interval '7 days');

  -- Global chat: Son 100 mesaj dışındakileri sil
  DELETE FROM public.global_chat
  WHERE id NOT IN (
    SELECT id FROM public.global_chat
    ORDER BY created_at DESC
    LIMIT 100
  );

  -- Private messages: 7 günden eski mesajları sil
  DELETE FROM public.private_messages
  WHERE created_at < (now() - interval '7 days');

  -- Private messages: Her chat_id için son 100 mesaj dışındakileri sil
  DELETE FROM public.private_messages
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY chat_id ORDER BY created_at DESC) as rn
      FROM public.private_messages
    ) ranked
    WHERE rn > 100
  );

  RAISE LOG 'Message cleanup completed at %', now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =============================================
-- 4) Rate limit sorguları için indexler
-- =============================================
CREATE INDEX IF NOT EXISTS idx_global_chat_user_created 
  ON public.global_chat (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_messages_sender_created 
  ON public.private_messages (sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_private_messages_chat_created 
  ON public.private_messages (chat_id, created_at DESC);
