-- message_reactions tablosunda DELETE eventlerinin eski satır verisini içermesi için
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;

-- message_reactions tablosunu realtime yayınına ekle
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;