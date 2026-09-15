-- Create global chat table
CREATE TABLE public.global_chat (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.global_chat ENABLE ROW LEVEL SECURITY;

-- Create policies for global chat
CREATE POLICY "Global chat messages are viewable by everyone" 
ON public.global_chat 
FOR SELECT 
USING (true);

CREATE POLICY "Users can send messages to global chat" 
ON public.global_chat 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Enable realtime for global chat
ALTER TABLE public.global_chat REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.global_chat;