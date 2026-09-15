-- Mevcut eksik RLS politikalarını ekle
CREATE POLICY "System can manage tournament matches" 
ON tournament_matches 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Tournament participants için bot ekleme politikası
CREATE POLICY "System can add bots to tournaments" 
ON tournament_participants 
FOR INSERT 
WITH CHECK (is_bot = true OR auth.uid() = user_id);

-- Tournament participants güncellemesi için politika
CREATE POLICY "System can update tournament participants" 
ON tournament_participants 
FOR UPDATE 
USING (true);

-- Tournament update politikası
CREATE POLICY "System can update tournament status" 
ON tournaments 
FOR UPDATE 
USING (true);