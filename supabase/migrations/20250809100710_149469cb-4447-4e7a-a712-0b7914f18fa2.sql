-- Enable full replica identity for message_reactions to ensure real-time updates work properly
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;

-- Add the table to realtime publication if not already added
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;