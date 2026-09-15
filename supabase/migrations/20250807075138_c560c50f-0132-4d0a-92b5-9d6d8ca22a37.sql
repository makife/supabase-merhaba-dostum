-- Add missing INSERT policy for tournaments
CREATE POLICY "Kullanıcılar turnuva oluşturabilir" 
ON public.tournaments 
FOR INSERT 
WITH CHECK (true);

-- Add missing INSERT and UPDATE policies for words table
CREATE POLICY "Kelime ekleme edge function için" 
ON public.words 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Kelime güncelleme edge function için" 
ON public.words 
FOR UPDATE 
USING (true);