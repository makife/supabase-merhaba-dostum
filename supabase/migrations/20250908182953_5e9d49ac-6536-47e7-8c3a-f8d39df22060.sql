-- Create matchmaking_rooms table for improved real-time matchmaking
CREATE TABLE public.matchmaking_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_type TEXT NOT NULL CHECK (game_type IN ('timed', 'score')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched', 'cancelled')),
  current_players INTEGER NOT NULL DEFAULT 0,
  max_players INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.matchmaking_rooms ENABLE ROW LEVEL SECURITY;

-- Create policies for matchmaking rooms
CREATE POLICY "Users can view all matchmaking rooms" 
ON public.matchmaking_rooms 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create matchmaking rooms" 
ON public.matchmaking_rooms 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update matchmaking rooms" 
ON public.matchmaking_rooms 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own matchmaking rooms" 
ON public.matchmaking_rooms 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Create index for faster queries
CREATE INDEX idx_matchmaking_rooms_game_type_status ON public.matchmaking_rooms(game_type, status);
CREATE INDEX idx_matchmaking_rooms_expires_at ON public.matchmaking_rooms(expires_at);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_matchmaking_rooms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_matchmaking_rooms_updated_at
  BEFORE UPDATE ON public.matchmaking_rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_matchmaking_rooms_updated_at();

-- Create function to cleanup expired rooms
CREATE OR REPLACE FUNCTION public.cleanup_expired_matchmaking_rooms()
RETURNS void AS $$
BEGIN
  DELETE FROM public.matchmaking_rooms 
  WHERE expires_at < now() OR status = 'cancelled';
END;
$$ LANGUAGE plpgsql SET search_path = public;