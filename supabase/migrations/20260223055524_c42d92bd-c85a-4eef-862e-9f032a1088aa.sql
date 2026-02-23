
-- user_presence tablosunu Realtime publication'a ekle
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;

-- user_settings ve friendships de hook tarafından dinleniyor, onları da ekle
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
