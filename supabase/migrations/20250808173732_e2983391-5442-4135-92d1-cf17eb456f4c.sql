-- Enable realtime for game tables
ALTER TABLE public.game_participants REPLICA IDENTITY FULL;
ALTER TABLE public.game_rooms REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_rooms;