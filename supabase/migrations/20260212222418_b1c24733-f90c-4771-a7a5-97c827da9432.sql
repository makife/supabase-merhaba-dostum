ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
  'badge'::text, 'badge_earned'::text, 'mention'::text, 'message'::text, 
  'invite'::text, 'private_message'::text, 'game_invite'::text, 'room_invite'::text,
  'tournament_opponent_left'::text, 'tournament'::text, 'rematch'::text, 
  'system'::text, 'ban'::text, 'ban_lifted'::text, 'warning'::text,
  'friend_request'::text
]));