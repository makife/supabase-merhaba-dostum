-- Tournament participants için tüm policy'leri sil ve yeniden oluştur
DROP POLICY IF EXISTS "Tournament participants are viewable by everyone" ON public.tournament_participants;
DROP POLICY IF EXISTS "Turnuva katılımcıları herkese görünür" ON public.tournament_participants;
DROP POLICY IF EXISTS "Kullanıcılar turnuvaya katılabilir" ON public.tournament_participants;

-- Yeni policy'ler oluştur
CREATE POLICY "Everyone can view tournament participants"
ON public.tournament_participants
FOR SELECT
USING (true);

CREATE POLICY "Users can join tournaments"
ON public.tournament_participants
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Tournament matches için de aynısını yap
DROP POLICY IF EXISTS "Tournament matches are viewable by everyone" ON public.tournament_matches;
DROP POLICY IF EXISTS "Turnuva maçları herkese görünür" ON public.tournament_matches;

CREATE POLICY "Everyone can view tournament matches"
ON public.tournament_matches
FOR SELECT
USING (true);

-- Tournaments tablosu için de kontrol et
DROP POLICY IF EXISTS "Turnuvalar herkese görünür" ON public.tournaments;

CREATE POLICY "Everyone can view tournaments"
ON public.tournaments
FOR SELECT
USING (true);