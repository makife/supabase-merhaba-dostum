-- Matchmaking rooms tablosuna game_grid kolonu ekle
ALTER TABLE public.matchmaking_rooms 
ADD COLUMN game_grid jsonb DEFAULT NULL;