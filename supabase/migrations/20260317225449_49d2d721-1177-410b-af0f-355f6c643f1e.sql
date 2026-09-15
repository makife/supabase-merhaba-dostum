
-- Fix all players whose profile total_score drifted from their monthly_stats sum
-- This is a one-time data correction

-- Create a temp function to sync all drifted scores
DO $$
DECLARE
  r RECORD;
  v_correct_score integer;
BEGIN
  FOR r IN
    SELECT 
      p.id,
      p.username,
      p.total_score as old_score,
      COALESCE(ms.monthly_sum, 0) as correct_score
    FROM profiles p
    LEFT JOIN (
      SELECT user_id, SUM(total_score) as monthly_sum
      FROM monthly_stats
      GROUP BY user_id
    ) ms ON ms.user_id = p.id
    WHERE p.total_games > 0
      AND ABS(p.total_score - COALESCE(ms.monthly_sum, 0)) > 0
  LOOP
    UPDATE profiles 
    SET total_score = r.correct_score,
        updated_at = now()
    WHERE id = r.id;
    
    RAISE NOTICE 'Fixed %: % -> %', r.username, r.old_score, r.correct_score;
  END LOOP;
END $$;
