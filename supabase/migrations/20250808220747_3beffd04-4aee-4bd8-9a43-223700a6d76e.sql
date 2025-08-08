-- Update tournament timeout duration from 5 minutes to 30 seconds
ALTER TABLE public.tournaments 
ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '30 seconds'),
ALTER COLUMN timeout_duration SET DEFAULT 30; -- 30 seconds

-- Update existing waiting tournaments to use the new timeout
UPDATE public.tournaments 
SET expires_at = NOW() + INTERVAL '30 seconds',
    timeout_duration = 30
WHERE status = 'waiting' AND expires_at > NOW();