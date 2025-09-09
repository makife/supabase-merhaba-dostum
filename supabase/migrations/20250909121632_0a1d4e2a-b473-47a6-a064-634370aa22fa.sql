-- user_inventory tablosu için real-time etkinleştir
ALTER TABLE public.user_inventory REPLICA IDENTITY FULL;

-- user_inventory tablosunu real-time publication'a ekle
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_inventory;