-- Enable RLS for rematch_requests table if not already enabled
ALTER TABLE public.rematch_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for rematch_requests
CREATE POLICY "Users can view their own rematch requests" 
ON public.rematch_requests 
FOR SELECT 
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create rematch requests" 
ON public.rematch_requests 
FOR INSERT 
WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can update rematch requests they received" 
ON public.rematch_requests 
FOR UPDATE 
USING (auth.uid() = to_user_id);

-- Enable real-time for rematch_requests table
ALTER TABLE public.rematch_requests REPLICA IDENTITY FULL;

-- Add the table to the realtime publication
BEGIN;
  -- Remove from publication if already exists (to avoid errors)
  SELECT pg_catalog.pg_drop_replication_slot('supabase_realtime_replication_slot_rematch_requests') WHERE EXISTS (
    SELECT 1 FROM pg_replication_slots WHERE slot_name = 'supabase_realtime_replication_slot_rematch_requests'
  );
  
  -- Add to publication for real-time updates
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rematch_requests;
COMMIT;