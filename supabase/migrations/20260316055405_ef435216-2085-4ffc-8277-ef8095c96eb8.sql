ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'friend_request'::text, 'friend_request_accepted'::text, 'game_invite'::text, 
  'message'::text, 'mention'::text, 'general'::text, 'credit_refill'::text, 
  'wheel_spin'::text, 'badge_earned'::text, 'ban'::text, 'ban_lifted'::text, 
  'challenge_prize'::text, 'invite'::text, 'invite_response'::text, 
  'private_message'::text, 'rematch'::text, 'room_invite'::text, 'system'::text, 
  'tournament_opponent_left'::text, 'tournament'::text, 'leaderboard_prize'::text
]));