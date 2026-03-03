-- Fix RPC ambiguity: remove legacy overloaded signature of update_game_stats
-- Keep the current canonical signature used by client calls:
-- update_game_stats(uuid, integer, jsonb, boolean, integer, integer, text, integer)
DROP FUNCTION IF EXISTS public.update_game_stats(uuid, integer, jsonb, integer, boolean, integer, text, integer);