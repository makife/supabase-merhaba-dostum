-- Debug and check if update_user_stats trigger actually inserts weekly/monthly data
-- First, let's check some test data in weekly_stats and monthly_stats tables

-- Check if we have any weekly stats data
SELECT 'Weekly Stats Count' as table_name, COUNT(*) as record_count 
FROM public.weekly_stats;

-- Check if we have any monthly stats data  
SELECT 'Monthly Stats Count' as table_name, COUNT(*) as record_count
FROM public.monthly_stats;

-- Check recent game_sessions that should have triggered the stats
SELECT 'Recent Game Sessions' as info, COUNT(*) as sessions_count
FROM public.game_sessions 
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Let's manually trigger the update_user_stats function for a test user
-- First find a user with recent game sessions
DO $$
DECLARE
    test_user_id UUID;
    session_record RECORD;
BEGIN
    -- Find a user with recent game sessions
    SELECT user_id INTO test_user_id 
    FROM public.game_sessions 
    WHERE created_at >= NOW() - INTERVAL '1 day'
    LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- Get their latest session data
        SELECT * INTO session_record
        FROM public.game_sessions
        WHERE user_id = test_user_id
        ORDER BY created_at DESC
        LIMIT 1;
        
        -- Manually trigger the stats update
        INSERT INTO public.game_sessions (user_id, score, is_winner, words_count, game_duration, game_mode, created_at)
        VALUES (test_user_id, session_record.score, session_record.is_winner, session_record.words_count, session_record.game_duration, session_record.game_mode, NOW());
        
        RAISE NOTICE 'Manually triggered stats update for user: %', test_user_id;
    ELSE
        RAISE NOTICE 'No recent game sessions found to test with';
    END IF;
END $$;