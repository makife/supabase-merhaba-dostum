ALTER TABLE public.challenge_scores 
  ADD COLUMN IF NOT EXISTS moves_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS time_seconds integer DEFAULT 0;