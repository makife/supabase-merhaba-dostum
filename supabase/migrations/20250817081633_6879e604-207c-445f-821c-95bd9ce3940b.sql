-- Add updated_at column to tournament_matches table
ALTER TABLE public.tournament_matches 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add trigger to automatically update updated_at column
CREATE OR REPLACE TRIGGER tournament_matches_updated_at
    BEFORE UPDATE ON public.tournament_matches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();