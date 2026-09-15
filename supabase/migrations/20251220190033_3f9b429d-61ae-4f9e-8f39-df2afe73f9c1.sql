-- Add public read policy for user_badges so everyone can see earned badges
CREATE POLICY "Rozetler herkese görünür"
ON public.user_badges
FOR SELECT
USING (true);