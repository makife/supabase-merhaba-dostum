-- Enable realtime for tournament tables
ALTER TABLE tournaments REPLICA IDENTITY FULL;
ALTER TABLE tournament_participants REPLICA IDENTITY FULL;  
ALTER TABLE tournament_matches REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_matches;