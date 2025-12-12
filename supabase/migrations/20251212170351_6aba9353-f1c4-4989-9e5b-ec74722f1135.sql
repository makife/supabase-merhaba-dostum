-- notifications tablosundaki foreign key kısıtlamasını kaldır
-- auth.users yerine profiles tablosuna referans verelim veya hiç referans olmasın
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

-- Şimdi profiles tablosuna referans ekleyelim (CASCADE ile)
-- Profili silinen kullanıcıların bildirimleri de silinsin
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;