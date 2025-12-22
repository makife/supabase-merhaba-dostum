-- Completely recreate delete_user_account with explicit type handling
DROP FUNCTION IF EXISTS public.delete_user_account();

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Disable triggers temporarily for this session
  SET session_replication_role = replica;

  -- Delete from all related tables (order matters for foreign keys)
  DELETE FROM public.user_presence WHERE user_id = current_user_id;
  DELETE FROM public.user_badges WHERE user_id = current_user_id;
  DELETE FROM public.user_bans WHERE user_id = current_user_id;
  DELETE FROM public.user_blocks WHERE blocker_id = current_user_id OR blocked_id = current_user_id;
  DELETE FROM public.user_inventory WHERE user_id = current_user_id;
  DELETE FROM public.user_purchases WHERE user_id = current_user_id;
  DELETE FROM public.user_roles WHERE user_id = current_user_id;
  DELETE FROM public.user_settings WHERE user_id = current_user_id;
  DELETE FROM public.daily_leaderboard WHERE user_id = current_user_id;
  DELETE FROM public.daily_stats WHERE user_id = current_user_id;
  DELETE FROM public.weekly_stats WHERE user_id = current_user_id;
  DELETE FROM public.monthly_stats WHERE user_id = current_user_id;
  DELETE FROM public.game_sessions WHERE user_id = current_user_id;
  DELETE FROM public.game_history WHERE player_id = current_user_id;
  DELETE FROM public.game_words WHERE player_id = current_user_id;
  DELETE FROM public.game_participants WHERE user_id = current_user_id;
  DELETE FROM public.global_chat WHERE user_id = current_user_id;
  DELETE FROM public.global_messages WHERE user_id = current_user_id;
  
  -- Handle private messages and chats
  DELETE FROM public.private_messages WHERE sender_id = current_user_id OR recipient_id = current_user_id;
  DELETE FROM public.private_chats WHERE user1_id = current_user_id OR user2_id = current_user_id;
  
  DELETE FROM public.message_reactions WHERE user_id = current_user_id;
  DELETE FROM public.message_reports WHERE reporter_id = current_user_id OR reported_user_id = current_user_id;
  DELETE FROM public.notifications WHERE user_id = current_user_id;
  DELETE FROM public.player_activities WHERE player_id = current_user_id;
  DELETE FROM public.rematch_requests WHERE from_user_id = current_user_id OR to_user_id = current_user_id;
  DELETE FROM public.rematch_opt_outs WHERE user_id = current_user_id;
  
  -- Tournament related
  DELETE FROM public.tournament_matches WHERE player1_id = current_user_id OR player2_id = current_user_id;
  DELETE FROM public.tournament_participants WHERE user_id = current_user_id;
  
  DELETE FROM public.wheel_spins WHERE user_id = current_user_id;
  DELETE FROM public.memory_game_plays WHERE user_id = current_user_id;
  
  -- Update game_rooms to remove references to this user (don't delete, just nullify)
  UPDATE public.game_rooms SET host_id = NULL WHERE host_id = current_user_id;
  UPDATE public.game_rooms SET player1_id = NULL WHERE player1_id = current_user_id;
  UPDATE public.game_rooms SET player2_id = NULL WHERE player2_id = current_user_id;
  UPDATE public.game_rooms SET winner_id = NULL WHERE winner_id = current_user_id;
  
  -- Delete profile last
  DELETE FROM public.profiles WHERE id = current_user_id;
  
  -- Re-enable triggers
  SET session_replication_role = DEFAULT;
  
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;