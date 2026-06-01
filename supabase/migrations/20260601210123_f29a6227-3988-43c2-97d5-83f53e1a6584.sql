
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
  'friend_request','friend_request_accepted','game_invite','message','mention','general',
  'credit_refill','wheel_spin','badge_earned','ban','ban_lifted','challenge_prize','invite',
  'invite_response','private_message','rematch','room_invite','system',
  'tournament_opponent_left','tournament','tournament_invite',
  'leaderboard_prize','premium_gift'
]));
