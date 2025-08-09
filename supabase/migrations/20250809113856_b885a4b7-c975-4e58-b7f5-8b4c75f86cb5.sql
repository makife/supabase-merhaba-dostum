-- Add active_music_pack column to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS active_music_pack TEXT DEFAULT 'default';