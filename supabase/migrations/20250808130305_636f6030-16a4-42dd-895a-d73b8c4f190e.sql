-- Add RLS policy to allow cleanup function to work
CREATE POLICY "Allow cleanup function to update tournaments" 
ON public.tournaments 
FOR UPDATE 
USING (true);