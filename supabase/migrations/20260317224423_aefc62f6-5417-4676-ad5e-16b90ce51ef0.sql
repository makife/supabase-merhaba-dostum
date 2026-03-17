
-- Remove legacy overloaded function so all RPC calls resolve to the fixed implementation
DROP FUNCTION IF EXISTS public.update_game_stats(uuid, integer, jsonb, boolean, integer, integer, text, integer);

-- Disable duplicate aggregate writes from game_sessions trigger
DROP TRIGGER IF EXISTS trigger_update_user_stats ON public.game_sessions;
DROP FUNCTION IF EXISTS public.update_user_stats();
