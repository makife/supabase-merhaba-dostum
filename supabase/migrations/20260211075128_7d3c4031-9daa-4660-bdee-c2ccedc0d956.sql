-- Kullanıcı silme: sydvmahmutakbulut@gmail.com (a0ce21f2-affc-4783-8007-2a157578846a)
-- Bu migration sadece public tablolardan verileri siler
-- Auth user'ı ayrıca Supabase dashboard'dan silinmelidir

DO $$
DECLARE
  v_user_id uuid := 'a0ce21f2-affc-4783-8007-2a157578846a';
BEGIN
  -- Nullify game_rooms references
  UPDATE public.game_rooms SET host_id = NULL WHERE host_id = v_user_id;
  UPDATE public.game_rooms SET player1_id = NULL WHERE player1_id = v_user_id;
  UPDATE public.game_rooms SET player2_id = NULL WHERE player2_id = v_user_id;
  UPDATE public.game_rooms SET winner_id = NULL WHERE winner_id = v_user_id;

  -- Nullify tournament references
  UPDATE public.tournament_matches SET player1_id = NULL WHERE player1_id = v_user_id;
  UPDATE public.tournament_matches SET player2_id = NULL WHERE player2_id = v_user_id;
  UPDATE public.tournament_matches SET winner_id = NULL WHERE winner_id = v_user_id;
  UPDATE public.tournaments SET creator_id = NULL WHERE creator_id = v_user_id;

  -- Delete from user tables
  DELETE FROM public.user_presence WHERE user_id = v_user_id;
  DELETE FROM public.user_badges WHERE user_id = v_user_id;
  DELETE FROM public.user_bans WHERE user_id = v_user_id;
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
  DELETE FROM public.message_reactions WHERE user_id = v_user_id;
  DELETE FROM public.notifications WHERE user_id = v_user_id;
  DELETE FROM public.player_activities WHERE player_id = v_user_id;
  DELETE FROM public.tournament_participants WHERE user_id = v_user_id;
  DELETE FROM public.wheel_spins WHERE user_id = v_user_id;
  DELETE FROM public.memory_game_plays WHERE user_id = v_user_id;
  DELETE FROM public.premium_daily_rewards WHERE user_id = v_user_id;

  -- Multi-reference tables
  DELETE FROM public.user_blocks WHERE blocker_id = v_user_id OR blocked_id = v_user_id;
  DELETE FROM public.private_messages WHERE sender_id = v_user_id OR recipient_id = v_user_id;
  DELETE FROM public.private_chats WHERE user1_id = v_user_id OR user2_id = v_user_id;
  DELETE FROM public.message_reports WHERE reporter_id = v_user_id OR reported_user_id = v_user_id;
  DELETE FROM public.rematch_requests WHERE from_user_id = v_user_id OR to_user_id = v_user_id;
  DELETE FROM public.rematch_opt_outs WHERE user_id = v_user_id;

  -- Delete profile
  DELETE FROM public.profiles WHERE id = v_user_id;

  -- Delete auth user
  DELETE FROM auth.users WHERE id = v_user_id;
END $$;
