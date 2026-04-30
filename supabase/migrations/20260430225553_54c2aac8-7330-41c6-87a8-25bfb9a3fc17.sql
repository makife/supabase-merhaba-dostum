ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS score_boost_until TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_profiles_score_boost_until 
ON public.profiles(score_boost_until) 
WHERE score_boost_until IS NOT NULL;