-- Geçici olarak policy'leri kaldır
DROP POLICY IF EXISTS "Kullanıcılar turnuvaya katılabilir" ON tournament_participants;
DROP POLICY IF EXISTS "Katılımcılar herkese görünür" ON tournament_participants;

-- user_id tipini uuid'ye çevir
ALTER TABLE tournament_participants ALTER COLUMN user_id TYPE uuid USING user_id::uuid;

-- Policy'leri geri ekle
CREATE POLICY "Katılımcılar herkese görünür" 
ON tournament_participants FOR SELECT 
USING (true);

CREATE POLICY "Kullanıcılar turnuvaya katılabilir" 
ON tournament_participants FOR INSERT 
WITH CHECK (((auth.uid())::text = user_id::text) OR (is_bot = true));