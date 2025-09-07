-- Fix RLS for monthly_stats and weekly_stats tables
ALTER TABLE monthly_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- Add policies for monthly_stats
CREATE POLICY "Users can view their own monthly stats" 
ON monthly_stats FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own monthly stats" 
ON monthly_stats FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monthly stats" 
ON monthly_stats FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add policies for weekly_stats
CREATE POLICY "Users can view their own weekly stats" 
ON weekly_stats FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own weekly stats" 
ON weekly_stats FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own weekly stats" 
ON weekly_stats FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add policies for game_sessions
CREATE POLICY "Users can view their own game sessions" 
ON game_sessions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own game sessions" 
ON game_sessions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own game sessions" 
ON game_sessions FOR UPDATE 
USING (auth.uid() = user_id);