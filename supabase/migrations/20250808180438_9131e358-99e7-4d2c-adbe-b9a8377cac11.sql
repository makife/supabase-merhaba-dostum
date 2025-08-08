-- Profil resimlerinin oyunlarda görünmesi için RLS politikasını güncelle
DROP POLICY "Kullanıcılar kendi profillerini görebilir" ON public.profiles;

-- Yeni politika: username ve avatar_url herkes tarafından görülebilir
CREATE POLICY "Kullanıcı profilleri herkese görünür (temel bilgiler)" ON public.profiles
FOR SELECT USING (true);

-- Güncelleme hala sadece kendi profili için
-- Diğer politikalar aynı kalacak