-- Only enable real-time for rematch_requests table
ALTER TABLE public.rematch_requests REPLICA IDENTITY FULL;

-- Add the table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.rematch_requests;