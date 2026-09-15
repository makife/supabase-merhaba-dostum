-- Tournament participants RLS policy'sini düzelt
DROP POLICY IF EXISTS "Turnuva katılımcıları herkese görünür" ON public.tournament_participants;

-- Yeni policy ekle
CREATE POLICY "Tournament participants are viewable by everyone"
ON public.tournament_participants
FOR SELECT
USING (true);

-- Tournament matches için de aynı düzeltmeyi yap
DROP POLICY IF EXISTS "Turnuva maçları herkese görünür" ON public.tournament_matches;

CREATE POLICY "Tournament matches are viewable by everyone"
ON public.tournament_matches
FOR SELECT
USING (true);