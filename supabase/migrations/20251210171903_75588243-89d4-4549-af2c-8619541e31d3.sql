-- First, drop the existing check constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add a new check constraint that includes all existing types plus new ones
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'badge',
  'badge_earned',
  'mention',
  'message',
  'invite',
  'private_message', 
  'game_invite', 
  'tournament_opponent_left', 
  'tournament', 
  'rematch',
  'system',
  'ban',
  'ban_lifted',
  'warning'
));