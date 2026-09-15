-- Create opt-out table for rematch blocking
CREATE TABLE IF NOT EXISTS public.rematch_opt_outs (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  opt_out_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rematch_opt_outs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Anyone can read rematch opt-out to block requests" ON public.rematch_opt_outs;
  DROP POLICY IF EXISTS "Users can upsert their own rematch opt-out (insert)" ON public.rematch_opt_outs;
  DROP POLICY IF EXISTS "Users can update their own rematch opt-out" ON public.rematch_opt_outs;
  DROP POLICY IF EXISTS "Users can delete their own rematch opt-out" ON public.rematch_opt_outs;
END $$;

-- Create policies
CREATE POLICY "Anyone can read rematch opt-out to block requests"
ON public.rematch_opt_outs
FOR SELECT
USING (true);

CREATE POLICY "Users can upsert their own rematch opt-out (insert)"
ON public.rematch_opt_outs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rematch opt-out"
ON public.rematch_opt_outs
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rematch opt-out"
ON public.rematch_opt_outs
FOR DELETE
USING (auth.uid() = user_id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_rematch_opt_outs_opt_until ON public.rematch_opt_outs (opt_out_until);
