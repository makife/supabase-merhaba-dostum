-- Eksik RLS politikalarını ekle

-- Game participants politikaları
CREATE POLICY "Oyun katılımcıları herkese görünür" ON public.game_participants
  FOR SELECT USING (true);

CREATE POLICY "Kullanıcılar oyuna katılabilir" ON public.game_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tournament participants politikaları
CREATE POLICY "Turnuva katılımcıları herkese görünür" ON public.tournament_participants
  FOR SELECT USING (true);

CREATE POLICY "Kullanıcılar turnuvaya katılabilir" ON public.tournament_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tournament matches politikaları
CREATE POLICY "Turnuva maçları herkese görünür" ON public.tournament_matches
  FOR SELECT USING (true);

-- Tournaments politikaları
CREATE POLICY "Turnuvalar herkese görünür" ON public.tournaments
  FOR SELECT USING (true);

-- Game history politikaları
CREATE POLICY "Oyun geçmişi herkese görünür" ON public.game_history
  FOR SELECT USING (true);

CREATE POLICY "Kullanıcılar oyun geçmişi oluşturabilir" ON public.game_history
  FOR INSERT WITH CHECK (auth.uid() = player_id);

-- Fonksiyonları güvenli hale getir
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;