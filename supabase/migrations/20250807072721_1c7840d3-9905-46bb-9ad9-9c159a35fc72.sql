-- Kullanıcı profilleri tablosu
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  avatar_url TEXT,
  total_games INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  game_credits INTEGER DEFAULT 5,
  last_credit_refresh TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  premium_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rozetler tablosu
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  condition_type TEXT NOT NULL, -- 'fast_typing', 'tournament_wins', 'total_games', etc.
  condition_value INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kullanıcı rozetleri
CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- Oyun odaları
CREATE TABLE public.game_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT UNIQUE,
  host_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_mode TEXT NOT NULL, -- 'points', 'timed'
  max_score INTEGER DEFAULT 100,
  time_limit INTEGER DEFAULT 120, -- saniye cinsinden
  status TEXT DEFAULT 'waiting', -- 'waiting', 'playing', 'finished'
  current_grid TEXT[], -- 4x4 harf ızgarası
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE
);

-- Oyun katılımcıları
CREATE TABLE public.game_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0,
  is_bot BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Turnuva tablosu
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'waiting', -- 'waiting', 'in_progress', 'finished'
  max_participants INTEGER DEFAULT 8,
  current_round INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE
);

-- Turnuva katılımcıları
CREATE TABLE public.tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  seed INTEGER, -- turnuvadaki sırası
  is_bot BOOLEAN DEFAULT false,
  eliminated_at TIMESTAMP WITH TIME ZONE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

-- Turnuva maçları
CREATE TABLE public.tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  player1_id UUID REFERENCES public.profiles(id),
  player2_id UUID REFERENCES public.profiles(id),
  winner_id UUID REFERENCES public.profiles(id),
  room_id UUID REFERENCES public.game_rooms(id),
  status TEXT DEFAULT 'pending', -- 'pending', 'playing', 'finished'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kelime veritabanı
CREATE TABLE public.words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL UNIQUE,
  length INTEGER NOT NULL,
  difficulty INTEGER DEFAULT 1, -- 1-5 arası zorluk
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Oyun geçmişi
CREATE TABLE public.game_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  score INTEGER NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS politikalarını etkinleştir
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_history ENABLE ROW LEVEL SECURITY;

-- RLS politikaları
-- Profiller
CREATE POLICY "Kullanıcılar kendi profillerini görebilir" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Kullanıcılar kendi profillerini güncelleyebilir" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Yeni kullanıcı profili oluşturabilir" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Rozetler herkese görünür
CREATE POLICY "Rozetler herkese görünür" ON public.badges
  FOR SELECT USING (true);

-- Kullanıcı rozetleri
CREATE POLICY "Kullanıcılar kendi rozetlerini görebilir" ON public.user_badges
  FOR SELECT USING (auth.uid() = user_id);

-- Oyun odaları herkese görünür
CREATE POLICY "Oyun odaları herkese görünür" ON public.game_rooms
  FOR SELECT USING (true);

CREATE POLICY "Kullanıcılar oyun odası oluşturabilir" ON public.game_rooms
  FOR INSERT WITH CHECK (auth.uid() = host_id);

-- Kelimeler herkese görünür
CREATE POLICY "Kelimeler herkese görünür" ON public.words
  FOR SELECT USING (true);

-- Güncellenme tetikleyicisi
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Yeni kullanıcı profili oluşturma tetikleyicisi
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Temel rozetleri ekle
INSERT INTO public.badges (name, description, icon, condition_type, condition_value) VALUES
  ('İlk Adım', 'İlk oyununuzu tamamladınız', '🎯', 'total_games', 1),
  ('Kelime Ustası', '100 oyun tamamladınız', '🏆', 'total_games', 100),
  ('Hızlı Parmaklar', '10 saniyede kelime yazdınız', '⚡', 'fast_typing', 10),
  ('Turnuva Şampiyonu', 'İlk turnuvanızı kazandınız', '👑', 'tournament_wins', 1),
  ('Kelime Avcısı', '1000 puan topladınız', '🎪', 'total_score', 1000);

-- Temel kelimeleri ekle
INSERT INTO public.words (word, length, difficulty) VALUES
  ('KEDI', 4, 1), ('KÖPEK', 5, 1), ('ARABA', 5, 1), ('OKUL', 4, 1),
  ('KITAP', 5, 1), ('MASA', 4, 1), ('KAPI', 4, 1), ('PENCERE', 7, 2),
  ('BILGISAYAR', 10, 3), ('TELEFON', 7, 2), ('OYUN', 4, 1), ('FUTBOL', 6, 2),
  ('MÜZIK', 5, 2), ('RESIM', 5, 2), ('BAHÇE', 5, 2), ('DENIZ', 5, 1),
  ('DAĞLAR', 6, 2), ('ŞEHIR', 5, 2), ('KÖPRÜ', 6, 2), ('UÇAK', 4, 1);