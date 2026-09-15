-- Drop and recreate delete_user_account with explicit type casts
DROP FUNCTION IF EXISTS public.delete_user_account();

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Nullify game_rooms references
  UPDATE public.game_rooms SET host_id = NULL WHERE host_id = v_user_id;
  UPDATE public.game_rooms SET player1_id = NULL WHERE player1_id = v_user_id;
  UPDATE public.game_rooms SET player2_id = NULL WHERE player2_id = v_user_id;
  UPDATE public.game_rooms SET winner_id = NULL WHERE winner_id = v_user_id;
  
  -- Nullify tournament_matches references
  UPDATE public.tournament_matches SET player1_id = NULL WHERE player1_id = v_user_id;
  UPDATE public.tournament_matches SET player2_id = NULL WHERE player2_id = v_user_id;
  UPDATE public.tournament_matches SET winner_id = NULL WHERE winner_id = v_user_id;
  
  -- Delete from tables with uuid user_id
  DELETE FROM public.user_presence WHERE user_id = v_user_id;
  DELETE FROM public.user_badges WHERE user_id = v_user_id;
  DELETE FROM public.user_bans WHERE user_id = v_user_id;
  DELETE FROM public.user_blocks WHERE blocker_id = v_user_id OR blocked_id = v_user_id;
  DELETE FROM public.user_inventory WHERE user_id = v_user_id;
  DELETE FROM public.user_purchases WHERE user_id = v_user_id;
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  DELETE FROM public.user_settings WHERE user_id = v_user_id;
  DELETE FROM public.daily_leaderboard WHERE user_id = v_user_id;
  DELETE FROM public.daily_stats WHERE user_id = v_user_id;
  DELETE FROM public.weekly_stats WHERE user_id = v_user_id;
  DELETE FROM public.monthly_stats WHERE user_id = v_user_id;
  DELETE FROM public.game_sessions WHERE user_id = v_user_id;
  DELETE FROM public.game_history WHERE player_id = v_user_id;
  DELETE FROM public.game_words WHERE player_id = v_user_id;
  DELETE FROM public.game_participants WHERE user_id = v_user_id;
  DELETE FROM public.global_chat WHERE user_id = v_user_id;
  DELETE FROM public.global_messages WHERE user_id = v_user_id;
  DELETE FROM public.private_messages WHERE sender_id = v_user_id OR recipient_id = v_user_id;
  DELETE FROM public.private_chats WHERE user1_id = v_user_id OR user2_id = v_user_id;
  DELETE FROM public.message_reactions WHERE user_id = v_user_id;
  DELETE FROM public.message_reports WHERE reporter_id = v_user_id OR reported_user_id = v_user_id;
  DELETE FROM public.notifications WHERE user_id = v_user_id;
  DELETE FROM public.player_activities WHERE player_id = v_user_id;
  DELETE FROM public.rematch_requests WHERE from_user_id = v_user_id OR to_user_id = v_user_id;
  DELETE FROM public.rematch_opt_outs WHERE user_id = v_user_id;
  DELETE FROM public.tournament_participants WHERE user_id = v_user_id;
  DELETE FROM public.wheel_spins WHERE user_id = v_user_id;
  DELETE FROM public.memory_game_plays WHERE user_id = v_user_id;
  
  -- Delete profile last
  DELETE FROM public.profiles WHERE id = v_user_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Account deletion failed: %', SQLERRM;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

-- Also grant to anon for edge cases
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO anon;