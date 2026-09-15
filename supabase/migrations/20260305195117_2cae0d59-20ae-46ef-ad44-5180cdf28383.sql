
-- Challenge scores table for daily challenge leaderboards
CREATE TABLE public.challenge_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_type text NOT NULL, -- 'word_hunt', 'anagram', 'word_chain'
  score integer NOT NULL DEFAULT 0,
  words_found integer NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT (NOW() AT TIME ZONE 'Europe/Istanbul')::date,
  username text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_type, date)
);

-- Enable RLS
ALTER TABLE public.challenge_scores ENABLE ROW LEVEL SECURITY;

-- Everyone can see leaderboard
CREATE POLICY "Challenge scores visible to all"
  ON public.challenge_scores FOR SELECT
  USING (true);

-- Users can insert their own scores
CREATE POLICY "Users can insert own challenge scores"
  ON public.challenge_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own scores (in case of replay logic changes)
CREATE POLICY "Users can update own challenge scores"
  ON public.challenge_scores FOR UPDATE
  USING (auth.uid() = user_id);
