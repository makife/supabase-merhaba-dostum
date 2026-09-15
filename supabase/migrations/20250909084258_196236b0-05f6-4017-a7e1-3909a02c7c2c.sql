-- Enable realtime for profiles table to ensure real-time updates work
ALTER TABLE profiles REPLICA IDENTITY FULL;

-- Add profiles table to realtime publication if not already added
-- This enables real-time subscriptions to profile updates
DO $$
BEGIN
  -- Check if table is already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  END IF;
END $$;